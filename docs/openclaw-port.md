# DSWM for OpenClaw —— 纯文本方案

> v0.3 · 2026-10-29 · 状态：**已落地**（并入本仓库 `openclaw/` 子目录，见 §3）
> v0.2 = 纯文本方案；v0.1 = 可行性调研 + 三方案对比

---

## 0. 结论

**三个文件、一段安装话术，就这样。**

- **纯文本**：不写 hook、不做插件、不做 skill，全部是 markdown。
- **不上 ClawHub**：仓库挂 GitHub，谁想用就把安装话术发给自己的 agent。
- **范围**：技能记忆（`reference/skills/`）+ 主题记忆（`reference/<主题>.md`）**都要**；OpenClaw 原生的 `MEMORY.md` / `USER.md` / `memory/` 一行不改。
- **位置**：并入本仓库 `openclaw/` 子目录。一个仓库两种装法——DSH 走 `dsh plugin add`，OpenClaw 走粘贴话术；`package.json` 的 `files` 是白名单，`openclaw/` **不进 npm 包**（`npm pack` 实测 11 个文件，无 `openclaw/`、无 `docs/`）。

体量：规则 4.7 KB（2 374 字符）+ 目录说明 2.6 KB + 安装话术 0.6 KB。全部是人能通读的文本，没有一行可执行代码。

---

## 1. 相对 v0.1 改了什么

| 项 | v0.1 方案 | 现在 | 原因 |
|---|---|---|---|
| 载体 | skill（ClawHub 发布） | 纯 markdown，无 skill | 规则只要在 `AGENTS.md` 里就每次会话都注入，比 skill（要被"想到"才加载）更强制 |
| 自动汇报 pending | hook 注入 | 规则：会话开始 `ls pending/`（一次工具调用） | 不引入可执行代码 |
| 首次 scaffold | hook 自动建目录 | 安装话术里一次性 `mkdir` + 写文件 | 安装本来就是一次性动作 |
| 分发 | ClawHub | GitHub 仓库 | 不想为发而发；装的人少，一段话术够用 |
| 主题记忆层 | 建议不搬 | **搬** | 见 §2.1：`memory/` 的形态对"明确主题"确实低效 |
| 升级提示 / 版本标记 | hook 检查 | 保留 `<!-- dswm-oc:rules v=1 -->` 标记，靠人看 | 没有 npm 版本耦合，不需要自动提示 |

顺带一个必须知道的坑：**OpenClaw 的 dreaming 会重写 `MEMORY.md`**（deep 阶段由模型决定 additions / merges / supersessions，还会做 append compaction），所以索引**不能**放 `MEMORY.md`——会被自动整理冲掉。`AGENTS.md` 不会被自动重写（只在缺失时 seed 模板），索引放这里安全。

---

## 2. 设计要点

### 2.1 三处分工：为什么 `reference/` 要保留

OpenClaw 原生的 `memory/YYYY-MM-DD.md` 是**流水账**：按天切、按时间堆、靠 `memory_search` 语义检索。它对"今天发生了什么"很好用，但对"这个主题的完整事实"很差：

- 同一主题的事实散在十几天的文件里，读一次要搜好几轮；
- 没有"覆盖更新"的概念，旧结论和新结论并列，检索出来还得自己判断哪个新；
- 没法 review——你想核对"我的点餐偏好"是否还准确，得翻一堆日志。

所以分工定死：

| 位置 | 角色 | 谁读 |
|---|---|---|
| `reference/<主题>.md` | **明确主题的权威文件**（唯一真相，覆盖更新，可 review） | 按索引按需读 |
| `reference/skills/<id>.md` | **技能记忆**（工具专有标识符 + 踩坑，skill 更新后会丢的东西） | 用该工具前先读 |
| `memory/YYYY-MM-DD.md` | 草料场：当天流水、一次性观察（原生，可搜） | 回溯时才搜 |
| `MEMORY.md` | 原生长期事实（**交给 dreaming 管，不碰**） | 原生每会话注入 |
| `USER.md` | 原生用户画像（不碰） | 原生每会话注入 |
| `pending/` | 未确认候选，不参与检索 | 会话开始 `ls` |
| `AGENTS.md` | 规则 + 索引（只放指针，不放正文） | 每次会话自动注入 |

