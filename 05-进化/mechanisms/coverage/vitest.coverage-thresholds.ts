// vitest.config.ts 里覆盖率阈值的写法（片段）。
// 放在哪里：把 test.coverage 这一段合并进 <your-repo>/vitest.config.ts
// （含 include、exclude 的完整 vitest.config.ts 见材料根目录的 INSTALL.md）。
//
// 规则：
// 1. 阈值只写在这一个地方，文档里不重复具体数字。
// 2. 阈值 = 当前实测值向下取整，再减 2 个点作为自然波动的余量。
// 3. 不开 autoUpdate：它每次测试通过都会改写这个被 git 跟踪的配置文件，
//    弄脏工作区（自主循环里“git status 为空”的完成条件永远达不到），
//    还会把阈值定在小数上，覆盖率有不到 1% 的波动就误报失败。
// 4. 只在一个专门的提交里手动调高；不调低。把测试移进隔离区造成的缺口也不能靠调低阈值解决。
//
// 要改的地方：
// 1. include 换成你的源码范围；下面的数字换成你项目实测值取整减 2。
// 2. 按目录的下限：键是 glob（例如 'src/core/**'），换成你的核心目录；没有这样的目录就删掉这一行。
//    匹配不到任何文件的键不起作用，也不报错，写完后故意把数字调高运行一次，确认它会失败。
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // 只统计业务代码。写明 include 之后，没有被任何测试加载的源文件也会出现在报告里（覆盖率 0），
      // 改动行覆盖率门禁才看得到“新文件完全没有测试”的情况
      include: ['src/**/*.{ts,tsx}'],
      // cobertura 生成 coverage/cobertura-coverage.xml，给改动行覆盖率门禁 diff-cover 读取（见 ci-diff-cover.yml）
      reporter: ['text', 'html', 'lcov', 'json-summary', 'cobertura'],
      // 阈值不达标时仍然写出报告，方便在 PR 评论里看到原因
      reportOnFailure: true,
      thresholds: {
        // 全局下限：实测 statements 52.17 → 50，branches 43.38 → 41，functions 49.32 → 47，lines 53.47 → 51
        statements: 50,
        branches: 41,
        functions: 47,
        lines: 51,
        // 按目录的下限：核心目录单独设，不许调低。键是 glob
        'src/core/**': { statements: 60 },
      },
    },
  },
});
