// 放在哪里：<your-repo>/scripts/release-preflight.mjs，package.json 里登记：
//   "release:check": "node scripts/release-preflight.mjs"
// 同目录还要有 release-tag-commit.mjs、check-branch-protection.mjs，
// 以及 <your-repo>/.github/branch-protection.expected.json。
//
// 作用：发版前把“容易忘、忘了就发错”的几件事一次查完，任何一项不对就退出码 1，列出全部问题。
//   1. 各处版本号一致；带 --tag 时版本号与 tag 一致。
//   2. CHANGELOG_PATHS 里的每个更新日志都有本版本的一节，且内容不为空（RC tag 跳过）。
//      脚本不检查更新日志用的是哪种语言，多语言时每个文件是否只用一种语言由人来看。
//   3. 正式版 tag 指向的提交已经在发版分支上（release-tag-commit.mjs，RC tag 跳过）。
//      这一项要求 tag 已经在本地创建、发版分支已经推送到 origin。
//   4. 本地运行时，读取 GitHub 分支保护的实际必需检查，与仓库里登记的期望文件比较
//      （check-branch-protection.mjs）。CI 的 GITHUB_TOKEN 读不到分支保护，
//      所以 CI 里显式传 --skip-branch-protection，并且只允许在 GitHub Actions 里传。
//
// 用法：
//   本地：打完 tag、推送 tag 之前运行
//           npm run release:check -- --tag v1.2.3 --repo <owner>/<repo>
//         第 4 项要用 gh（GitHub CLI）：本机要安装并登录，账号对该仓库有管理权限。
//         --repo 可以换成环境变量 GITHUB_REPOSITORY=<owner>/<repo>。
//   CI：  node scripts/release-preflight.mjs --tag "$GITHUB_REF_NAME" --skip-branch-protection
//         运行前要先 npm ci（见 release-preflight-job.yml）。
//
// 要改的地方：
//   1. versionSources：加上你项目里其他写版本号的文件。非 JSON 文件请用对应格式的解析库读取，
//      不要手写正则解析。
//   2. CHANGELOG_PATHS 和标题格式：多语言更新日志把每个文件都列上。本脚本认二级标题，
//      标题文字的第一个词是 v1.2.3，后面可以跟日期或副标题（例如 "## v1.2.3 · 2026-09-30"）。
//
// 依赖（更新日志用成熟的 Markdown 解析库读取）：
//   npm install --save-dev mdast-util-from-markdown@^2 mdast-util-to-string@^4
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';
import { shouldCheckTagCommit, spawnGit, verifyTagCommitOnReleaseBranch } from './release-tag-commit.mjs';

const CHANGELOG_PATHS = ['CHANGELOG.md'];

const args = process.argv.slice(2);
const tagIdx = args.indexOf('--tag');
const tagArg = tagIdx >= 0 ? args[tagIdx + 1] : null;
if (tagIdx >= 0 && !tagArg) throw new Error('--tag requires a value, e.g. --tag v1.2.3');
const repoIdx = args.indexOf('--repo');
const repoArg = repoIdx >= 0 ? args[repoIdx + 1] : null;
if (repoIdx >= 0 && !repoArg) throw new Error('--repo requires a value, e.g. --repo <owner>/<repo>');

const skipBranchProtection = args.includes('--skip-branch-protection');
if (skipBranchProtection && process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('--skip-branch-protection is only allowed inside GitHub Actions');
}
const checkTagCommit = shouldCheckTagCommit({
  tag: tagArg,
  skipRequested: args.includes('--skip-tag-commit-check'),
  githubEventName: process.env.GITHUB_EVENT_NAME,
});

const errors = [];
const fail = (message) => errors.push(message);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// ── 1. 版本号一致 ──
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const versionSources = {
  'package.json': pkg.version,
  // npm 在 lock 文件里有两处版本号；忘了改会让之后每次 npm install 都改动这两行，
  // 混进别人正在开的 PR
  'package-lock.json (root)': lock.version,
  'package-lock.json (packages[""])': lock.packages?.['']?.version,
  // 例：'app.config.json': readJson('app.config.json').version,
};
const version = pkg.version;
for (const [source, value] of Object.entries(versionSources)) {
  if (value !== version) fail(`version mismatch: ${source} = ${value ?? '(not found)'}, expected ${version} (from package.json)`);
}

const isPrerelease = tagArg ? tagArg.includes('-') : false;
if (tagArg) {
  const tagVersion = tagArg.replace(/^v/, '').split('-')[0];
  if (tagVersion !== version) fail(`tag ${tagArg} implies version ${tagVersion}, but package.json is ${version}`);
}

// ── 2. CHANGELOG 有本版本的一节 ──
// 用 mdast-util-from-markdown 按 CommonMark 解析成语法树，在顶层节点里找深度为 2、
// 文字第一个词正好是 v<version> 的标题（精确比较，v0.3.1 不会匹配到 v0.3.10）。
// 返回该标题到下一个深度 1 或 2 标题之间的节点；找不到标题返回 null。
function changelogSectionNodes(markdown, ver) {
  const nodes = fromMarkdown(markdown).children;
  const isSectionHeading = (node) => node.type === 'heading' && node.depth <= 2;
  const start = nodes.findIndex(
    (node) => node.type === 'heading' && node.depth === 2 && toString(node).trim().split(/\s+/)[0] === `v${ver}`,
  );
  if (start < 0) return null;
  const rest = nodes.slice(start + 1);
  const end = rest.findIndex(isSectionHeading);
  return end < 0 ? rest : rest.slice(0, end);
}

if (!isPrerelease) {
  for (const changelogPath of CHANGELOG_PATHS) {
    const section = changelogSectionNodes(readFileSync(changelogPath, 'utf8'), version);
    if (section === null) fail(`${changelogPath} is missing a "## v${version}" section`);
    else if (section.length === 0) fail(`${changelogPath} "## v${version}" section is empty`);
  }
}

// ── 3. 正式版 tag 在发版分支上 ──
if (checkTagCommit) {
  for (const message of verifyTagCommitOnReleaseBranch({ tag: tagArg, git: spawnGit })) fail(message);
}

// ── 4. 分支保护与期望文件一致（只在本地运行） ──
if (errors.length === 0) {
  if (skipBranchProtection) {
    console.log('Branch-protection check skipped explicitly (CI token cannot read it). Run `npm run release:check` locally before tagging.');
  } else {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const checkArgs = [path.join(scriptDir, 'check-branch-protection.mjs'), ...(repoArg ? ['--repo', repoArg] : [])];
    const result = spawnSync(process.execPath, checkArgs, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) fail('branch protection does not match .github/branch-protection.expected.json');
  }
}

const label = `v${version}${tagArg ? ` (tag ${tagArg})` : ''}${isPrerelease ? ' [pre-release: changelog and tag-commit checks skipped]' : ''}`;
if (errors.length > 0) {
  console.error(`\nRelease preflight FAILED for ${label}:\n`);
  for (const message of errors) console.error(`  - ${message}`);
  console.error('\nFix before pushing the tag. This preflight never changes git or GitHub.\n');
  process.exit(1);
}
console.log(`Release preflight passed for ${label}.`);
