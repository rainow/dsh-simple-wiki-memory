# DSWM for OpenClaw —— 纯文本版

给 [OpenClaw](https://openclaw.ai)（`2026.10.8`）用的持久记忆：**三个 markdown 文件，没有插件、没有 hook、没有可执行代码**。

判据与写法同源于 [DSH 版](../README.md)，但**机制不同**：OpenClaw 每个会话都会把工作区 `AGENTS.md` 全量注入（单文件 20 000 字符上限），所以索引写在这里就"天然一直在"，不需要任何注入代码。

```
AGENTS.fragment.md      → 追加进 <workspace>/AGENTS.md（规则 + 索引）
reference/_about.md     → <workspace>/reference/_about.md（目录约定，按需读）
README.md               → 你正在看的这份（差异清单 + 安装话术）
```

## 装什么

| 装到 | 内容 | 读的时机 |
|---|---|---|
| `<workspace>/AGENTS.md` | 规则（4.7 KB）+ 记忆索引（指针） | 每次会话自动注入 |
| `<workspace>/reference/_about.md` | 命名规则、两个模板、八条硬规则、review 方法 | 需要查细则时 |
| `<workspace>/reference/` | 主题文件：**明确主题的权威文件** | 按索引按需读 |
| `<workspace>/reference/skills/` | 技能记忆：工具专有标识符与踩坑 | 用该工具前先读 |
| `<workspace>/pending/`、`archive/`、`memory-log.md` | 待确认草稿 / 归档 / 变更日志 | — |

`MEMORY.md`、`USER.md`、`memory/` **一行不改**：它们归 OpenClaw 原生（`memory/` 是流水草料场，`MEMORY.md` 归 dreaming 管理）。分工写在规则第 0 节。

## 30 秒安装

把下面这段整段复制，替换 `<repo>` 后发给你自己的 agent：

```text
把 DSWM 持久记忆装进当前工作区。按顺序执行，每步做完再进下一步，
不要改动 MEMORY.md / USER.md / memory/ 的既有内容：

1. 备份：cp AGENTS.md AGENTS.md.bak-$(date +%F)（AGENTS.md 不存在则跳过）
2. 合并规则：读 <repo>/openclaw/AGENTS.fragment.md，把从 <!-- dswm-oc:rules v=1 -->
   到 ## 记忆索引 整段【追加】到 AGENTS.md 末尾；若已存在 dswm-oc:rules
   标记，停下来告诉我，不要重复追加
3. 建目录：mkdir -p reference/skills pending archive
4. 写说明：把 <repo>/openclaw/reference/_about.md 写到 reference/_about.md
5. 建日志：memory-log.md 不存在则按「通用约束」的格式建一个
6. 汇报：改了哪个文件、建了哪些目录、AGENTS.md 当前字符数（上限 20000）

<repo> = 本仓库路径，或 https://github.com/rainow/dsh-simple-wiki-memory
```

装完重新开一个会话，让 agent 复述一遍规则——能说出「同一主题只有一个权威文件」就说明注入生效了。

## 装完的样子

```text
<workspace>/
├── AGENTS.md                  # 原内容 + 末尾追加的规则与索引
├── reference/
│   ├── _about.md              # 目录约定
│   └── skills/                # 技能记忆（不进索引）
├── pending/                   # 未确认候选
├── archive/                   # 过时内容
├── memory-log.md              # 一行一次变更
└── memory/  MEMORY.md  USER.md   # 原生，未改动
```

## 与 DSH 版的差异清单

两边共享判据与写法，**只有这三处必须分叉**。改任何一边时，对照这张表：

| # | 差异 | DSH 版 | OpenClaw 版 |
|---|---|---|---|
| 1 | **三处分工** | 只有 `reference/` + 技能记忆 | 多一层「`memory/YYYY-MM-DD.md` 是草料场、不是主题记忆存放处」，因为 OpenClaw 本来就有按天切日志 |
| 2 | **索引位置与标记** | `~/.dsh/AGENTS.md`，标记 `<!-- dswm:rules v=2 -->` | 工作区 `AGENTS.md`，标记 `<!-- dswm-oc:rules v=1 -->`；不写 `MEMORY.md`（dreaming 会重写它） |
| 3 | **pending 汇报** | 插件把汇报注入会话首条消息 | 规则要求会话开始 `ls pending/`（一次工具调用） |

其余内容（第 2 步归属判据、记录规范、技能记忆四道闸、检索顺序、出错即回报、预算、安全红线）两边**逐字同源**，以 DSH 版为准。

## 验收

装完自己跑一遍。标【真机】的要在 OpenClaw 里实际对话，其余可用一次脚本核对：

1. 【脚本】`AGENTS.md` 里有 `<!-- dswm-oc:rules v=1 -->`，且 `git diff` 只有追加、老内容一字未动
2. 【脚本】`reference/`、`reference/skills/`、`pending/`、`archive/`、`memory-log.md` 都在
3. 【脚本】`reference/_about.md` 与仓库里这份逐字节一致
4. 【真机】新会话开头，agent 会 `ls pending/`（先投一个假文件）
5. 【真机】说「记住我点餐偏好」→ 落在 `reference/food-preferences.md`，索引多一行
6. 【真机】说一条 MCP 的 `code` → 落在 `reference/skills/mcp-<server>.md`，且**不进索引**
7. 【真机】问同一主题的旧信息 → 读 `reference/` 权威文件，而不是 `memory/` 日志

## 卸载

```bash
# 1. 删 AGENTS.md 里 <!-- dswm-oc:rules v=1 --> 到 ## 记忆索引 整段（含索引条目）
# 2. 删目录与日志
rm -rf reference pending archive memory-log.md
```

`memory/`、`MEMORY.md`、`USER.md` 从没被改过，不用管。

## 维护约定

- **权威版本**：共享判据以 [DSH 版](../assets/AGENTS.md.template) 为准，本目录只改上面那三处；
- **改动顺序**：先改 DSH 版 → 再对照差异清单改这里 → 两边同步更新各自的 README；
- **本目录独立版本**：`dswm-oc:rules v=1`，不随 npm 包版本走（`package.json` 的 `files` 不含 `openclaw/`，npm 包里没有这个目录）；
- **不新增可执行内容**：这里只放 markdown。需要自动化的部分（pending 注入、scaffold、规则版本检查）用 DSH 版插件，不往这里加。

## 来源

- 设计说明与取舍：[../docs/openclaw-port.md](../docs/openclaw-port.md)
- 同源实现（DSH 插件）：[../README.md](../README.md)
- 核对版本：OpenClaw `2026.10.8` 文档（`AGENTS.md` 注入、`skills/`、`memory/`、dreaming）
