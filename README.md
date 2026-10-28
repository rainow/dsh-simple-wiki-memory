# DSWM — DeepSeek Harness 简易 Wiki 记忆插件

超级简化版 llm-wiki 记忆插件，三层各司其职：

**① 索引** 一份文档，每个会话自动加载 · **② 主题** 每个 topic 一个 md，任务相关时才 read · **③ 技能** 每个 skill 一个 md（与 skill 同名），调用该 skill 时自动读

所以**索引既不随记忆变多、也不随工具变多而膨胀**。纯 Markdown + git，安装卸载都没有压力，想怎么改就怎么改。

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）原生 `dsh-agent-instructions`（AGENTS.md）机制的自维护持久记忆系统。无 RAG、无向量库、无运行时 LLM 调用。

> 当前版本 **v0.3.0**（2026-10-28）· [更新记录](#更新记录) · English: [README.en.md](README.en.md)

## 30 秒上手

```bash
dsh plugin --profile web add dsh-simple-wiki-memory
```

装完即用。首次启动自动同步 `~/.dsh/AGENTS.md`、创建 `~/.dsh/workspace/` 并 git init——**幂等、只合并、绝不覆盖**你已有的索引条目。

三句最常用的话：

| 你说 | 它做 |
|---|---|
| （任何时候）记住… | 写进 `pending/`，下次会话开头提醒你 |
| **"存档 / 确认"** | 把待确认草稿晋升为正式记忆 + 更新索引 |
| **"整理记忆"** | 输出重组方案（拆分 / 合并 / 归档），你确认后执行 |

工具细节也照此办理：说"记住我常点的套餐 code"，它会落到 `reference/skills/`，而不是塞进索引。

## 它是怎么工作的

每个会话第一个请求前，DSH 自动注入 `~/.dsh/AGENTS.md`（索引 + 规则）。DSWM 维护它和一个小型 wiki 库：

```
~/.dsh/
├── AGENTS.md              # ① 索引 + 七条规则（每会话自动注入）
└── workspace/             # 记忆库（git 仓库）
    ├── reference/         # ② 主题记忆（进索引、参与检索）
    │   └── skills/        # ③ 技能记忆（不进索引，按工具名直接查）
    ├── pending/           # 待确认草稿（不参与检索）
    ├── archive/           # 过时内容（保留、不参与检索）
    └── memory-log.md      # 追加式操作日志（审计 + 新鲜度）
```

**三处分工**：

| 放哪 | 存什么 | 何时读 | 进索引 |
|---|---|---|---|
| `AGENTS.md` 索引 | 一句话主题 + 完整路径 | 每个会话 | — |
| `reference/<主题>.md` | 跨工具的偏好与事实（口味、住址、称呼） | 索引命中时 | ✅ |
| `reference/skills/<工具>.md` | 某 skill / MCP 的稳定事实（ID、枚举、端点、必填参数）与坑点 | 用该工具前按名字查 | ❌ |

例：麦当劳 MCP 的门店 `storeCode`、套餐 `code`、取餐方式枚举 → `skills/mcp-mcd.md`；"我不吃香菜" → `reference/`。

## 七条规则一览

规则全文在 `AGENTS.md` 里（每个会话都注入给 agent），这里只做速览：

| # | 规则 | 一句话 |
|---|---|---|
| 1 | 写入触发 | 产生即写 `pending/`，不等会话结束、不默默丢弃 |
| 2 | 准入流程 | 先定归属 → 落 pending → 你说"存档"才晋升；技能记忆另有四道闸 |
| 3 | 无人值守 | 定时任务 / 后台 subagent 只写 pending，也不得改 AGENTS.md |
| 4 | 定期整理 | "整理记忆" → 拆分 / 合并 / 归档，你确认后执行；含预算巡检与 SKILL.md 去重 |
| 5 | 备份 | `workspace/` 是 git 仓库，记忆变更后自动 commit |
| 6 | 检索 | 用工具前先查 `skills/` → 再查索引 → 最后扫目录兜底 |
| 7 | 出错即回报 | 记忆与实际不符：先标 `❓待核实` **绝不静默改数**，报你确认后再改 |

配套的**记录规范**（v0.3.0）：删除测试（"删掉它下次会出错吗"）、三类禁写（schema 已声明 / 能现场查到 / 会变的）、预算（技能记忆 6KB/80 行、reference 12KB、索引条目 80 字）、超预算需你批准；**安全红线**：永不写入凭据与无关的个人安全细节。

## 兼容性

- 已用 DSH **0.2.1-rc.2** 实测（源码对照 + 官方兼容性判定函数），兼容 0.1.0-rc.7 起全部 0.1.x / 0.2.x 发布线。
- `engines.dsh` = `>=0.1.0-rc.7 <0.2.0-0 || >=0.2.0-rc.1 <0.3.0-0`。DSH 0.2+ 会据此阻止不满足要求的版本安装 / 激活；0.3.x 未声明（届时需升级 DSWM，或 `dsh plugin allow-version` 临时豁免）。
- 依赖 DSH 原生 `dsh-agent-instructions`（`dsh-base` bundle 默认启用）；部署若禁用它，记忆不会注入。

## 安装

**npm（推荐，支持市场自动更新）**

```bash
dsh plugin --profile web add dsh-simple-wiki-memory
```

**源码安装**：`dsh plugin --profile web add github:rainow/dsh-simple-wiki-memory`

**交给 agent**：把 https://github.com/rainow/dsh-simple-wiki-memory 丢进会话，让它装。

> 指定版本要写全：`dsh plugin --profile web add dsh-simple-wiki-memory@0.3.0`。不写版本号时，已有的精确版本**不会**自动升级。

## 卸载

```bash
dsh plugin --profile web remove dsh-simple-wiki-memory
```

停掉运行时钩子（自动 commit、pending 汇报），但**保留你的数据**：`AGENTS.md` 和 `workspace/` 都不会被删。七条规则仍留在 AGENTS.md（它只是 agent 遵循的纯文本）；想彻底移除就手动删掉那一段。

## 权限与数据

- **文件**：读写 `~/.dsh/AGENTS.md` 与 `~/.dsh/workspace/`（创建 `reference/`、`reference/skills/`、`pending/`、`archive/`、`memory-log.md`）
- **命令**：在 `workspace/` 内执行 `git init / add / commit`
- **无网络、无凭据、无遥测**
- 读取记忆在任何沙箱模式下都可行；写入 `workspace/` 需要 `danger-full-access`，或 `workspace-write` + 按次批准升级

## 故障排查

- **自动 commit 不生效**：检查 `~/.dsh/workspace/.git`。git 不可用时插件优雅降级——记忆照常工作，只是没有备份
- **记忆没被注入**：确认启用了 `dsh-agent-instructions`
- **规则像是旧版**：`AGENTS.md` 顶部应有 `<!-- dswm:rules v=2 -->`。缺失时插件会在下个会话提示 agent 合并（会先强制备份 `AGENTS.md.bak-<日期>`）
- **回滚**：vault 是 git 仓库 —— `git -C ~/.dsh/workspace log` / `git -C ~/.dsh/workspace reset --hard <commit>`

## 开发

```bash
node --check lib/index.js
```

包结构：`lib/index.js`（同步 + 钩子）、`assets/`（AGENTS.md / memory-log / skills-about 模板）、`skills/memory-query/`。采用 DSH bundle 分发模型（`dsh.bundle.patch` → `cordis.patch.yml`）。

## 已知问题：锚定模式

<details>
<summary>liangshen（梁神模式）/ Anchored Standard 下记忆不会自动加载</summary>

这两种模式会在会话首轮清空运行时上下文、只保留你的直接消息，从而**屏蔽 `dsh-agent-instructions` 对 `~/.dsh/AGENTS.md` 的注入**。DSWM 的索引与规则正是靠这个注入生效的，所以与会话开头不会自动加载记忆。

这不是 bug，而是锚定模式的刻意设计（用最小上下文锚定推理轨迹）。需要读写记忆时手动让 agent 读即可：

- `先读一下 ~/.dsh/AGENTS.md 再开始`
- 或 `按 AGENTS.md 里的记忆规则处理`
- liangshen 模式在首块锚定晋升（进入"we can"模式）后也可以手动读，之后记忆规则即按 DSWM 正常运作
- 其余会话（非锚定模式）不受影响

</details>

## 更新记录

### v0.3.0（2026-10-28）— 技能记忆 + 记录规范

- 规则从六分支扩为七分支：新增**技能记忆**（`reference/skills/`）、**写入前定归属**、**出错即回报**；
- 新增**记录规范**（删除测试 / 三类禁写 / 表格化 / 预算 / 超限申请）——治理记忆文件越写越啰嗦的问题；
- 新增**安全红线**（禁写凭据与无关的个人安全细节）；
- 规则区引入版本标记 `<!-- dswm:rules v=2 -->`，老用户首个会话收到中英双语**升级提示**（agent 合并 + 强制备份，插件不改用户文件）；
- `scaffoldWorkspace` 创建 `reference/skills/` 与 `_about.md`；`memory-query` 技能增加按工具检索入口；
- 本地验证：新装 / 旧版升级 / 已最新 / 漏写标记 / 缺规则区 / pending 汇报 共 19 项断言全通过。

### v0.2.0（2026-10-19）— 兼容 DSH 0.2.x

- **适配 DSH 0.2.1-rc.2 / 0.2.1-alpha.x / 0.2.0-rc.x，以及 0.1.6 / 0.1.7**：新增 `engines.dsh` 声明 `>=0.1.0-rc.7 <0.2.0-0 || >=0.2.0-rc.1 <0.3.0-0`，peerDependencies 同步扩展到九条发布线；
- **重要：DSH 0.2 起会强制校验插件版本要求**——`engines.dsh`（优先）或 peerDependencies 不满足时，**会直接阻止插件安装与激活**。旧版 DSWM（≤0.1.3）在 0.2.x 上会被拦截，必须升级到本版；
- **修复 0.2 的破坏性变更**：DSH 0.2 移除了共享的 `plugin` 消息来源类型（"there is no shared catch-all `plugin` kind"），改为每个生产者通过 `MessageSourceMap` 声明自己的 kind。DSWM 现声明并使用自己的 `dswm` kind（`lib/types/index.d.ts` 含类型扩展，运行时消费者对未知 kind 自动透传）；
- 逐项对照 `dsh-v0.2.1-rc.2` 源码验证：`session/event` + `turn/end`、`agent/pre-step`（agent 注入与 `{kind:'enter', messages}` 决策形状不变）、`createUserMessage`、cordis 4.0.5 `prepend`、patch `insert`、`dsh.bundle.patch` —— 全部兼容；
- 已用 DSH 0.2.1-rc.2 **真实兼容性判定函数实测**：0.1.0-rc.8 ~ 0.2.1-rc.2 全部通过（0.3.x 暂不声明，届时会提示升级，可用 `dsh plugin allow-version` 临时豁免）；
- 安装/升级：`dsh plugin --profile web add dsh-simple-wiki-memory`。

### v0.1.3（2026-09-10）— 兼容 DSH 0.1.5-rc（含 0.1.3）

- **适配 DSH 0.1.5-rc.2 / 0.1.5-rc.1 / 0.1.5-alpha.x / 0.1.3-alpha.x**：peerDependencies 扩展为 `^0.1.0-rc.7 || ^0.1.1-rc.2 || ^0.1.2-alpha.1 || ^0.1.3-alpha.1 || ^0.1.5-alpha.1`，覆盖五条发布线（老版本用户不受影响）；
- 逐项对照 `dsh-v0.1.5-rc.2` 源码验证：`session/event` + `turn/end`、`agent/pre-step`（agent 注入与决策形状不变）、`createUserMessage`、cordis 4.0.2 `prepend`、patch `insert`、`dsh.bundle.patch` —— 全部兼容；
- **已确认 DSWM 不受 0.1.3/0.1.5 的破坏性变更影响**：0.1.3 的 Session persistence `SessionHandle` 重构、0.1.5 的「移除 `ctx.agent`」与 Web 插件面板 Slot 迁移，DSWM 均未使用（只用 `session/event` 与 `agent/pre-step` 两个钩子）；
- 安装/升级：`dsh plugin --profile web add dsh-simple-wiki-memory`。

### v0.1.2（2026-08-28）— 兼容 DSH 0.1.2-alpha

- **适配 DSH 0.1.2-alpha.1 / 0.1.2-alpha.2**：peerDependencies 扩展为 `^0.1.0-rc.7 || ^0.1.1-rc.2 || ^0.1.2-alpha.1`，覆盖 `0.1.0-rc.7+` / `0.1.1-rc.2+` / `0.1.2-alpha.1+` 三条发布线；
- 运行时 API（`session/event`、`agent/pre-step`、消息构造、cordis patch 等）已对照 `dsh-v0.1.2-alpha.2` 源码逐项验证，**无破坏性变更**；
- 安装/升级：`dsh plugin --profile web add dsh-simple-wiki-memory`（npm 源自动取最新版）。

### v0.1.1（2026-08-25）— 首个 npm 发布

- 发布到 npm（`dsh-simple-wiki-memory`），支持 dsh-market 版本显示与自动更新；新增 GitHub Actions 自动发布（打 `v*` tag 即发布）；
- 适配 DSH 0.1.1-rc.2：peerDependencies 覆盖 `0.1.0-rc.7+` 与 `0.1.1-rc.2+`；
- README 补充与 liangshen / Anchored Standard 锚定模式的兼容性说明。

### v0.1.0（2026-08-18）— 初始版本

- 记忆规则系统：索引自动注入 + 每主题一个 md 按需读取；pending → reference → archive 三区 + memory-log 审计 + git 自动备份；
- 运行时钩子：回合结束自动 commit、会话开始 pending 汇报；
- AGENTS.md 只合并不覆盖，卸载保留全部数据。

## License

MIT
