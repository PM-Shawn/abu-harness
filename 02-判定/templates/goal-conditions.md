# 自主循环的完成条件（/goal 写法）

复制下面代码块里的句子，把【……】包住的占位换成真实内容即可使用。适用于 Claude Code 的 `/goal`，也适用于任何“让 Agent 一直做到满足条件为止”的场景。

要改的地方：

1. 【仓库路径】换成仓库在本机的绝对路径。
2. `bash scripts/run-gate.sh verify` 是运行完整门禁并打印真实退出码的命令（脚本见 02-判定 的 `run-gate.sh`，门禁命令见 `verify-scripts.jsonc`）。它最后一行输出 `REAL_EXIT=0` 才算通过。你的门禁命令不叫 `verify` 时，换成你的名字；这条命令必须把 lint、类型检查、全量测试、覆盖率串起来，任何一步失败退出码就不为 0。
3. `or stop after N turns` 的轮数按任务大小改，但一定要写。

## 写法规则

1. **条件可以用机器验证**：写命令和期望的退出码、文件是否存在、`git status` 输出是否为空这类结果，不写“做好了”“质量不错”。
2. **必须带上限**：句子结尾写 `or stop after N turns`（或者时间上限）。没有上限时，Agent 可能一直循环下去。
3. **轮末的门控只能看对话**：Claude Code 的 `/goal` 每轮结束时由一个小模型读对话判断是否达成（阿布使用时是这样），它不运行命令、不调用工具。所以条件要写成“对话里能看到证据”的样子（例如 Agent 贴出了 `REAL_EXIT=0`）；代码是否合格，由 Agent 在循环里亲自运行门禁和 `/code-review` 来判断。
4. **用户故事和业务流程还没确认时，目标只能写起草**：写“起草任务书第 1–4 节”（场景六），不能写实现。
5. `/loop` 只用来轮询和等待（等 CI、等部署），不用来“做到达标”。

## 七种场景

**一、做到门禁通过（单个仓库）**

```
/goal 在 【仓库路径】 运行 bash scripts/run-gate.sh verify 输出 REAL_EXIT=0，且 git status 输出为空 or stop after 20 turns
```

**二、两个仓库都通过，并经过复审**

```
/goal 【仓库 A 路径】 和 【仓库 B 路径】 运行 bash scripts/run-gate.sh verify 都输出 REAL_EXIT=0、git status 输出都为空，且对改动运行 /code-review 没有未处理的高危问题 or stop after 30 turns
```

**三、修 bug：先复现再修**

```
/goal 先写一个能复现该 bug 的失败测试并展示它失败，再改到 bash scripts/run-gate.sh verify 输出 REAL_EXIT=0 or stop after 15 turns
```

**四、加功能：带测试**

```
/goal 实现 【功能】 并补上对应测试，bash scripts/run-gate.sh verify 输出 REAL_EXIT=0，且新代码有测试覆盖 or stop after 25 turns
```

**五、重构：前后行为一致**

```
/goal 重构 【模块】，改前改后 bash scripts/run-gate.sh verify 都输出 REAL_EXIT=0、测试数量不减少、覆盖率不低于阈值 or stop after 20 turns
```

**六、只起草设计（用户故事和业务流程还没确认时）**

```
/goal 按 【需求原话文件】 起草 docs/【YYYY-MM-DD】-【功能名】-brief.md 的第 1–4 节（用户故事、业务流程、概念对照表、功能清单），四个标题按顺序齐全，不写任何代码 or stop after 10 turns
```

**七、带界面的功能（用户故事和业务流程已确认）**

```
/goal 按 docs/【YYYY-MM-DD】-【功能名】-brief.md 实现，bash scripts/run-gate.sh verify 输出 REAL_EXIT=0；任务书顶部“待确认”一节已列全（可以为空）；每条 P1 用户故事的 Given-When-Then 都有对应的 E2E 测试并且通过 or stop after 40 turns
```

## 不用 /goal 时的说法

让 Agent 做完一块就停：

```
做 【某件事】，每一小步运行 npm run verify:quick，整块做完运行 bash scripts/run-gate.sh verify 和 /code-review，全部通过后停下汇报，不要连续往下做。
```

只验收某个分支：

```
验收一下这个分支：亲自运行 bash scripts/run-gate.sh verify，只认 REAL_EXIT，不信任何人的自述。
```
