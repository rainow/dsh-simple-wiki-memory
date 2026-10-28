# DSWM — Simple Wiki Memory for DeepSeek Harness

A radically simple llm-wiki-style memory plugin with three layers, each doing one job:

**① Index** — one document, auto-loaded into every session · **② Topics** — one markdown file per topic, read only when the task needs it · **③ Tools** — one markdown file per skill (named after the skill), read automatically when that skill is used

So the **index never grows with your memory count, and never grows with your tool count**. Plain Markdown + git — no RAG, no vector DB, no runtime LLM calls. Install and uninstall are painless; everything is editable by hand.

Built on DSH's native `dsh-agent-instructions` (AGENTS.md) mechanism.

> Current version **v0.3.0** (2026-10-28) · [Changelog](#changelog) · 中文: [README.md](README.md)

## Quick start

```bash
dsh plugin --profile web add dsh-simple-wiki-memory
```

That's it. On first startup the plugin syncs `~/.dsh/AGENTS.md`, creates `~/.dsh/workspace/` and runs `git init` — idempotent, **merge-only, never overwriting** your existing index entries.

Three phrases you'll actually use:

| You say | It does |
|---|---|
| "remember …" (any time) | writes to `pending/`, reported at the start of your next session |
| **"save" / "confirm"** | promotes pending drafts into real memory + updates the index |
| **"organize memory"** | proposes a reorganisation (split / merge / archive); you approve, then it executes |

Tool details work the same way: say "remember the combo code I always order" and it lands in `reference/skills/` — not in the index.

## How it works

Before the first request of every session, DSH auto-injects `~/.dsh/AGENTS.md` (index + rules). DSWM maintains that file plus a small wiki vault:

```
~/.dsh/
├── AGENTS.md              # ① index + seven rules (injected into every session)
└── workspace/             # the vault (a git repo)
    ├── reference/         # ② topic memory (indexed, searchable)
    │   └── skills/        # ③ per-tool memory (not indexed; looked up by tool name)
    ├── pending/           # unconfirmed drafts (not searched)
    ├── archive/           # outdated content (kept, not searched)
    └── memory-log.md      # append-only operation log (audit + freshness)
```

**Who holds what:**

| Where | What | When read | In index |
|---|---|---|---|
| `AGENTS.md` index | one-line topic + full path | every session | — |
| `reference/<topic>.md` | cross-tool preferences and facts (taste, address, how you're addressed) | when an index entry matches | ✅ |
| `reference/skills/<tool>.md` | stable facts about one skill / MCP server (IDs, enums, endpoints, required params) and gotchas | right before using that tool, by name | ❌ |

Example: a food-delivery MCP's store `storeCode`, combo `code`s and pickup enums → `skills/mcp-mcd.md`; "I don't eat cilantro" → `reference/`.

## The seven rules at a glance

The full text lives in `AGENTS.md` (injected into every session); this is just the cheat sheet:

| # | Rule | In one line |
|---|---|---|
| 1 | Write trigger | Capture as it appears → straight into `pending/`; never wait for session end |
| 2 | Admission | Classify first → `pending/` → promote only when you say "save"; per-tool memory has four extra gates |
| 3 | Unattended | Scheduled tasks / background subagents write `pending/` only and never touch AGENTS.md |
| 4 | Cleanup | "organize memory" → split / merge / archive, executed only after your approval; includes budget audit and SKILL.md de-duplication |
| 5 | Backup | `workspace/` is a git repo; auto-commit after memory changes |
| 6 | Retrieval | Before using a tool: check `skills/` → then the index → then scan the directory as a fallback |
| 7 | Report on mismatch | When memory is wrong: mark `❓unverified`, **never silently rewrite**, report to you, update after confirmation |

Backed by the **lean-recording rules** (v0.3.0): the delete test ("would removing this line cause a mistake?"), three things never to store (schema-declared / re-derivable by a query / time-varying), budgets (per-tool 6KB / 80 lines, reference 12KB, index entries 80 chars), over budget requires your approval — plus the **secrets red line**: never store credentials or unrelated personal-security details.

## Compatibility

- Verified against DSH **0.2.1-rc.2** (source review + the official compatibility evaluator); compatible with every 0.1.x / 0.2.x release line from 0.1.0-rc.7.
- `engines.dsh` = `>=0.1.0-rc.7 <0.2.0-0 || >=0.2.0-rc.1 <0.3.0-0`. DSH 0.2+ uses it to block installation / activation of versions outside the range; 0.3.x is not declared yet (upgrade DSWM then, or exempt temporarily with `dsh plugin allow-version`).
- Depends on DSH's native `dsh-agent-instructions` (enabled by default in the `dsh-base` bundle); if your deployment disables it, memory will not be injected.

## Install

**npm (recommended — the market shows versions and detects updates)**

```bash
dsh plugin --profile web add dsh-simple-wiki-memory
```

**From source**: `dsh plugin --profile web add github:rainow/dsh-simple-wiki-memory`

**Let the agent do it**: paste https://github.com/rainow/dsh-simple-wiki-memory into a session.

> Pin a version explicitly when you need one: `dsh plugin --profile web add dsh-simple-wiki-memory@0.3.0`. Without a version spec, an existing exact pin is **not** upgraded automatically.

## Uninstall

```bash
dsh plugin --profile web remove dsh-simple-wiki-memory
```

Removing the plugin stops the runtime hooks (auto-commit, pending report) but **keeps your data**: `AGENTS.md` and `workspace/` are not deleted. The seven rules stay in AGENTS.md (plain text your agent follows); delete that section manually if you want it gone.

## Permissions & data

- **Files**: reads/writes `~/.dsh/AGENTS.md` and `~/.dsh/workspace/` (creates `reference/`, `reference/skills/`, `pending/`, `archive/`, `memory-log.md`)
- **Commands**: runs `git init / add / commit` inside `workspace/`
- **No network, no credentials, no telemetry**
- Reading memory works in **any** sandbox mode; writing to `workspace/` requires `danger-full-access`, or `workspace-write` with per-call approval escalation

## Troubleshooting

- **Auto-commit not happening**: check `~/.dsh/workspace/.git`. Without git the plugin degrades gracefully — memory still works, just without backup
- **Memory not injected**: make sure `dsh-agent-instructions` is enabled
- **Rules look outdated**: `AGENTS.md` should carry `<!-- dswm:rules v=2 -->` near the top. When missing, the plugin asks your agent to merge the new rules in the next session (it backs up `AGENTS.md.bak-<date>` first)
- **Rollback**: the vault is a git repo — `git -C ~/.dsh/workspace log` / `git -C ~/.dsh/workspace reset --hard <commit>`

## Development

```bash
node --check lib/index.js
```

Package layout: `lib/index.js` (sync + hooks), `assets/` (AGENTS.md / memory-log / skills-about templates), `skills/memory-query/`. Distribution uses the DSH bundle model (`dsh.bundle.patch` → `cordis.patch.yml`).

## Known issue: anchored modes

<details>
<summary>liangshen / Anchored Standard — memory is not auto-loaded</summary>

Both modes clear the runtime context on the first turn and keep only your direct message, which **suppresses the automatic `~/.dsh/AGENTS.md` injection** performed by `dsh-agent-instructions`. DSWM's index and rules rely on that injection, so memory is not loaded at the start of a session.

This is not a bug — it is the deliberate design of anchored modes (anchor the reasoning trace with minimal context). Just ask the agent to read the file when you need memory:

- `read ~/.dsh/AGENTS.md first, then start`
- or `follow the memory rules in AGENTS.md`
- liangshen can also read it manually after the first block is anchored ("we can" mode); from then on DSWM behaves normally
- Other sessions (non-anchored) are unaffected

</details>

## Changelog

### v0.3.0 (2026-10-28) — per-tool memory + lean recording

- Rules grew from six branches to seven: **per-tool memory** (`reference/skills/`), **placement test before writing**, **report-on-mismatch**;
- Added **lean-recording rules** (delete test / three things never to store / tabular format / budgets / exception request) — fights memory files bloating over time;
- Added the **secrets red line** (no credentials, no unrelated personal-security details);
- Rules section now carries a version marker `<!-- dswm:rules v=2 -->`; existing users get a **bilingual upgrade notice** in their first session (agent merges + mandatory backup — the plugin never edits user files);
- `scaffoldWorkspace` creates `reference/skills/` and its `_about.md`; the `memory-query` skill gained a per-tool lookup step;
- Verified locally: fresh install / upgrade / up-to-date / marker missing / rules absent / pending report — 19 assertions, all passing.

### v0.2.0 (2026-10-19) — DSH 0.2.x compatibility

- **Compatible with DSH 0.2.1-rc.2 / 0.2.1-alpha.x / 0.2.0-rc.x, plus 0.1.6 / 0.1.7**: added an `engines.dsh` declaration `>=0.1.0-rc.7 <0.2.0-0 || >=0.2.0-rc.1 <0.3.0-0` and extended peerDependencies to nine release lines;
- **Important: DSH 0.2+ now enforces plugin version requirements** — when `engines.dsh` (preferred) or peerDependencies are unmet, the plugin is **blocked from installation and activation**. Older DSWM (≤0.1.3) is rejected on 0.2.x, so upgrading to this release is required;
- **Fixed a DSH 0.2 breaking change**: DSH 0.2 removed the shared `plugin` message source kind ("there is no shared catch-all `plugin` kind") in favour of per-producer `MessageSourceMap` augmentation. DSWM now declares and uses its own `dswm` kind (`lib/types/index.d.ts` carries the type extension; runtime consumers fall through unknown kinds);
- Verified item by item against the `dsh-v0.2.1-rc.2` source: `session/event` + `turn/end`, `agent/pre-step` (agent injection and `{kind:'enter', messages}` decision shape unchanged), `createUserMessage`, cordis 4.0.5 `prepend`, patch `insert`, `dsh.bundle.patch` — all compatible;
- Checked with the **real compatibility evaluator from DSH 0.2.1-rc.2**: 0.1.0-rc.8 through 0.2.1-rc.2 all pass (0.3.x is not declared yet — it will prompt for an upgrade, or can be exempted temporarily with `dsh plugin allow-version`);
- Install/upgrade: `dsh plugin --profile web add dsh-simple-wiki-memory`.

### v0.1.3 (2026-09-10) — DSH 0.1.5-rc compatibility (incl. 0.1.3)

- **Compatible with DSH 0.1.5-rc.2 / 0.1.5-rc.1 / 0.1.5-alpha.x / 0.1.3-alpha.x**: peerDependencies extended to `^0.1.0-rc.7 || ^0.1.1-rc.2 || ^0.1.2-alpha.1 || ^0.1.3-alpha.1 || ^0.1.5-alpha.1`, covering five release lines (older installs keep working);
- Verified item by item against the `dsh-v0.1.5-rc.2` source: `session/event` + `turn/end`, `agent/pre-step` (agent injection and decision shape unchanged), `createUserMessage`, cordis 4.0.2 `prepend`, patch `insert`, `dsh.bundle.patch` — all compatible;
- **DSWM is unaffected by the 0.1.3/0.1.5 breaking changes**: the 0.1.3 session-persistence `SessionHandle` refactor, the 0.1.5 removal of `ctx.agent`, and the Web plugin panel slot migration are all unused by DSWM (it only hooks `session/event` and `agent/pre-step`);
- Install/upgrade: `dsh plugin --profile web add dsh-simple-wiki-memory`.

### v0.1.2 (2026-08-28) — DSH 0.1.2-alpha compatibility

- **Compatible with DSH 0.1.2-alpha.1 / 0.1.2-alpha.2**: peerDependencies extended to `^0.1.0-rc.7 || ^0.1.1-rc.2 || ^0.1.2-alpha.1`, covering the `0.1.0-rc.7+`, `0.1.1-rc.2+` and `0.1.2-alpha.1+` release lines;
- Runtime APIs (`session/event`, `agent/pre-step`, message construction, cordis patch, …) verified against the `dsh-v0.1.2-alpha.2` source — **no breaking changes**;
- Install/upgrade: `dsh plugin --profile web add dsh-simple-wiki-memory` (npm source always resolves the latest).

### v0.1.1 (2026-08-25) — first npm release

- Published to npm (`dsh-simple-wiki-memory`) — dsh-market now shows the version and detects updates automatically; added a GitHub Actions auto-publish workflow (push a `v*` tag to release);
- DSH 0.1.1-rc.2 support: peerDependencies cover the `0.1.0-rc.7+` and `0.1.1-rc.2+` lines;
- Documented the known conflict with the liangshen / Anchored Standard anchored modes.

### v0.1.0 (2026-08-18) — initial release

- Memory rule system: auto-injected index + one markdown file per topic read on demand; pending → reference → archive zones + memory-log audit + git auto-backup;
- Runtime hooks: auto-commit after each turn, pending report at session start;
- AGENTS.md is merge-only (never overwrites); uninstall keeps all your data.

## License

MIT