一条判据收口：**"下次要用时，我希望读一个文件，还是翻一堆日志？"** 一个文件 → `reference/`。

### 2.2 为什么索引放 `AGENTS.md`

- OpenClaw 每个会话都注入 `AGENTS.md`（20 000 字符/文件上限），索引天然"一直在"；
- `MEMORY.md` 虽然也注入，但**只在主会话**，且 dreaming 会重写它（§1 末尾）；
- 索引条目只写「主题 + 相对路径 + 一句话（日期）」，单条 ≤80 字，不放内容 → 群聊场景即使被注入也只泄漏主题名。

### 2.3 没有 skill，会不会漏事

不会，而且更强：

- skill 的加载路径是"模型看见 `<available_skills>` 里的名字 → 决定 read `SKILL.md`"——依赖模型临场判断；
- `AGENTS.md` 是**无条件注入**，规则始终在上下文里。

代价是 `AGENTS.md` 变大（规则 4.7 KB + 索引）。OpenClaw 默认模板约 7 KB，加完约 12–13 KB，离 20 000 字符上限还有余量；索引涨到 100 条（约 5 KB）时再考虑拆。

### 2.4 没有 hook 的代价（明确接受）

| 原本 hook 干的 | 现在谁干 | 备注 |
|---|---|---|
| 会话开始汇报 pending | 规则：`ls pending/` | 一次工具调用；`pending/` 空时也要 ls，成本极低 |
| 首次建目录 / 写 `_about.md` | 安装话术 | 一次性 |
| 规则版本检查 | 人 | 标记留在文件里，升级时自己 diff |
| 防止"记错地方" | 规则第 2 步 + `_about.md` 六问 | **纯规则是唯一防线**，所以措辞要狠、判据要短 |

最后一条是这套方案真正的关键：没有代码兜底，就靠**判据够短、够狠**让人和模型都不容易走偏。

---

## 3. 仓库产物

```text
dsh-simple-wiki-memory/
├── lib/  assets/  skills/  cordis.patch.yml   # DSH 插件（一行不动）
├── openclaw/                                  # OpenClaw 纯文本版（不进 npm 包）
│   ├── README.md            # 差异清单 + 安装话术 + 验收 + 维护约定
│   ├── AGENTS.fragment.md   # 规则正文，4.7 KB，安装时追加进 AGENTS.md
│   └── reference/
│       └── _about.md        # 安装到工作区 reference/_about.md 的目录约定，2.6 KB
├── docs/openclaw-port.md    # 本方案（设计记录）
├── README.md                # 顶部一行指向 openclaw/
└── LICENSE
```

三个 OpenClaw 文件，没有构建、没有依赖、没有版本脚本。改规则 = 改一个 md 文件。

---

## 4. 规则草案（`AGENTS.fragment.md`，4.7 KB / 2 374 字符）

> 这是要 review 的主体。整段会被追加进用户的 `AGENTS.md` 末尾。

````markdown
<!-- dswm-oc:rules v=1 -->
## 持久记忆维护规则（DSWM）

### 0 · 三处分工（先认清谁管什么）
| 位置 | 管什么 | 何时读 |
|---|---|---|
| `reference/<主题>.md` | **明确主题的权威文件**：偏好、约定、领域事实、本机常量 | 动手前按索引读 |
| `reference/skills/<id>.md` | 技能记忆：某 skill / MCP 的专有标识符与踩坑 | 用该工具前**先读** |
| `memory/YYYY-MM-DD.md` | 当天流水、一次性观察（原生，可被搜索） | 需要回溯时搜 |
| `pending/` | 未确认候选，不参与检索 | 会话开始 `ls` |
| `AGENTS.md` | 本规则 + 索引（只放指针，不放正文） | 每次会话自动注入 |

**权威顺序**：同一主题只有一个权威文件 `reference/<主题>.md`。`memory/` 是草料场，不是主题记忆的存放处；`MEMORY.md` 只留跨主题硬约束与指针，不复制正文。

