# Release notes 三档模板

<!--
按改动大小选一档：
- patch（vX.Y.Z 末位加一）：1–2 个提交、单一主题、没有新功能和不兼容改动。
- minor（vX.Y.0）：至少一个新功能，或汇总 3 条以上用户能看到的修复。
- major（vX.0.0）：有不兼容改动、数据迁移，或需要用户动手的依赖升级。
共同要求：
- 标题带一句话副标题，让 Release 列表一眼能看懂（纯 CI / 杂务修复除外）。
- 每条写用户会看到的变化和“为什么”，不写“优化性能”“修复若干问题”这类空话。
- 有数字就给数字（例如“超时从 5 秒改为 30 秒”）。
- patch 标题不加 emoji；minor 以上的小节标题可以加。
- 末尾附 Full Changelog 链接。
- 多语言更新日志一种语言一个文件（例如 CHANGELOG.md 全英文、CHANGELOG.zh-CN.md 全中文），同版本号、同结构，不混写。
【owner】/【repo】是占位，换成你的仓库。
-->

## Patch

```markdown
## vX.Y.Z — 一句话主题

**根因**：一句话说明问题的本质或改进的动机

**修复**：
- 用户能看到的变化 1
- 用户能看到的变化 2
- 必要时写关键技术细节（带数字）

Full Changelog: https://github.com/【owner】/【repo】/compare/vX.Y.Z-1...vX.Y.Z
```

## Minor

```markdown
## ✨ Features

- **feat(模块)**：一句话描述 — 为什么重要
  - 具体行为或使用场景
  - 相关数字

## 🐛 Fixes

- **fix(模块)**：描述（需要时写根因或场景）

## 平台相关（可选，只在有某个平台独有的改动时写）

- **Windows**：
- **macOS**：

## English Summary

- 3–5 行英文，写主要功能和主要修复，不逐句翻译

**Full Changelog**: https://github.com/【owner】/【repo】/compare/vX.Y-1.0...vX.Y.0
```

## Major

在 Minor 模板基础上加：

```markdown
## ⚠️ Breaking Changes

- 改了什么：影响范围 → 用户要做什么

## 🔄 Migration Notes

1. 步骤一
2. 步骤二
3. **回退办法**：升级出问题时怎么退回

## 数据迁移（如有）

- 是否从上一版自动迁移：是 / 否
- 受影响的存储：
- 迁移失败时的表现：
```

## 发布前自查

- [ ] 每种语言的更新日志都写了本版本，且每个文件只有一种语言
- [ ] 标题有副标题
- [ ] 每条都说清用户能看到的变化
- [ ] 至少有一个具体数字
- [ ] 有 Full Changelog 链接
- [ ] major 版本写了 Breaking Changes 和 Migration Notes
