<!--
发版清单模板。放到仓库根目录 RELEASE-CHECKLIST.md，发版的人（或 Agent）从上往下逐项执行。
要改的地方：
  1. 【……】包住的文字是占位，全部换成真实内容。【集成分支】【发版分支】换成你的分支名（例如 dev、main）。
  2. “版本号所在的全部文件”换成你项目里真实存放版本号的文件，一个都不能漏（包括锁文件），
     并且与预检脚本 scripts/release-preflight.mjs 的 versionSources 保持一致。
  3. 更新日志：预检脚本检查 CHANGELOG_PATHS 里列出的每个文件（默认只有 CHANGELOG.md）。
     多语言更新日志把每个文件都加进 CHANGELOG_PATHS；每个文件是否只用一种语言，脚本不检查，由人来看。
  4. 构建、lint、测试命令换成你的命令；预检脚本见 02-判定 的发版预检。
-->

# 发版清单

## 0. 前提

- 要发的改动全部已合入 `【集成分支】`，发版用的工作区是干净的。
- `【集成分支】` 的 CI 全部通过（包括不是必需检查的那些，打开运行记录亲自看）。
- 发版提交里没有 `.env` 文件、签名材料、私有模块、客户数据、内部地址。

## 1. 准备（在 `【集成分支】` 上）

- [ ] 把版本号改成 `X.Y.Z`，下列文件全部改到同一个值：
  - `package.json`
  - `package-lock.json` 的两个 version 字段：修改完 `package.json` 后运行 `npm install --package-lock-only`，应只有 2 行变化、没有依赖变化
  - `【其他写版本号的文件】`
- [ ] 更新日志写上本版内容：`CHANGELOG.md` 里加一节二级标题 `## vX.Y.Z`，内容不能为空。
  - 多语言更新日志：每种语言一个文件（例如 `CHANGELOG.md` 全英文、`CHANGELOG.【语言代码】.md` 用另一种语言），同一版本号、同一结构，每个文件只用一种语言。
- [ ] 提交到 `【集成分支】`。

## 2. 验证（在这里失败，不要等打了 tag 再失败）

```bash
npm run release:check   # 不带 --tag：检查各文件版本号一致、每份更新日志都有本版一节且不为空、GitHub 分支保护与期望文件一致
npm run build
bash scripts/run-gate.sh verify
```

`npm run release:check` 在本机要读取 GitHub 分支保护：需要已登录的 `gh`，并设置环境变量 `GITHUB_REPOSITORY=【owner】/【repo】`（或在命令后面加 `-- --repo 【owner】/【repo】`）。

- [ ] 上面每条命令都通过。
- [ ] 在真实应用里把本版新增的界面和行为走一遍。
- [ ] 从最终的发版提交打一个候选 tag（例如 `vX.Y.Z-rc1`）并单独推送，确认各平台构建全部通过，再进入第 3 节。

## 3. 发布（按顺序做，预检要求发版分支已经推送、tag 已经在本地创建）

- [ ] `【发版分支】` 只用快进方式合入 `【集成分支】` 并推送：
  `git switch 【发版分支】 && git pull --ff-only origin 【发版分支】 && git merge --ff-only 【集成分支】 && git push origin 【发版分支】`
- [ ] 在 `【发版分支】` 的最新提交上创建正式 tag（先不推送）：`git tag vX.Y.Z`
- [ ] 带 tag 再运行一次预检，退出码为 0 才继续：`npm run release:check -- --tag vX.Y.Z --repo 【owner】/【repo】`
  （比第 2 节多检查两项：tag 与版本号一致、tag 指向的提交已经在 `origin/【发版分支】` 上。）
- [ ] 单独推送这一个 tag：`git push origin vX.Y.Z`。不要用 `--tags` 一次推送多个。
- [ ] 发布交给 CI 完成，运行期间不手动建 Release、不删除重建、不手动发布草稿。

## 4. 发布后核对

- [ ] Release 页面的安装包齐全。
- [ ] 各更新服务器返回的版本号是 `X.Y.Z`。
- [ ] 在干净的机器上安装新版本走一遍主要路径。
- [ ] 观察 24 小时的问题反馈，有后续就记下来。