### 1 · 写入触发
产生值得长期记住的信息（偏好、约定、决策、教训、环境事实）时**立即**处理，不等会话结束、不默默丢弃。

### 2 · 准入：先定归属
1. 含**工具专有标识符**（参数名、code/id、端点、错误码、限流、必填组合）→ `reference/skills/`（MCP 用 `mcp-<server>.md`）
2. 无专有标识符、换工具仍成立（口味、住址、作息、称呼）→ `reference/<主题>.md`
3. 两类都有 → 主体进 `skills/`，跨工具可复用的偏好加一行指针
4. 犹豫超过一秒 → **问用户**，不猜
5. 拟定的主题名里含工具或服务名 → 大概率是技能记忆
6. 只对"今天"成立 → `memory/YYYY-MM-DD.md`，不进 reference

### 3 · reference 与 memory/ 的边界（别把主题记忆写散）
- 有明确主题、需要**聚合 / 覆盖更新 / 人工 review** → `reference/`
- 同一主题又写第二遍 → **更新那份权威文件**，不要新增第三处
- `memory/` 里沉淀出稳定主题 → 提炼进 `reference/`；流水保留，但不再作为依据
- 判断标准：**"下次要用时，我希望读一个文件，还是翻一堆日志？"** 一个文件 → reference

### 4 · 记录规范（精简优先）
- **删除测试**：删掉这行，下次操作会出错吗？不会 → 删。记**下次要用的最小指令集**，不记这次的实验报告
- **三类禁写**：① 文档 / schema 已声明的 ② 能现场查到的（地址全称、价格、营业时间、余额） ③ 会随时间变的
- **形态**：事实用表 `| 用途 | 值 |`；坑点写一行祈使句 + 结论；不写推导过程与实测数字
- **预算**：技能记忆 ≤ **6 KB / 80 行**；主题文件 ≤ **12 KB**；索引单条 ≤ **80 字**
- **超预算**：先按上面三条压缩；压不下去 → 向用户申请，不默默超限

### 5 · 技能记忆（四道闸，全过才写）
1. `SKILL.md` 里已有？→ 不存（流程归 skill，会随更新走）
2. 是稳定外部事实（ID / 房间 / 端点 / 配额 / 账号名）？→ 存
3. 来自一次真实失败或纠错？→ 存；既非 2 也非 3 → 不存
4. 含密码 / token / 密钥 / 无关个人安全细节？→ **禁止写入**
与 `SKILL.md` 重复的段落以 `SKILL.md` 为准；本文件只留**skill 更新后会丢**的内容。

### 6 · pending 与确认
- 未确认 → `pending/<日期>-<来源>.md`；不参与检索、不进索引
- 你主导的会话**开始**时：`ls pending/`，有内容则先汇报（一次工具调用）
- 你确认（"存档 / 确认 / save"）→ 按第 2 步归属落盘 → 更新索引 → 记 memory-log
- 与已有记录冲突：标 ⚠️，两条都留，提醒用户判断，绝不静默取其一

### 7 · 检索顺序
1. 用任何 skill / MCP 之前：`ls reference/skills/`，有同名文件（或 `mcp-<server>.md`）→ 整篇读完再动手
2. 任务与索引某条相关 → 读对应 `reference/<主题>.md`
3. 索引没有 → 扫一遍 `reference/`，不要直接认定"没有记忆"

### 8 · 出错即回报
记忆与实际不符时：先在条目上标 `❓待核实（日期）`，**不改数**；写 pending 写清「原记录 X / 实际 Y / 证据」；当场告诉用户；确认后再改，并更新文件头 `verified_at`。

### 通用约束
- 索引格式：`- [主题](reference/主题.md) — 一句话（日期）`，单条 ≤ **80 字**
- **安全红线**：永不写入密码 / token / 密钥 / 身份证 / 银行卡 / 与用途无关的家庭安全细节
- 每次写入、晋升、归档 → `memory-log.md` 追加一行；工作区是 git 仓库，改完 `git add -A && git commit`

## 记忆索引

（安装时在此追加指针；`reference/skills/` 不进索引）
````

---

