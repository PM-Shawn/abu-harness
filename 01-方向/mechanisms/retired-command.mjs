// 退役命令拦截：把已经不该再用的开发入口（旧框架的启动、构建命令）改成打印指引并失败。
// 放在哪里：<your-repo>/scripts/retired-command.mjs
// 用法：在 package.json 里把旧命令指向本脚本，例如
//   "scripts": {
//     "old:dev": "node scripts/retired-command.mjs",
//     "old:build": "node scripts/retired-command.mjs"
//   }
// 要改的地方：
//   1. RETIRED 写旧入口的名字。
//   2. REPLACEMENTS 写现在应该用的命令。
//   3. KEPT_FOR 写旧目录还留着的原因（例如兼容已发布的旧版本、数据迁移）。
// 这个脚本只拦得住经 npm run 调用的入口；直接调用底层工具（例如 npx <old-cli> dev）仍然能绕过。

const RETIRED = '<旧入口名称，例如 Tauri>';
const REPLACEMENTS = [
  '  <说明>：npm run <new-dev-command>',
  '  <说明>：npm run <new-dev-command-2>',
];
const KEPT_FOR = '<旧目录> 只为已发布旧版本兼容、数据迁移与回退证据保留；';

console.error([
  '',
  `${RETIRED} 已退出功能开发与验收流程。`,
  '请使用：',
  ...REPLACEMENTS,
  '',
  KEPT_FOR,
  `不要在 ${RETIRED} 上开发或验收新功能。`,
  '',
].join('\n'));

// 以失败退出，让调用它的 npm 脚本和上层流程都停下
process.exitCode = 1;
