// 把“边界”类约定写成 ESLint 规则：违反时 lint 直接报错，不靠 Agent 自觉。
// 只用 ESLint 自带规则和 typescript-eslint 的 no-explicit-any，需要 ESLint 9 以上的 flat config。
// 放在哪里：<your-repo>/eslint-boundaries.mjs（仓库根目录，与 eslint.config.mjs 并排）。
//
// 用法（在 <your-repo>/eslint.config.mjs 里）：
//
//   import tseslint from 'typescript-eslint'
//   import { boundaryConfigs } from './eslint-boundaries.mjs'
//
//   const TEST_FILES = ['src/**/*.test.{ts,tsx}']
//
//   export default [
//     ...tseslint.configs.recommended,          // 你原有的配置，需要已经注册 @typescript-eslint 插件
//     ...boundaryConfigs({
//       appFiles: ['src/**/*.{ts,tsx}'],          // 要改：业务代码的范围
//       wrappedImports: [                          // 要改：必须经过项目封装才能调用的第三方函数
//         { name: '<third-party-package>', importNames: ['<raw-function>'], message: '改用 <your-wrapper>' },
//       ],
//       forbiddenModulesInApp: [],                 // 要改：界面进程不允许直接导入的模块，例如 ['fs', 'child_process']
//       nodeOnlyFiles: ['<node-only-dir>/**/*.ts'], // 要改：只在 Node 进程里运行的代码，禁止用浏览器全局变量
//     }),
//     // 测试文件常常要直接读写文件、启动进程（例如放在 src/__tests__/ 的 quarantine-sla.test.ts 导入 fs）。
//     // appFiles 的范围包含测试文件时，在数组最后加这一块，测试文件不受导入限制：
//     { files: TEST_FILES, rules: { 'no-restricted-imports': 'off' } },
//   ]
//
// 注意：同一个文件命中多个配置对象时，后面的 no-restricted-imports 会整条替换前面的，不会合并。
// 所以这里把所有导入限制集中在 appFiles 这一个配置对象里。
// 别的配置块（例如 eslint.migration-list.mjs 的迁移名单）也要对 appFiles 里的文件写 no-restricted-imports 时，
// 用 boundaryRestrictedPaths(...) 取出这里的限制列表传给它，由它合并后写一次。
// 三个片段合用的完整写法见材料根目录的 INSTALL.md。

const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'alert',
  'confirm',
  'prompt',
]

// 返回 appFiles 配置对象里 no-restricted-imports 的 paths 列表
export function boundaryRestrictedPaths({ wrappedImports = [], forbiddenModulesInApp = [] }) {
  return [
    ...wrappedImports,
    ...forbiddenModulesInApp.flatMap((name) => [
      { name, message: `界面进程不能直接使用 ${name}，能力要经过特权进程暴露并在那里校验输入。` },
      { name: `node:${name}`, message: `界面进程不能直接使用 node:${name}，能力要经过特权进程暴露并在那里校验输入。` },
    ]),
  ]
}

export function boundaryConfigs({ appFiles, wrappedImports = [], forbiddenModulesInApp = [], nodeOnlyFiles = [] }) {
  if (!Array.isArray(appFiles) || appFiles.length === 0) {
    throw new Error('boundaryConfigs: appFiles 必须是非空数组')
  }
  const restrictedPaths = boundaryRestrictedPaths({ wrappedImports, forbiddenModulesInApp })
  const configs = [
    {
      files: appFiles,
      rules: {
        // 禁止 any；确实无法给第三方类型写类型时，在那一行加 eslint-disable-next-line 并写明原因
        '@typescript-eslint/no-explicit-any': 'error',
        ...(restrictedPaths.length > 0 ? { 'no-restricted-imports': ['error', { paths: restrictedPaths }] } : {}),
      },
    },
  ]
  if (nodeOnlyFiles.length > 0) {
    configs.push({
      files: nodeOnlyFiles,
      rules: {
        // 类型检查带了 DOM 类型库时，tsc 发现不了 Node 进程里误用 window 之类的全局变量，运行时才报错
        'no-restricted-globals': [
          'error',
          ...BROWSER_GLOBALS.map((name) => ({ name, message: `这段代码运行在 Node 进程里，没有 ${name}。` })),
        ],
      },
    })
  }
  return configs
}