## 5. 目录说明草案（`reference/_about.md`，2.6 KB）

装到工作区后**按需读**的细则，不占每会话预算。包含：

1. 两种文件的区别（主题文件 vs 技能记忆）与命名规则（`mcp-<server>.md` / `<skill-id>.md`）
2. 归属六问（与规则第 2 步一致，便于单文件自解释）
3. **主题文件模板**（frontmatter `topic` / `verified_at` + 一句话结论 + 事实表 + 坑）
4. **技能记忆模板**（frontmatter `skill:` 或 `mcp:` / `verified_at` + 事实表 + 坑）
5. 八条硬规则：不写凭据、不写无关安全细节、`SKILL.md` 已有的不抄、冲突标 ⚠️、表格优先、删除测试、预算、更新即改 `verified_at`
6. 定期 review：`verified_at` > 90 天逐个确认；同主题合并；过时移 `archive/`

全文见**附录 A**（约 2 600 字节），可直接 review。

---

## 6. 安装流程

### 人看（30 秒）

```bash
git clone https://github.com/rainow/dsh-simple-wiki-memory
```

打开 `openclaw/README.md`，把「30 秒安装」那段话术整段复制发给你的 agent，把 `<repo>` 换成仓库路径。

### 给 agent 的话术（`openclaw/README.md` 里的同一段）

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

### 卸载

删 `AGENTS.md` 里 `<!-- dswm-oc:rules v=1 -->` 到 `## 记忆索引` 整段，再 `rm -rf reference pending archive memory-log.md`。`memory/`、`MEMORY.md`、`USER.md` 从没动过，不用管。

---

## 7. 验收（装完自己跑一遍）

1. 【脚本·已验】`AGENTS.md` 里有 `dswm-oc:rules v=1`，且 `git diff` 只有追加（实测 67 行全加、0 行删）；
2. 【脚本·已验】`reference/`、`reference/skills/`、`pending/`、`archive/`、`memory-log.md` 都在；
3. 【脚本·已验】`reference/_about.md` 与仓库里 `openclaw/reference/_about.md` 逐字节一致（`cmp`）；
4. 【真机】新会话开头，agent 会 `ls pending/` 并汇报（先投一个假文件）；
5. 【真机】说"记住我点餐偏好" → 落在 `reference/food-preferences.md`，并追加索引一行；
6. 【真机】说一条 MCP 的 `code` → 落在 `reference/skills/mcp-<server>.md`，且**不进索引**；
7. 【真机】问同一主题的旧信息 → 读的是 `reference/` 里的权威文件，不是 `memory/` 日志。

1–3 已在临时工作区用脚本跑过（见 §3 的 `docs/` 记录）；4–7 需要真实 OpenClaw 会话。

---

## 8. 风险与取舍

| 项 | 说明 | 缓解 |
|---|---|---|
| `AGENTS.md` 体积 | 规则 4.7 KB + 默认模板约 7 KB + 索引，13 KB 上下；上限 20 000 **字符** | README 写清"索引超过 100 条就把老条目移进 `reference/index.md`" |
| 没有代码兜底 | 记错位置、忘了 pending、超预算——全看规则与模型自觉 | 判据压到最短；第 2 步 + 第 3 步的"同一主题只更新一处"是最重要的两条 |
| 隐私过滤未验证 | OpenClaw 文档只说 bootstrap 有 session/privacy filtering，规则未公开 | 索引只放主题名与路径，不放内容；真在意就自己试群聊 |
| `MEMORY.md` 归 dreaming | dreaming 会重写 `MEMORY.md`，所以规则明确"不往里放索引/主题正文" | 已在 §0 说明，写进规则的"权威顺序"一行 |
| OpenClaw 版本漂移 | 本方案基于 `2026.10.8` 的文档（`AGENTS.md` 注入、`skills/`、`memory/` 约定） | 都是核心机制，短期不易变；README 标注核对版本 |
| 与 DSH 版分叉 | 两份规则会各自演进 | 共用同一套术语与判据文本；DSH 版有插件能力，OpenClaw 版只少 4 条 hook 相关 |

---

## 9. 已定事项（2026-10-29）

