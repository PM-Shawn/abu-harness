---
# 文件名与 name 一致：feedback-【主题】。type 固定写 feedback。
# description 写“是什么 + 什么时候翻”，索引里的那一行就从这里抄。
name: feedback-gate-no-pipe
description: 运行门禁命令时不接管道——接了 `| tail` 之后看到的是 tail 的退出码，失败会被显示成成功
type: feedback
---

<!--
feedback 记忆：用户纠正你、或者出了事故时，当场写。
正文先写发生了什么（带日期），再写 Why 和 How to apply。
下面是虚构示例，复制后换成你自己的内容。
-->

2026-01-12 复核导出 PDF 第一批的分支时，运行 `npm run verify | tail -20`，屏幕上显示退出码 0，实际上 typecheck 已经失败，后面的测试根本没有运行。

**辨认线索**：输出的最后几行应该是覆盖率汇总；如果最后几行是别的内容，说明命令链中途停了，不管退出码显示什么。

**Why:** 门禁靠退出码判断通过还是失败，退出码必须可信。管道吞掉一次退出码，就等于把没运行过的测试当作通过。

**How to apply:** 任何要靠退出码判断结果的命令都不接管道。门禁用仓库里的 `scripts/run-gate.sh` 运行，它把完整输出写进 `.scratch/gate-logs/`，最后一行打印真实退出码：

```bash
bash scripts/run-gate.sh verify
```

相关记忆：[[project-export-pdf]]
