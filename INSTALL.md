# 安装说明

在一个空的 Node 项目里，把各目录 `mechanisms/` 下的脚本、钩子以及 CI 配置装起来的顺序和命令。已有项目按同样的顺序做，跳过已经有的部分。步骤编号与 [README.md](README.md)“怎样开始”的六步相同。

文中的路径都相对你的仓库根目录。材料里的文件用“目录/文件名”指明出处，例如 `02-判定/mechanisms/run-gate.sh`。

## 占位写法和固定名称

| 出现在哪里 | 写法 | 含义 |
|---|---|---|
| `templates/` 下的模板 | `【……】`，例如 `【功能名】`、`【YYYY-MM-DD】` | 占位，换成真实内容。这种括号在 Markdown 预览里照常显示 |
| `mechanisms/` 下的脚本和配置 | `<your-repo>` | 你的仓库根目录，只出现在注释里 |
| `mechanisms/` 下的脚本和配置 | `<owner>/<repo>` | GitHub 上的仓库名 |
| `mechanisms/` 下其余带尖括号的词 | 例如 `<third-party-package>` | 占位，换成真实内容；文件开头的“要改的地方”逐条列出 |
| 全部 workflow 和脚本 | 分支名 `dev`、`main` | `dev` 是集成分支（功能和修复的 PR 都合到这里），`main` 是发版分支。你的分支不叫这两个名字时，按每个文件“要改的地方”替换 |

模板里反复出现的占位用同一组名字：

| 占位 | 含义 |
|---|---|
| `【仓库路径】` | 仓库在本机的绝对路径 |
| `【集成分支】`、`【发版分支】` | 对应机制文件里的 `dev`、`main` |
| `【YYYY-MM-DD】` | 日期 |
| `【功能名】`、`【批次名】` | 功能或批次的短名字，用在文件名和标题里 |
| `【提交号】` | git 提交的编号 |
| `【模型】`、`【推理强度】` | 实际使用的模型名和推理强度 |
| `【N】` | 一个数字 |

文件名和目录也固定成一种：

| 用途 | 位置 |
|---|---|
| 需求任务书 | `docs/【YYYY-MM-DD】-【功能名】-brief.md` |
| 夜间任务书 | `docs/【YYYY-MM-DD】-【功能名】-overnight-brief.md` |
| 交付说明 | `docs/【YYYY-MM-DD】-【功能名】-delivery.md` |
| 证据目录（进 git） | `docs/evidence/【YYYY-MM-DD】-【功能名】/` |
| 门禁日志（不进 git） | `.scratch/gate-logs/`，由 `scripts/run-gate.sh` 写入 |
| 运行门禁并取真实退出码 | `bash scripts/run-gate.sh verify`，最后一行输出 `REAL_EXIT=<退出码>` |

