# DSWM — DeepSeek Harness 简易 Wiki 记忆插件

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）原生 `dsh-agent-instructions`（AGENTS.md）机制的自维护持久记忆系统。无 RAG、无向量库、无运行时 LLM 调用——纯 Markdown + git。

> English: [README.md](README.md).

## 功能

DSH 在**每个会话第一个请求前**自动注入 `~/.dsh/AGENTS.md`（记忆**索引 + 规则**）。DSWM 维护该文件和一个小型 wiki 库：

```
~/.dsh/
├── AGENTS.md              # 索引 + 六条维护规则（自动注入每个会话）
└── workspace/             # 记忆库（git 仓库）
    ├── reference/         # 已确认记忆主题（进索引、参与检索）
    ├── pending/           # 待确认草稿（不参与检索，等你说"存档"）
    ├── archive/           # 过时主题（保留、不参与检索）
    └── memory-log.md      # 追加式操作日志（审计 + 新鲜度）
```

### 六条规则（全在 AGENTS.md，注入每个会话）

1. **写入触发** — 会话结束前检查是否有值得记住的信息。
2. **准入流程** — 未确认 → `pending/`；说"存档/确认" → 晋升到 `reference/` + 更新索引 + 记日志。TTL：交互 7 天 / 无人值守 30 天。
3. **无人值守会话**（task-board 定时、后台 subagent）— 只写 `pending/`，不自动晋升。
4. **定期整理** — 说"整理记忆" → agent 输出重组方案（拆分/合并/改名/归档），你确认后执行，过时内容进 `archive/`。
5. **备份** — `workspace/` 是 git 仓库；记忆变更后自动 commit。
6. **检索** — 先查索引；无匹配则扫 `reference/` 目录兜底，绝不直接认定"没有记忆"。

## 安装

```bash
# 从 GitHub（推荐）
dsh plugin --profile web add github:<owner>/dsh-simple-wiki-memory

# 或发布到 npm 后
dsh plugin --profile web add dsh-simple-wiki-memory
```

首次启动自动：同步 AGENTS.md 骨架、创建 vault 目录、git init `workspace/`。**幂等、只合并、绝不覆盖**你已有的 `~/.dsh/AGENTS.md` 索引条目。

## 使用

- 说 **"存档/确认"** → 把 pending 草稿晋升为正式记忆。
- 说 **"整理记忆"** → 触发重组流程（执行前需你确认）。
- 自带 **`memory-query`** 技能处理检索（含目录扫描兜底）。
- 涉及历史偏好/决策/事实的任务，先查记忆。

## 权限说明

读取记忆在**任何**沙箱模式下都可行（DSH 的 read 从不被沙箱限制）。写入 `~/.dsh/workspace/` 需要 `danger-full-access`，或 `workspace-write` + 按需批准升级。

## 开发

```bash
npm install        # 安装 peer 依赖用于类型检查
node --check lib/index.js
```

采用 DSH bundle 模式（`dsh.bundle.patch` → `cordis.patch.yml`），与 `dsh-liangshen` / `dsh-vision-router` 相同。

## License

MIT
