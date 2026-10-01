// 渐进迁移名单（ESLint flat config 片段）。
// 放在哪里：<your-repo>/eslint.migration-list.mjs（仓库根目录，与 eslint.config.mjs 并排）。
// 文件用 .mjs 扩展名，package.json 的 "type" 是 commonjs 还是 module 都能加载。
//
// 做法：新规则先只对“已经迁移完”的文件生效；某个目录或文件迁移完，就在同一个 PR 里把它的 glob
// 追加进 MIGRATED_FILES。名单只增不删，所以已经迁移的文件不会退回旧写法；
// 全部迁移完之后删掉名单，让规则对所有文件生效。
//
// 用法（在 <your-repo>/eslint.config.mjs 里，放在数组靠后的位置）：
//   import { migrationConfigs } from './eslint.migration-list.mjs';
//   export default [ ...你原有的配置, ...migrationConfigs() ];
//
// 同一个文件命中多个配置块时，后面的 no-restricted-imports、no-restricted-syntax 会整条替换前面的，不会合并。
// 所以名单内的文件原本受到的限制，要通过参数传进来，由 migrationConfigs 合并后写一次：
//   baseRestrictedPaths  名单外的配置块对这些文件已有的导入限制
//                        （用了 eslint-boundaries.mjs 时传 boundaryRestrictedPaths(...) 的返回值）；
//   testFiles、testSelectors  测试文件的范围和测试文件另有的 no-restricted-syntax 选择器
//                        （用了 eslint-test-determinism.mjs 时传 testDeterminismConfig.files 和
//                        TEST_DETERMINISM_SELECTORS），名单内的测试文件会同时受两组选择器约束。
// 三者合用的完整写法见材料根目录的 INSTALL.md。
//
// 要改的地方：
//   1. MIGRATED_FILES 的初始内容；
//   2. MIGRATION_SELECTORS / MIGRATION_IMPORT_PATHS：你要推行的新规则（下面是示例：禁用任意值类名、
//      禁用原生按钮、禁止直接导入某个旧组件库）。

// 迁移完一个目录或文件，就在这里追加一行 glob；永远不删除已有的行
export const MIGRATED_FILES = [
  'src/components/settings/**/*.{ts,tsx}',
];

const MIGRATION_SELECTORS = [
  {
    selector: 'Literal[value=/\\b(bg|text|border)-\\[/]',
    message: 'Migrated file: use a design token class instead of an arbitrary value.',
  },
  {
    selector: 'JSXOpeningElement[name.name="button"]',
    message: 'Migrated file: use Button from @/components/ui instead of a raw <button>.',
  },
];

const MIGRATION_IMPORT_PATHS = [
  { name: '<old-component-library>', message: 'Migrated file: use the wrappers in @/components/ui.' },
];

export function migrationConfigs({ baseRestrictedPaths = [], testFiles = [], testSelectors = [] } = {}) {
  const configs = [
    {
      files: MIGRATED_FILES,
      rules: {
        'no-restricted-syntax': ['error', ...MIGRATION_SELECTORS],
        'no-restricted-imports': ['error', { paths: [...baseRestrictedPaths, ...MIGRATION_IMPORT_PATHS] }],
      },
    },
  ];
  if (testFiles.length > 0 && testSelectors.length > 0) {
    configs.push({
      // [名单 glob, 测试 glob] 这种嵌套数组表示“两个 glob 同时匹配”，也就是名单内的测试文件
      files: MIGRATED_FILES.flatMap((migrated) => testFiles.map((testFile) => [migrated, testFile])),
      rules: {
        'no-restricted-syntax': ['error', ...MIGRATION_SELECTORS, ...testSelectors],
      },
    });
  }
  return configs;
}
