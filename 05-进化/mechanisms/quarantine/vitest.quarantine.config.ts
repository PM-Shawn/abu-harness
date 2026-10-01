// 隔离测试专用的 Vitest 配置：只运行隔离目录里的测试，不设覆盖率阈值。
// 放在哪里：<your-repo>/vitest.quarantine.config.ts（仓库根目录）。
// 主门禁的 vitest.config.ts 要在 exclude 里排除隔离目录；tsconfig.json 的 include 要包含这个文件。
//
// package.json 加一条脚本：
//   "test:quarantine": "vitest run --config vitest.quarantine.config.ts --passWithNoTests"
//
// 要改的地方：include 里的隔离目录；如果主配置有 alias、setupFiles、environment，照抄过来。
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/quarantine/**/*.test.{ts,tsx}'],
    // 不稳定测试产生的覆盖率不可信，这里不设阈值
    coverage: { provider: 'v8' },
  },
});
