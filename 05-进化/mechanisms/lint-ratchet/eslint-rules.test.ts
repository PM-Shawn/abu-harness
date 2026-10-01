// lint 规则自测：用 ESLint API 对一段示例代码运行真实配置，证明规则确实会报错、也不会误报。
// 没有这个测试时，一次写错的正则或 glob 就能让规则悄悄失效，而 lint 仍然是绿的。
//
// 放在哪里：<your-repo>/scripts/eslint-rules.test.ts。它由 vitest 运行，
// vitest 配置的 include 要包含 scripts/**/*.test.ts（写法见模板仓库根目录的 INSTALL.md）。
//
// 要改的地方：
// 1. MIGRATED / LEGACY：一个在迁移名单内、一个在名单外的虚拟文件路径（文件不需要真实存在，
//    路径决定匹配哪些配置块）；
// 2. 各个用例里的示例代码与期望，与你在 eslint.migration-list.mjs 里写的规则对应。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, it, expect } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eslint = new ESLint({ cwd: repoRoot });

const MIGRATED = 'src/components/settings/__lint_fixture__.tsx';
const LEGACY = 'src/components/legacy/__lint_fixture__.tsx';

async function messages(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, filePath) });
  return result.messages.map((m) => m.message);
}

const component = (body: string) => `export function Fixture() { return (${body}); }\n`;

describe('migration lint rules', { timeout: 60_000 }, () => {
  it('flags an arbitrary value in a migrated file', async () => {
    expect(await messages(component('<div className="bg-[#ffffff]" />'), MIGRATED)).not.toEqual([]);
  });

  it('flags a raw button in a migrated file', async () => {
    expect(await messages(component('<button type="button" />'), MIGRATED)).not.toEqual([]);
  });

  it('accepts design tokens in a migrated file', async () => {
    expect(await messages(component('<div className="bg-surface text-label" />'), MIGRATED)).toEqual([]);
  });

  it('leaves files outside the list on the old rules', async () => {
    expect(await messages(component('<div className="bg-[#ffffff]" />'), LEGACY)).toEqual([]);
  });
});
