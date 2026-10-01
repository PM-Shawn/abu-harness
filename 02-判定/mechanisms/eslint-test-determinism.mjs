// ESLint flat config 片段：禁止测试文件里出现会让结果随时间和随机数变化的调用。
// 放在哪里：<your-repo>/eslint-test-determinism.mjs（仓库根目录，与 eslint.config.mjs 并排）。
// 文件用 .mjs 扩展名，package.json 的 "type" 是 commonjs 还是 module 都能加载。
//
// 用法（在 <your-repo>/eslint.config.mjs 里）：
//   import { testDeterminismConfig } from './eslint-test-determinism.mjs';
//   export default [ ...你原有的配置, testDeterminismConfig ];
// 与 eslint-boundaries.mjs、eslint.migration-list.mjs 一起使用时的完整写法见模板仓库根目录的 INSTALL.md。
//
// 要改的地方：
//   1. files：你的测试文件范围。范围以外的测试（例如 scripts/、e2e/ 下）不受约束，
//      需要时一并加进来。
//   2. 注意：no-restricted-syntax 在多个配置块同时命中同一文件时，后面的块会整个替换
//      前面的规则值，不会合并。你原有配置里如果对测试文件也用了 no-restricted-syntax，
//      要把原来的选择器一起写进下面的数组。用了迁移名单（eslint.migration-list.mjs）时，
//      把 TEST_DETERMINISM_SELECTORS 传给 migrationConfigs 的 testSelectors，由它合并。
//
// 允许的替身写法不会被误报：vi.spyOn(Date, 'now')、vi.setSystemTime(fixedDate)
// 把 Date 和 'now' 当参数传入，不属于对 Date.now() 的调用。
export const TEST_DETERMINISM_SELECTORS = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'No real Date.now() in tests. Freeze time with vi.useFakeTimers() + vi.setSystemTime(fixedDate), or use a fixed constant.',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'No bare `new Date()` (real current time) in tests. Pass a fixed timestamp, or use vi.useFakeTimers() + vi.setSystemTime().',
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: "No real Math.random() in tests. Inject a seeded RNG or vi.spyOn(Math, 'random').mockReturnValue(fixedValue).",
  },
  {
    selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",
    message: 'No real crypto.randomUUID() in tests. Stub it with vi.spyOn(...).mockReturnValue(fixedId), or assert with expect.any(String).',
  },
];

export const testDeterminismConfig = {
  files: ['src/**/*.test.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': ['error', ...TEST_DETERMINISM_SELECTORS],
  },
};
