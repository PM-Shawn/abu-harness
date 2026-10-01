# SDD ledger — plan: 【docs/plans/ 下的计划文件路径】

<!--
SDD 台账模板（配合 superpowers 插件的 subagent-driven-development 流程使用；不用该插件时也可以照这个格式手写）。
- 主会话每做一个动作就在末尾追加一行，只追加在末尾，不在中间插入早期条目，
  否则接着执行的会话按行序阅读会读错进度。
- 台账是跨会话接着执行的依据：新会话先读完整份台账，再决定下一步。
- 裁定（Ruling）编号递增，每条都写“做错的代价（Cost if wrong）”。
- 批次结束时把整份台账复制到 docs/ 下长期保存（台账工作目录常被 .gitignore 忽略）。
【……】包住的文字是占位，全部换成真实内容；Task 行是格式示例。
-->

Spec: docs/【YYYY-MM-DD】-【功能名】-brief.md（【第几节】）
Workspaces: 【worktree 路径】（【分支】 @ 【起始提交号】 from 【集成分支】）
Models: implementers 【模型】, reviewers 【模型】, final review 【模型】

## Pre-flight scan

<!-- 开工前检查各任务之间的产出与依赖是否一致，发现的问题当场写成 Ruling。 -->

| Pair / task | Produces vs consumes | 发现 |
|---|---|---|
| T1 ↔ T3 | 【T1 产出什么，T3 用什么】 | consistent / gap → Ruling R1 |

Ruling R1: 【怎么处理】. Cost if wrong: 【做错的代价】.

## Tasks

Task 1: dispatched (【模型】)
Task 1: implemented (commit 【提交号】), review dispatched
Task 1: review — 【重要 / 次要发现各一句话】
Task 1: fix round 1/5 (【N】 addressed, 【N】 open; commits 【起始提交号】..【结束提交号】)
Task 1: minor (deferred): 【留到以后处理的小问题】
Task 1: complete (commits 【起始提交号】..【结束提交号】, review clean)
Ruling R2 (user instruction 【YYYY-MM-DD】): 【用户当场的指示，例如指定本批次全程使用某个模型】 — supersedes R【N】. Cost if wrong: 【做错的代价】.
Note: 【环境问题、卡住的原因、之后的分派要求】

## Final review

<!-- 全部任务完成后的整体复审结论与门禁真实退出码（run-gate.sh 的 REAL_EXIT）。 -->

=== SESSION CLOSED 【YYYY-MM-DD】 ===
<!-- 收尾段：写清哪些做完、哪些没开始、worktree 是否已删除、下一步从哪里开始。 -->