每个机制文件开头的注释写明“放在哪里”；需要按项目修改的内容列在“要改的地方”下面。JSON 文件不能写注释，它们的说明在本页的[文件放置总表](#文件放置总表)里。

## 开始之前

需要这几样工具。

| 工具 | 用在哪里 |
|---|---|
| git | 全部 |
| Node 24 和 npm | 门禁、钩子、CI 脚本（workflow 里统一写 `node-version: 24`） |
| Python 3 | Claude Code 拦截钩子、NUL 字节检查 |
| gh（GitHub CLI，已登录） | 发版预检里读取分支保护的一项 |

空项目先建好仓库：

```bash
git init -b main
npm init -y
```

`npm init -y` 写入的 `"type": "commonjs"` 可以保留，也可以改成 `"module"`：机制文件全部用 `.mjs` 或 `.ts` 扩展名，两种取值下都能运行。

## 第 1 步 项目手册

1. 在仓库根目录建 `AGENTS.md`，写进你挑出来的规则。
2. 把 `01-方向/mechanisms/CLAUDE.md` 复制到仓库根目录，与 `AGENTS.md` 并排。

## 第 2 步 拦截钩子

只对这个项目生效的装法：

1. `03-边界/mechanisms/claude-code-guard/guard.py` 和 `guard_test.py` 复制到 `.claude/hooks/`。
2. `03-边界/mechanisms/claude-code-guard/settings.snippet.json` 的内容合并进 `.claude/settings.json`，把其中的命令改成：

   ```
   python3 "$CLAUDE_PROJECT_DIR/.claude/hooks/guard.py"
   ```

3. 确认：

   ```bash
   python3 .claude/hooks/guard_test.py
   ```

   41 个用例全部 PASS，退出码 0。

对本机全部项目生效的装法：两个文件放到 `~/.claude/hooks/`，配置片段原样合并进 `~/.claude/settings.json`。

钩子拦不住的写法、Codex 侧的放行表，见[边界](03-边界/README.md)的“不用 git 回滚”和“Agent 工具的放行配置”。

## 第 3 步 “做完”的标准

### 3.1 .gitignore

把 `03-边界/mechanisms/gitignore.snippet` 的内容追加到 `.gitignore`。其中 `node_modules/`、`coverage/`、`dist/`、`*.tsbuildinfo`、`.scratch/` 这几行保证运行门禁之后 `git status` 输出为空。

### 3.2 依赖

```bash
npm install --save-dev eslint typescript-eslint typescript @types/node vitest @vitest/coverage-v8 husky lint-staged yaml mdast-util-from-markdown@^2 mdast-util-to-string@^4
npx husky
git config core.hooksPath
```

最后一条命令要输出 `.husky/_`。带包名的 `npm install` 不运行 `prepare`，所以要单独运行一次 `npx husky`；没有这个设置时 git 不运行任何钩子，也没有任何提示。

| 依赖 | 谁用到 |
|---|---|
| `eslint`、`typescript-eslint` | `npm run lint`、三个 ESLint 片段 |
| `typescript`、`@types/node` | `npm run typecheck`、`npm run build` |
| `vitest`、`@vitest/coverage-v8` | `npm test`、`npm run test:coverage` |
| `husky`、`lint-staged` | 提交钩子 |
| `yaml` | `scripts/ci-gate.test.mjs` |
| `mdast-util-from-markdown`、`mdast-util-to-string` | `scripts/release-preflight.mjs` 读取更新日志 |

### 3.3 三个配置文件

`tsconfig.json`（已有项目沿用自己的；`include` 要包含 `scripts` 和两个 vitest 配置文件）：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "erasableSyntaxOnly": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "scripts", "vitest.config.ts", "vitest.quarantine.config.ts"]
}
```

`eslint.config.mjs`。先把三个片段复制到仓库根目录：`03-边界/mechanisms/eslint-boundaries.mjs`、`02-判定/mechanisms/eslint-test-determinism.mjs`、`05-进化/mechanisms/lint-ratchet/eslint.migration-list.mjs`（不做渐进迁移时不复制第三个，并删掉下面标了“迁移名单”的三处）。

```js
import tseslint from 'typescript-eslint';
import { boundaryConfigs, boundaryRestrictedPaths } from './eslint-boundaries.mjs';
import { TEST_DETERMINISM_SELECTORS, testDeterminismConfig } from './eslint-test-determinism.mjs';
import { migrationConfigs } from './eslint.migration-list.mjs'; // 迁移名单

const boundaryOptions = {
  appFiles: ['src/**/*.{ts,tsx}'],
  wrappedImports: [],
  forbiddenModulesInApp: [],
  nodeOnlyFiles: ['scripts/**/*.ts'],
};

