// 对抗清单引用自检：清单文档里每一处 `<测试文件>:<测试名>` 引用，
// 都必须能在该测试文件里找到同名的测试；找不到就列出来并以退出码 1 结束。
// 放在哪里：<your-repo>/scripts/check-checklist-refs.mjs
//
//   node scripts/check-checklist-refs.mjs [清单文档路径]
// 退出码：0 引用全部对得上；1 有引用对不上；2 文档不存在或文档里没有任何引用。
//
// 文档用 Markdown 解析库读取，只认行内代码（反引号包起来的文字）；
// 测试文件用 TypeScript 编译器解析，取 it / test / describe 调用的第一个字符串参数作为测试名，
// 引用里的测试名要与其中一个完全相同。用模板字符串拼出来的测试名取不到，清单里引用它所在的 describe 名。
//
// 要改的地方：
// 1. DOC_PATH：你的对抗清单所在的文档（相对仓库根目录）。
// 2. REF_PATTERN：引用的写法。这里识别 `path/to/x.test.ts:测试名` 和 `path/to/x.spec.ts:测试名`。
// 3. package.json 加一条脚本（verify-scripts.jsonc 的可选脚本里有同样的一行）：
//      "check:checklist-refs": "node scripts/check-checklist-refs.mjs"
//    建议放进 CI 的 test job，让测试改名、删除后清单立刻变红。
//
// 依赖：typescript、mdast-util-from-markdown（发版预检脚本也用它）
//   npm install --save-dev typescript mdast-util-from-markdown@^2
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';
import ts from 'typescript';

export const DOC_PATH = 'TESTING.md';
const REF_PATTERN = /^(\S+\.(?:test|spec)\.[a-z]+):(.+)$/;
const TEST_FUNCTIONS = new Set(['it', 'test', 'describe']);

// 返回文档里全部引用：[{ file, name }]
export function collectReferences(markdown) {
  const references = [];
  const visit = (node) => {
    if (node.type === 'inlineCode') {
      const match = REF_PATTERN.exec(node.value);
      if (match) references.push({ file: match[1], name: match[2] });
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(fromMarkdown(markdown));
  return references;
}

// it('x')、it.only('x')、it.each([...])('x')、test.describe('x') 的最左边那个标识符
function rootIdentifier(expression) {
  let current = expression;
  while (ts.isPropertyAccessExpression(current) || ts.isCallExpression(current)) current = current.expression;
  return ts.isIdentifier(current) ? current.text : null;
}

// 返回测试文件里全部测试名（it / test / describe 的第一个字符串参数）
export function collectTestNames(fileName, source) {
  const names = new Set();
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isCallExpression(node) && TEST_FUNCTIONS.has(rootIdentifier(node.expression))) {
      const title = node.arguments[0];
      if (title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) names.add(title.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function main(argv) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const docPath = path.resolve(repoRoot, argv[0] ?? DOC_PATH);
  if (!existsSync(docPath)) {
    console.error(`checklist doc not found: ${docPath}`);
    return 2;
  }
  const references = collectReferences(readFileSync(docPath, 'utf8'));
  if (references.length === 0) {
    console.error(`no test references found in ${docPath}`);
    return 2;
  }
  const problems = [];
  const namesByFile = new Map();
  for (const { file, name } of references) {
    const testPath = path.resolve(repoRoot, file);
    if (!existsSync(testPath)) {
      problems.push(`MISSING FILE  ${file}`);
      continue;
    }
    if (!namesByFile.has(file)) namesByFile.set(file, collectTestNames(testPath, readFileSync(testPath, 'utf8')));
    if (!namesByFile.get(file).has(name)) problems.push(`DANGLING  ${file} :: ${name}`);
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    console.error(`checklist references are stale: fix the test names in ${docPath}`);
    return 1;
  }
  console.log(`all ${references.length} checklist references resolve`);
  return 0;
}

const invokedDirectly = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
