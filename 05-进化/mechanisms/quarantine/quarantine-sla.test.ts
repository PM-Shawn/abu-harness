// 隔离区期限检查（quarantine SLA）：放在主门禁里运行，不放进隔离目录。
// 放在哪里：<your-repo>/src/__tests__/quarantine-sla.test.ts
// （隔离目录是它旁边的 src/__tests__/quarantine/；quarantineAsOf.ts、specQuarantine.ts 放在 src/test/）。
//
// 隔离区里的 Vitest 文件第一行必须是 `// QUARANTINED: <issue-url> (YYYY-MM-DD)`；
// Playwright spec 的隔离必须用 test.fixme 写法（见 specQuarantine.ts）。
// 任何一个超过 SLA_DAYS 天，这个测试就失败，主门禁变红，
// 负责人只能修好测试移回原处，或者删掉它。
//
// 日期说明：截止日期来自 resolveQuarantineAsOf()。CI 注入当天日期，时钟每次运行都前进；
// 本地没有 QUARANTINE_ASOF 时使用下面的 FALLBACK_ASOF，保持确定性。
// 两种隔离写法用同一个判断（quarantineAgeProblem）：
//   - CI 里：超过期限失败；隔离日期晚于当天也失败（日期写错的条目永远不会过期）。
//   - 本地：隔离日期晚于 FALLBACK_ASOF 的条目按“还没到期”处理，新加的隔离条目不会让本地门禁失败；
//     早于 FALLBACK_ASOF 超过 SLA_DAYS 天的条目仍然失败。
//
// 要改的地方：
// 1. QUARANTINE_DIR、SPEC_DIRS：你的隔离目录和 E2E 目录。
// 2. import 路径：quarantineAsOf.ts、specQuarantine.ts 放在哪里就写哪里。
// 3. SLA_DAYS：期限天数。
// 4. FALLBACK_ASOF：复制时改成当天日期。
// 5. 主 vitest 配置的 exclude 里加上隔离目录，隔离测试只通过 test:quarantine 单独运行。
// 6. ESLint 对 src/ 禁止导入 fs 时（eslint-boundaries.mjs 的 forbiddenModulesInApp），
//    eslint.config.mjs 里要有对测试文件关闭 no-restricted-imports 的一块（写法见 eslint-boundaries.mjs 的用法）。
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { quarantineAgeProblem, resolveQuarantineAsOf } from '../test/quarantineAsOf';
import { inspectSpecQuarantines } from '../test/specQuarantine';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUARANTINE_DIR = join(__dirname, 'quarantine');
const REPO_ROOT = join(__dirname, '..', '..');
const SPEC_DIRS = [join(REPO_ROOT, 'e2e')];

// 本地运行用的固定日期（CI 通过 QUARANTINE_ASOF 覆盖）
const FALLBACK_ASOF = '2026-01-01';
const AS_OF = resolveQuarantineAsOf(process.env, FALLBACK_ASOF);
const SLA_DAYS = 28;

// 第一行格式：// QUARANTINED: <url> (<YYYY-MM-DD>)
const QUARANTINED_HEADER = /^\/\/ QUARANTINED: (\S+) \((\d{4}-\d{2}-\d{2})\)/;

function listFilesRecursively(directory: string, predicate: (filename: string) => boolean): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return listFilesRecursively(entryPath, predicate);
    return entry.isFile() && predicate(entry.name) ? [entryPath] : [];
  });
}

describe('quarantine SLA', () => {
  // 隔离目录清空后 git 不保留空目录，新克隆里可能不存在，按空目录处理
  const quarantineFiles = existsSync(QUARANTINE_DIR)
    ? readdirSync(QUARANTINE_DIR).filter((f) => f.endsWith('.test.ts') || f.endsWith('.test.tsx'))
    : [];

  if (quarantineFiles.length === 0) {
    it('no quarantine files to check', () => {
      expect(quarantineFiles).toEqual([]);
    });
    return;
  }

  for (const filename of quarantineFiles) {
    const filePath = join(QUARANTINE_DIR, filename);

    it(`${filename} has valid QUARANTINED header within SLA`, () => {
      const firstLine = readFileSync(filePath, 'utf-8').split('\n')[0];

      expect(
        firstLine,
        `${filename}: first line must be "// QUARANTINED: <issue-url> (YYYY-MM-DD)"\nGot: ${JSON.stringify(firstLine)}`,
      ).toMatch(QUARANTINED_HEADER);

      const dateStr = firstLine.match(QUARANTINED_HEADER)![2];
      expect(quarantineAgeProblem(dateStr, AS_OF, SLA_DAYS), filename).toBeNull();
    });
  }
});

describe('Playwright spec quarantine SLA', () => {
  const quarantinedSpecs = SPEC_DIRS
    .flatMap((directory) => listFilesRecursively(directory, (filename) => filename.endsWith('.spec.ts')))
    .map((filePath) => ({ filePath, content: readFileSync(filePath, 'utf8') }))
    .filter(({ content }) => content.includes('QUARANTINED:'));

  if (quarantinedSpecs.length === 0) {
    it('no quarantined Playwright specs to check', () => {
      expect(quarantinedSpecs).toEqual([]);
    });
    return;
  }

  for (const { filePath, content } of quarantinedSpecs) {
    const filename = filePath.slice(REPO_ROOT.length + 1);
    it(`${filename} has valid test.fixme quarantine markers within SLA`, () => {
      expect(inspectSpecQuarantines(filename, content, AS_OF, SLA_DAYS).length).toBeGreaterThan(0);
    });
  }
});
