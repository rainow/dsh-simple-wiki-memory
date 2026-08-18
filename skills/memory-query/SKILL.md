---
name: memory-query
description: "Retrieve information from the DSWM persistent memory (reference/ index + topic files) with a directory-scan fallback. Use when a task may relate to previously saved memory: preferences, conventions, decisions, lessons, environment facts."
---

# memory-query

查询 DSWM 持久记忆。核心原则：**先查索引，找不到就扫目录，绝不直接认定"没有记忆"。**

## 记忆位置

- 索引与规则：`~/.dsh/AGENTS.md`（每个会话自动注入，包含索引条目）
- 正式记忆：`~/.dsh/workspace/reference/<主题>.md`
- 待确认草稿：`~/.dsh/workspace/pending/`（不参与检索，除非用户要求查看）
- 过时归档：`~/.dsh/workspace/archive/`（不参与检索）
- 操作日志：`~/.dsh/workspace/memory-log.md`（新鲜度判断用）

## 检索流程

1. **先查索引**：从 `~/.dsh/AGENTS.md` 的「记忆索引」区找与当前任务相关的条目；
2. **命中**：按条目里的完整路径 read 对应 reference 文件（必须用完整路径，相对路径会相对会话 cwd 解析导致找不到）；
3. **未命中**：扫一遍 `~/.dsh/workspace/reference/` 目录，看文件名/内容是否有相关主题；
4. **仍无**：才可认定"记忆中没有"，并明确告诉用户"记忆库中未找到相关内容"；
5. **新鲜度**：若记忆疑似过时（如版本号、时间敏感信息），read `memory-log.md` 尾部核对最近更新时间。

## 使用场景

- 用户提到"我记得之前说过/设置过/决定过…"时，优先走本技能而不是猜
- 任何涉及用户偏好、历史决策、环境事实的任务开始前
- 更新插件/配置等敏感操作前，检查 `installed-plugins` 类主题是否有升级注意事项

## 注意事项

- `reference/` 目录可读性：任何权限模式下 read 工具都能读（read 不携带沙箱策略）；
- 写入 `reference/` 需 danger-full-access 或 workspace-write + 按需批准升级；
- 不要为了检索而把整个 reference/ 目录内容一次性读入上下文——先读索引，再按需读单个文件。