| 事项 | 决定 | 理由 |
|---|---|---|
| 仓库形态 | 并入 `openclaw/` 子目录 | 一个仓库、两种装法；GitHub 一个入口，不用维护两处 |
| npm 分发 | `openclaw/` 不进包 | `files` 是白名单，`npm pack` 实测 11 个文件；DSH 用户不需要这 10 KB |
| `pending/` | 保留 | "先暂存、后确认"是这套记忆的安全阀，省 0.5 KB 不值 |
| `MEMORY.md` 指针 | 不加 | dreaming 会重写 `MEMORY.md`，写了也可能被冲掉 |
| 分发渠道 | GitHub + 粘贴话术 | 不上 ClawHub，不为发而发 |

落地记录：`openclaw/{README.md, AGENTS.fragment.md, reference/_about.md}`；主 README 顶部加一行指向；DSH 插件代码一行未动（`lib/`、`assets/`、`cordis.patch.yml`、`package.json` 的 `version` 均无变化）。

---

## 附录 A：`reference/_about.md` 草案全文（2.6 KB）

> 装到工作区 `reference/_about.md`，按需读，不占每会话预算。

````markdown
# reference/ 目录约定

这个目录放**按主题聚合的长期记忆**。规则在 `AGENTS.md` 的「持久记忆维护规则」里，本文件只讲怎么写、怎么 review。

## 两种文件

| 目录 | 放什么 | 特征 |
|---|---|---|
| `reference/<主题>.md` | 明确主题的权威文件：偏好、约定、领域事实、本机常量 | 会被反复读、会被覆盖更新 |
| `reference/skills/<id>.md` | 技能记忆：某 skill / MCP 的专有标识符与踩坑 | 只在用该工具时读；不进索引 |

`skills/` 下的文件名：MCP 用 `mcp-<server>.md`，skill 用 `<skill-id>.md`（尽量与 SKILL.md 的 `name` 同名）。

## 怎么判断该写哪个

1. 里面有工具专有标识符（参数名、code/id、端点、错误码、限流）？→ `skills/`
2. 换一个工具做同样的事还成立？→ `reference/<主题>.md`
3. 两类都有 → 主体进 `skills/`，跨工具的偏好加一行指针
4. 犹豫超过一秒 → 问用户
5. 主题名里含工具 / 服务名 → 大概率是技能记忆
6. 只对今天成立 → `memory/YYYY-MM-DD.md`

## 主题文件模板

```markdown
---
topic: 主题名
verified_at: 2026-10-29
---

一句话结论。

| 用途 | 值 |
|---|---|
| … | … |

## 坑
- 现象 → 结论（祈使句，一行）
```

## 技能记忆模板

```markdown
---
skill: mcd            # 或 mcp: blender
verified_at: 2026-10-29
note: 只保留 SKILL.md 覆盖不到、且 skill 更新后会丢失的内容
---

| 用途 | 标识符值 |
|---|---|
| 默认门店 | … |

## 坑
- … → …
```

## 硬规则

1. **不写凭据**：密码、token、API key、身份证、银行卡；URL 带凭据只存去掉凭据的部分
2. **不写无关安全细节**：门锁、备用钥匙、独处时间等，只记完成任务必需的信息
3. **重复不写**：`SKILL.md` 已声明的流程不抄进技能记忆；抄了就等着和更新打架
4. **冲突标 ⚠️**：两条都留 + 提醒用户判断，绝不静默取其一
5. **表格优先**：一字段一列；坑点一行祈使句 + 结论；不写推导过程和实测数字
6. **删除测试**：删掉这行下次会出错吗？不会就删
7. **预算**：主题文件 ≤ 12 KB；技能记忆 ≤ 6 KB / 80 行；超了先压缩，压不下去问用户
8. **更新即改 `verified_at`**：这是 review 的抓手，不写变更日志

## 定期 review

- `verified_at` 超过 **90 天**的技能记忆 → 逐个确认是否仍准确
- 同一主题分散在多个文件 → 合并，保留一份权威文件
- 过时 / 被合并的内容 → 移到 `archive/`，不直接删除
````