export default [
  { ignores: ['node_modules/', 'coverage/', 'dist/', '.scratch/'] },
  ...tseslint.configs.recommended,
  ...boundaryConfigs(boundaryOptions),
  testDeterminismConfig,
  // 迁移名单：把名单外的配置块对这些文件已有的限制传进去，由它合并后写一次
  ...migrationConfigs({
    baseRestrictedPaths: boundaryRestrictedPaths(boundaryOptions),
    testFiles: testDeterminismConfig.files,
    testSelectors: TEST_DETERMINISM_SELECTORS,
  }),
  // 放在最后：测试文件不受导入限制
  { files: testDeterminismConfig.files, rules: { 'no-restricted-imports': 'off' } },
];
```

配置块的先后顺序不能换：同一个文件命中多个配置块时，后面的 `no-restricted-imports`、`no-restricted-syntax` 会整条替换前面的。

`vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 必须写明 include：默认的匹配范围会把 scripts/*.test.mjs（node:test 写的门禁脚本自测）也收进来并报错
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // 隔离目录只通过 test:quarantine 单独运行
    exclude: ['node_modules/**', 'dist/**', 'src/__tests__/quarantine/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'html', 'lcov', 'json-summary', 'cobertura'],
      reportOnFailure: true,
      thresholds: {
        statements: 50,
        branches: 41,
        functions: 47,
        lines: 51,
      },
    },
  },
});
```

`coverage` 一段的来历和规则见 `05-进化/mechanisms/coverage/vitest.coverage-thresholds.ts`。四个数字先照抄，运行一次 `npm run test:coverage` 之后换成实测值向下取整再减 2。

### 3.4 package.json 的脚本

把 `02-判定/mechanisms/verify-scripts.jsonc` 里的 `scripts` 和 `lint-staged` 两段合并进 `package.json`（去掉注释；`npm init -y` 生成的 `test` 脚本换成片段里的）。全材料的 workflow、钩子和模板引用的 npm 脚本名都以这个文件为准。

### 3.5 门禁脚本

`02-判定/mechanisms/run-gate.sh` 复制到 `scripts/run-gate.sh`。

### 3.6 提交钩子

`02-判定/mechanisms/husky-pre-commit` 复制为 `.husky/pre-commit`，然后：

```bash
chmod +x .husky/pre-commit
```

全材料只有这一份 pre-commit。用了公开仓泄露检查时，去掉文件里 `npm run check:leak` 一行的注释。

### 3.7 确认

```bash
bash scripts/run-gate.sh verify     # 最后一行 REAL_EXIT=0
git status --porcelain              # 提交之后再运行门禁，输出为空
```

再故意提交一个含 `any` 的 `src/` 文件：`git commit` 退出码 1，提交被钩子拦下。

## 第 4 步 CI 与发版预检

### 4.1 CI 汇总检查

1. `02-判定/mechanisms/ci-gate.yml` 复制为 `.github/workflows/ci.yml`。
2. `02-判定/mechanisms/ci-gate.test.mjs` 复制到 `scripts/`。
3. 确认：`npm run test:infra` 退出码 0。
4. 提交之后建集成分支并把两条分支都推送上去：`git switch -c dev`，`git push origin main dev`。
5. 在 GitHub 仓库 Settings → Branches 里给 `dev` 和 `main` 建分支保护，把 `check` 登记为必需检查，并打开“管理员也不能绕过”。

往 `check` 里增加或删除 job 时，`ci.yml` 的 `needs`、`RESULTS` 和 `scripts/ci-gate.test.mjs` 的 `GATE_JOBS` 要一起改；只作参考的 job 登记进 `ADVISORY_JOBS`。每个 CI 片段文件的开头都写了自己要改哪几处。

### 4.2 发版预检

1. `02-判定/mechanisms/` 下的 `release-preflight.mjs`、`release-tag-commit.mjs`、`release-tag-commit.test.mjs`、`check-branch-protection.mjs` 复制到 `scripts/`。
2. `02-判定/mechanisms/branch-protection.expected.json` 复制为 `.github/branch-protection.expected.json`，内容改成每个分支实际登记的必需检查名（没有 E2E workflow 时删掉 `"e2e"`）。
3. `02-判定/mechanisms/release-preflight-job.yml` 复制为 `.github/workflows/release.yml`，把 `build` job 换成你的构建和发布步骤。
4. 仓库根目录建 `CHANGELOG.md`，每个版本一节二级标题 `## v1.2.3`。
5. 确认：`npm run test:infra` 退出码 0；`npm run release:check -- --repo <owner>/<repo>` 退出码 0（需要已登录的 gh 和已经建好的分支保护）。

发版时的先后顺序见 `01-方向/templates/release-checklist.md`。

## 第 5 步 记录

1. 提交信息检查：

   ```bash
   npm install --save-dev @commitlint/cli @commitlint/config-conventional
   ```

   `04-记录/mechanisms/commitlint.config.mjs` 复制到仓库根目录；`04-记录/mechanisms/commit-msg` 复制为 `.husky/commit-msg` 并 `chmod +x .husky/commit-msg`；`04-记录/mechanisms/commit-message-policy.yml` 复制为 `.github/workflows/commit-message-policy.yml`。

   确认：`git commit -m "update stuff"` 退出码 1；`git commit -m "chore: add commitlint"` 退出码 0。

2. 记忆模板：`04-记录/templates/memory/` 下的文件是格式示例，照着在 Claude Code 的记忆目录里写你自己的。

## 第 6 步 试一个晚上

1. 需求任务书：`01-方向/templates/product-brief.md` 复制为 `docs/【YYYY-MM-DD】-【功能名】-brief.md`。
2. 夜间任务书：`01-方向/templates/overnight-brief.md` 复制为 `docs/【YYYY-MM-DD】-【功能名】-overnight-brief.md`。
3. 派活指令：`01-方向/templates/dispatch-prompt.txt`。
4. 完成条件：`02-判定/templates/goal-conditions.md`。
5. 交付说明：`04-记录/templates/delivery.md` 复制为 `docs/【YYYY-MM-DD】-【功能名】-delivery.md`。
6. PR 模板：`01-方向/templates/pull_request_template.md` 复制为 `.github/pull_request_template.md`。

## 全新克隆和新 worktree

```bash
npm ci
git config core.hooksPath     # 输出 .husky/_
```

`npm ci` 会运行 `prepare`，钩子从这时起生效。在这之前的提交不经过任何钩子。

## 可选机制

用到哪一项，就按它那一行做；要加的 npm 脚本都在 `02-判定/mechanisms/verify-scripts.jsonc` 末尾的可选脚本里。

| 机制 | 文件 | 接入办法 | 怎样确认 |
|---|---|---|---|
| 公开仓泄露检查 | `03-边界/mechanisms/leak-guard/` | 脚本和测试放进 `scripts/`；名单示例复制为 `.leak-guard-paths` 并换成真实路径；加 `check:leak`、`test:leak-guard` 两条脚本；`verify:full` 第一步写 `npm run check:leak`；`.husky/pre-commit` 去掉那一行的注释；CI 按 `leak-guard.ci.yml` 开头的三处并入 `check` | `npm run check:leak` 退出码 0；名单原样复制时退出码 2；`npm run test:leak-guard` 12 个 PASS |
| 源文件 NUL 字节检查 | `03-边界/mechanisms/check-nul-bytes.py` | 放进 `scripts/`，加 `check:nul` 脚本 | `npm run check:nul` 退出码 0 |
| 发版分支只接受快进 | `03-边界/mechanisms/branch-policy.yml` | 复制为 `.github/workflows/branch-policy.yml`，把 `promotion-ready` 登记为 `main` 的必需检查并写进期望文件 | 推送 `dev` 后该 workflow 通过 |
| 渐进迁移名单及规则自测 | `05-进化/mechanisms/lint-ratchet/` | `eslint.migration-list.mjs` 放仓库根目录并按 3.3 接入；`eslint-rules.test.ts` 放进 `scripts/` | `npm test` 通过 |
| 改动行覆盖率 | `05-进化/mechanisms/coverage/ci-diff-cover.yml` | 复制为 `.github/workflows/diff-coverage.yml`，登记为必需检查 | 本机：`pip install diff-cover` 后 `diff-cover coverage/cobertura-coverage.xml --compare-branch=origin/dev --fail-under=80` |
| 隔离区与期限检查 | `05-进化/mechanisms/quarantine/` | `quarantine-sla.test.ts` 放 `src/__tests__/`；`quarantineAsOf.ts`、`specQuarantine.ts` 放 `src/test/`；`vitest.quarantine.config.ts` 放仓库根目录；加 `test:quarantine` 脚本；`ci-quarantine-asof.yml` 的一步加进 `ci.yml` 的 test job | `npm test` 通过；`QUARANTINE_ASOF=2099-01-01 npm test` 在有隔离文件时失败 |
| 依赖自动升级 | `05-进化/mechanisms/dependabot/` | 两个文件分别复制为 `.github/dependabot.yml`、`.github/workflows/dependabot-auto-merge.yml` | 先确认 `dev` 有分支保护和必需检查 |
| 漏洞允许清单 | `05-进化/mechanisms/audit/` | 脚本放 `scripts/`，清单放 `.github/npm-audit-allowlist.json`，job 按 `ci-audit.yml` 开头的说明加进 `ci.yml` | `npm audit --omit=dev --json > .scratch/audit.json; node scripts/npm-audit-check.mjs .scratch/audit.json` 退出码 0 |
| E2E 分片与汇总检查 | `02-判定/mechanisms/e2e-gate.yml` | 复制为 `.github/workflows/e2e.yml`，加 `test:e2e` 脚本，把 `e2e` 登记为必需检查 | PR 上 `e2e` 检查通过 |
| 测试清单 | `04-记录/mechanisms/test-inventory.mjs` | 放进 `scripts/`；`TESTING.md` 里加一对标记；加 `test:inventory`、`test:inventory:check` 两条脚本；`verify:full` 串上 `npm run test:inventory:check` | `npm run test:inventory` 之后 `npm run test:inventory:check` 退出码 0 |
| 对抗清单引用自检 | `04-记录/mechanisms/check-checklist-refs.mjs` | 放进 `scripts/`，加 `check:checklist-refs` 脚本 | `npm run check:checklist-refs` 退出码 0 |
| 退役命令 | `01-方向/mechanisms/retired-command.mjs` | 放进 `scripts/`，把旧命令的 npm 脚本指向它 | 运行旧命令退出码 1 并打印指引 |

## 文件放置总表

| 材料里的文件 | 放到仓库的哪里 | 说明 |
|---|---|---|
| `01-方向/mechanisms/CLAUDE.md` | `CLAUDE.md` | 与 `AGENTS.md` 并排 |
| `01-方向/mechanisms/retired-command.mjs` | `scripts/retired-command.mjs` | 可选 |
| `02-判定/mechanisms/verify-scripts.jsonc` | 合并进 `package.json` | npm 脚本名以它为准 |
| `02-判定/mechanisms/run-gate.sh` | `scripts/run-gate.sh` | |
| `02-判定/mechanisms/husky-pre-commit` | `.husky/pre-commit` | 全材料只有这一份 |
| `02-判定/mechanisms/eslint-test-determinism.mjs` | `eslint-test-determinism.mjs` | 仓库根目录 |
| `02-判定/mechanisms/ci-gate.yml` | `.github/workflows/ci.yml` | |
| `02-判定/mechanisms/ci-gate.test.mjs` | `scripts/ci-gate.test.mjs` | |
| `02-判定/mechanisms/e2e-gate.yml` | `.github/workflows/e2e.yml` | 可选 |
| `02-判定/mechanisms/release-preflight.mjs` | `scripts/release-preflight.mjs` | |
| `02-判定/mechanisms/release-tag-commit.mjs` | `scripts/release-tag-commit.mjs` | |
| `02-判定/mechanisms/release-tag-commit.test.mjs` | `scripts/release-tag-commit.test.mjs` | |
| `02-判定/mechanisms/check-branch-protection.mjs` | `scripts/check-branch-protection.mjs` | |
| `02-判定/mechanisms/branch-protection.expected.json` | `.github/branch-protection.expected.json` | JSON：键是分支名，值是该分支登记的必需检查名，改成你的 |
| `02-判定/mechanisms/release-preflight-job.yml` | `.github/workflows/release.yml` | |
| `03-边界/mechanisms/claude-code-guard/guard.py`、`guard_test.py` | `.claude/hooks/` 或 `~/.claude/hooks/` | |
| `03-边界/mechanisms/claude-code-guard/settings.snippet.json` | 合并进 `.claude/settings.json` 或 `~/.claude/settings.json` | JSON：项目级安装时把命令里的路径改成 `$CLAUDE_PROJECT_DIR/.claude/hooks/guard.py` |
| `03-边界/mechanisms/claude-permissions.snippet.json` | 合并进 `.claude/settings.json` | JSON：Claude Code 项目级放行列表；`Bash(npm run *)` 会放行全部 npm 脚本，按需收窄 |
| `03-边界/mechanisms/codex-default.rules.example` | `~/.codex/rules/default.rules` | 只复制 `prefix_rule` 行 |
| `03-边界/mechanisms/gitignore.snippet` | 追加到 `.gitignore` | |
| `03-边界/mechanisms/eslint-boundaries.mjs` | `eslint-boundaries.mjs` | 仓库根目录 |
| `03-边界/mechanisms/check-nul-bytes.py` | `scripts/check-nul-bytes.py` | 可选 |
| `03-边界/mechanisms/branch-policy.yml` | `.github/workflows/branch-policy.yml` | 可选 |
| `03-边界/mechanisms/leak-guard/public-leak-guard.sh` | `scripts/public-leak-guard.sh` | 可选 |
| `03-边界/mechanisms/leak-guard/leak-guard.test.sh` | `scripts/leak-guard.test.sh` | 可选 |
| `03-边界/mechanisms/leak-guard/leak-guard-paths.example` | `.leak-guard-paths` | 可选；示例条目全部换成真实路径 |
| `03-边界/mechanisms/leak-guard/leak-guard.ci.yml` | 并入 `.github/workflows/ci.yml` 的 `jobs` | 可选 |
| `04-记录/mechanisms/commitlint.config.mjs` | `commitlint.config.mjs` | 仓库根目录 |
| `04-记录/mechanisms/commit-msg` | `.husky/commit-msg` | |
| `04-记录/mechanisms/commit-message-policy.yml` | `.github/workflows/commit-message-policy.yml` | |
| `04-记录/mechanisms/test-inventory.mjs` | `scripts/test-inventory.mjs` | 可选 |
| `04-记录/mechanisms/check-checklist-refs.mjs` | `scripts/check-checklist-refs.mjs` | 可选 |
| `05-进化/mechanisms/coverage/vitest.coverage-thresholds.ts` | 合并进 `vitest.config.ts` | |
| `05-进化/mechanisms/coverage/ci-diff-cover.yml` | `.github/workflows/diff-coverage.yml` | 可选 |
| `05-进化/mechanisms/lint-ratchet/eslint.migration-list.mjs` | `eslint.migration-list.mjs` | 可选；仓库根目录 |
| `05-进化/mechanisms/lint-ratchet/eslint-rules.test.ts` | `scripts/eslint-rules.test.ts` | 可选；由 vitest 运行 |
| `05-进化/mechanisms/quarantine/quarantine-sla.test.ts` | `src/__tests__/quarantine-sla.test.ts` | 可选 |
| `05-进化/mechanisms/quarantine/quarantineAsOf.ts`、`specQuarantine.ts` | `src/test/` | 可选 |
| `05-进化/mechanisms/quarantine/vitest.quarantine.config.ts` | `vitest.quarantine.config.ts` | 可选；仓库根目录 |
| `05-进化/mechanisms/quarantine/ci-quarantine-asof.yml` | 并入 `ci.yml` 的 test job | 可选 |
| `05-进化/mechanisms/dependabot/dependabot.yml` | `.github/dependabot.yml` | 可选 |
| `05-进化/mechanisms/dependabot/dependabot-auto-merge.yml` | `.github/workflows/dependabot-auto-merge.yml` | 可选 |
| `05-进化/mechanisms/audit/npm-audit-check.mjs` | `scripts/npm-audit-check.mjs` | 可选 |
| `05-进化/mechanisms/audit/npm-audit-allowlist.json` | `.github/npm-audit-allowlist.json` | 可选；JSON：示例条目是虚构的，换成真实条目或清空 `entries` |
| `05-进化/mechanisms/audit/ci-audit.yml` | 并入 `.github/workflows/ci.yml` 的 `jobs` | 可选 |
