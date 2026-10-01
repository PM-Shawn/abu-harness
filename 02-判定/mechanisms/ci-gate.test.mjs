// 放在哪里：<your-repo>/scripts/ci-gate.test.mjs。
// package.json 的 test:infra（node --test "scripts/*.test.mjs"）会运行 scripts/ 下全部 *.test.mjs，不用另外登记。
//
// 作用：锁定 CI 汇总检查的结构。有人（包括 Agent）删掉 `if: always()`、
// 给汇总 job 加 continue-on-error、或新增并行 job 却忘了汇入 check 时，这里会变红。
//
// 要改的地方：
//   1. WORKFLOW_PATH：你的 CI workflow 文件位置。
//   2. GATE_JOBS：check 必须依赖的全部并行 job 名。ci.yml 的 check 增减 job 时这里同步改
//      （例如启用 security-test、并入 leak-guard）。
//   3. ADVISORY_JOBS：只作参考、不进 check 的 job 名（例如 audit），没有就留空数组。
// 依赖：npm install --save-dev yaml
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_PATH = process.env.CI_GATE_WORKFLOW ?? path.join(repoRoot, '.github/workflows/ci.yml');
const GATE_JOBS = ['lint', 'typecheck', 'test', 'build'];
const ADVISORY_JOBS = [];

const workflow = YAML.parse(readFileSync(WORKFLOW_PATH, 'utf8'));
const jobs = workflow.jobs;

test('check 汇总依赖全部门禁 job，并在任何一个没成功时失败', () => {
  const facade = jobs.check;
  assert.ok(facade, 'check job missing');
  assert.equal(facade['continue-on-error'], undefined, 'check must remain blocking');
  assert.ok(Array.isArray(facade.needs), 'check must list its gate jobs in needs');
  assert.deepEqual([...facade.needs].sort(), [...GATE_JOBS].sort(), 'check must depend on every gate job');
  // 没有 always()，上游失败时 check 被跳过，被跳过的必需检查可能被当作通过
  assert.equal(facade.if, 'always()', 'check must use `if: always()`');
  const steps = JSON.stringify(facade.steps);
  for (const job of GATE_JOBS) {
    assert.ok(steps.includes(`needs['${job}'].result`), `check must inspect ${job}.result`);
  }
  assert.match(steps, /exit 1/, 'check must fail when a gate job did not succeed');
});

test('门禁 job 都会阻断：不带 continue-on-error，也不带任何 if 条件', () => {
  for (const name of GATE_JOBS) {
    const job = jobs[name];
    assert.ok(job, `${name} job missing`);
    assert.equal(job['continue-on-error'], undefined, `${name} must remain blocking`);
    // job 级 if 会让它在某些事件上被跳过，而 check 会把 skipped 当作失败；
    // 需要跳过时应当在 step 级别处理
    assert.equal(job.if, undefined, `${name} must run on every CI event`);
    for (const step of job.steps ?? []) {
      const label = `${name}/${step.name ?? step.uses ?? step.run}`;
      assert.equal(step['continue-on-error'], undefined, `${label} must not continue on error`);
      if (typeof step.run === 'string') {
        assert.doesNotMatch(step.run, /\|\|\s*true/, `${label} must not swallow its exit code`);
      }
    }
  }
});

test('没有进 check 的 job 都登记在 ADVISORY_JOBS 里', () => {
  const known = new Set(['check', ...GATE_JOBS, ...ADVISORY_JOBS]);
  const unknown = Object.keys(jobs).filter((name) => !known.has(name));
  assert.deepEqual(unknown, [], 'new jobs must either feed check or be listed as advisory');
});
