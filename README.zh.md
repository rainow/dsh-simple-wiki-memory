# DSWM — DeepSeek Harness 简易 Wiki 记忆插件

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）原生 `dsh-agent-instructions`（AGENTS.md）机制的自维护持久记忆系统。无 RAG、无向量库、无运行时 LLM 调用——纯 Markdown + git。

> English: [README.md](README.md).

## 简介 — 解决什么问题？

**长期记忆多但不费 token。** 如果把所有记忆一股脑塞进提示词，记忆越多每个会话烧的 token 越贵。DSWM 默认只加载**索引**（小、每个会话自动注入），主题文件在任务需要时**按需读取**。

**轻量，不上重型机制。** LLM-Wiki 那套系统功能强但重、维护困难，对大多数用户没必要。DSWM 的所有记忆就是简单的 `.md` 文件——手动改、或让 agent 改都行，所见即所得。

**记忆跨 harness 共享。** 长期记忆应该属于你，而不是属于某一个 harness。DSWM 的纯 md 记忆文件随时可以共享给其他 harness 使用——只需要把对应 harness 的 `AGENTS.md`（或等效文件）指向它即可。

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

## 兼容性

- 已用 DSH 10.33.0（web profile，`dsh-agent-instructions` 基线注入）验证。
- 最后验证日期：2026-08-18。
- 依赖 DSH 原生 `dsh-agent-instructions` 机制（`dsh-base` bundle 默认启用）；若你的部署禁用了它，记忆注入将不生效。

## 安装

> **注意**：目前仅支持 GitHub 安装——本包**尚未发布到 npm**。

```bash
dsh plugin --profile web add github:rainow/dsh-simple-wiki-memory
```

首次启动自动：同步 AGENTS.md 骨架、创建 vault 目录、git init `workspace/`。**幂等、只合并、绝不覆盖**你已有的 `~/.dsh/AGENTS.md` 索引条目。

## 卸载

```bash
dsh plugin --profile web remove dsh-simple-wiki-memory
```

移除插件会停止运行时钩子（自动 commit、pending 汇报），但**保留你的数据**：`~/.dsh/AGENTS.md` 和 `~/.dsh/workspace/` 不会被删除。六条规则仍留在 AGENTS.md（它是 agent 遵循的纯文本）；想彻底移除就手动删掉那段。

## 快速上手

1. 安装（见上）；首次启动自动创建 vault。
2. 任何会话里让 agent 记住某事——它会写入 `pending/`。
3. 说 **"存档/确认"** → 把 pending 草稿晋升为正式记忆。
4. 说 **"整理记忆"** → 触发重组流程（执行前需你确认）。
5. 自带 **`memory-query`** 技能处理检索（含目录扫描兜底）。

## 配置

v0.1 无用户可见配置项，默认值安全。计划（v0.2）：settings 段提供 TTL 天数、自动 commit 开关、记忆目录路径。

## 权限与数据

- **文件**：读写 `~/.dsh/AGENTS.md` 和 `~/.dsh/workspace/`（创建 `reference/`、`pending/`、`archive/`、`memory-log.md`；把规则段合并进 AGENTS.md——绝不覆盖你的索引条目）。
- **命令**：在 `~/.dsh/workspace/` 内执行 `git init / add / commit`（自动备份）。
- **无网络、无凭据、无遥测。**
- 读取记忆在**任何**沙箱模式下都可行（DSH 的 read 从不被沙箱限制）。写入 `~/.dsh/workspace/` 需要 `danger-full-access`，或 `workspace-write` + 按需批准升级。

## 故障排查

- **自动 commit 不生效**：检查 `~/.dsh/workspace/.git` 是否存在；若 git 不可用，插件会优雅降级（记忆仍工作，只是没有备份）。
- **记忆未注入**：确认你的 profile/preset 启用了 `dsh-agent-instructions`（它负责自动加载 AGENTS.md）。
- **回滚**：vault 是 git 仓库——`git -C ~/.dsh/workspace log` / `git -C ~/.dsh/workspace reset --hard <commit>`。

## 开发

```bash
node --check lib/index.js   # 语法检查
```

包结构：`lib/index.js`（同步 + 钩子）、`assets/`（AGENTS.md / memory-log 模板）、`skills/memory-query/`。采用 DSH bundle 分发模型（`dsh.bundle.patch` → `cordis.patch.yml`）。

## License

MIT
