# Memory Index

<!--
记忆索引模板。Claude Code 会把记忆目录里的 MEMORY.md 自动放进每个会话的上下文，
所以它必须短：一条记忆一行，只写“是什么 + 什么时候翻”，细节留在各自的文件里。
- 新增记忆文件时同时加一行；删除或改名时同时改这里。
- 已经结项的条目移到 archive-closed-items.md，索引里只留还会用到的。
- 链接写相对路径，指向同一目录里真实存在的文件名。
下面的条目是虚构示例，链接指向本目录的四个示例文件（user / feedback / project / reference 各一个）；
已结项的示例 project-closed-example.md 不在索引里，它的那一行在 archive-closed-items.md。
用到你的项目时，把每一行换成你自己的记忆文件名（文件名与该文件 frontmatter 里的 name 一致）。
-->

> 每条只写「是什么 + 什么时候翻」。PR 号、提交号、日期流水都在文件里，需要时打开。

## 反馈 / 工作方式

- [门禁别接管道](feedback-example.md) — 运行 verify 前看：接 `| tail` 会把失败显示成成功

## 用户

- [用户的职业身份](user-example.md) — 写汇报前看：不写代码，先写结果再写待决定的事

## 项目

- [导出 PDF 功能](project-example.md) — 动导出或打印样式前看：第一批已合入，第二批待分派；裁定“导出不带批注”

## 参考（竞品调研、外部资料）

- [导出功能三家对照](reference-example.md) — 做导出功能时看：三家入口都在已有位置

## 归档

- [已结项条目](archive-closed-items.md) — 找已经合入或关闭的旧批次、旧事故时看
