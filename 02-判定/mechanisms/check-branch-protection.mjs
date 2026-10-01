// 放在哪里：<your-repo>/scripts/check-branch-protection.mjs，由 release-preflight.mjs 在本地调用，
// 也可以单独运行：node scripts/check-branch-protection.mjs --repo <owner>/<repo>
//
// 作用：只读查询 GitHub 分支保护的必需检查，与仓库里登记的期望文件
// <your-repo>/.github/branch-protection.expected.json 比较。有人在网页上改了分支保护（例如删掉了 check），
// 这里会变红。本脚本从不修改 GitHub。
//
// 期望文件是 JSON，不能写注释：键是分支名，值是该分支必须登记的必需检查名。
// 同目录的示例里 dev 登记 check 和 e2e、main 登记 check；没有 E2E workflow 时删掉 "e2e"。
//
// 为什么只在本地运行：CI 里的 GITHUB_TOKEN 没有 administration:read 权限，读不到分支保护。
//
// 要改的地方：
//   1. 运行时传 --repo <owner>/<repo>，或设置环境变量 GITHUB_REPOSITORY=<owner>/<repo>。
//   2. 本机需要安装并登录 gh（GitHub CLI），账号对该仓库有管理权限。
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseExpectedBranchProtection(json) {
  const parsed = JSON.parse(json);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('expected branch protection must be an object keyed by branch');
  }
  const expected = {};
  for (const [branch, contexts] of Object.entries(parsed)) {
    if (!Array.isArray(contexts) || contexts.length === 0 || contexts.some((item) => typeof item !== 'string' || item.length === 0)) {
      throw new Error(`${branch}: expected contexts must be a non-empty string array`);
    }
    if (new Set(contexts).size !== contexts.length) {
      throw new Error(`${branch}: expected contexts contain duplicates`);
    }
    expected[branch] = [...contexts].sort();
  }
  if (Object.keys(expected).length === 0) {
    throw new Error('expected branch protection must name at least one branch');
  }
  return expected;
}

export function compareBranchProtection(expected, actualByBranch) {
  const errors = [];
  for (const [branch, expectedContexts] of Object.entries(expected)) {
    const actual = actualByBranch[branch];
    if (!actual || typeof actual !== 'object') {
      errors.push(`${branch}: required status checks response is missing`);
      continue;
    }
    // strict=true：PR 分支必须先与目标分支同步，检查结果才算数
    if (actual.strict !== true) {
      errors.push(`${branch}: strict must be true, got ${JSON.stringify(actual.strict)}`);
    }
    if (!Array.isArray(actual.contexts) || actual.contexts.some((item) => typeof item !== 'string')) {
      errors.push(`${branch}: actual contexts must be a string array`);
      continue;
    }
    const actualContexts = [...actual.contexts].sort();
    if (JSON.stringify(actualContexts) !== JSON.stringify(expectedContexts)) {
      errors.push(`${branch}: required contexts are ${JSON.stringify(actualContexts)}, expected ${JSON.stringify(expectedContexts)}`);
    }
  }
  return errors;
}

function queryRequiredStatusChecks(repository, branch) {
  const result = spawnSync(
    'gh',
    ['api', '--method', 'GET', `repos/${repository}/branches/${encodeURIComponent(branch)}/protection/required_status_checks`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${branch}: gh could not read required status checks (${result.status}): ${String(result.stderr || result.stdout).trim()}`);
  }
  return JSON.parse(result.stdout);
}

function main(argv) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const repoIndex = argv.indexOf('--repo');
  const repository = repoIndex >= 0 ? argv[repoIndex + 1] : process.env.GITHUB_REPOSITORY;
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error('set GITHUB_REPOSITORY=<owner>/<repo> or pass --repo <owner>/<repo>');
  }
  const expectedPath = path.join(repoRoot, '.github', 'branch-protection.expected.json');
  const expected = parseExpectedBranchProtection(readFileSync(expectedPath, 'utf8'));
  const actual = Object.fromEntries(Object.keys(expected).map((branch) => [branch, queryRequiredStatusChecks(repository, branch)]));
  const errors = compareBranchProtection(expected, actual);
  if (errors.length > 0) {
    console.error('\nBranch protection differs from .github/branch-protection.expected.json:\n');
    for (const error of errors) console.error(`  - ${error}`);
    console.error('\nThis command only reads GitHub. Restore protection in repository settings, then run it again.\n');
    return 1;
  }
  console.log(`Branch protection matches the expected file for ${Object.keys(expected).join(', ')}.`);
  return 0;
}

const invokedDirectly = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
