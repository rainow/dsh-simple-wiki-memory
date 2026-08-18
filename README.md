# DSWM — Simple Wiki Memory for DeepSeek Harness

A self-maintaining persistent memory system for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH). Built on the native `dsh-agent-instructions` (AGENTS.md) mechanism — no RAG, no vector DB, no LLM calls at runtime. Just Markdown + git.

> 简体中文说明见 [README.zh.md](README.zh.md)。

## What it does

Every session, DSH auto-injects `~/.dsh/AGENTS.md` (the memory **index + rules**) before the first request. DSWM maintains that file plus a small wiki vault:

```
~/.dsh/
├── AGENTS.md              # index + six-rule maintenance convention (auto-injected)
└── workspace/             # the vault (a git repo)
    ├── reference/         # confirmed memory topics (indexed, searchable)
    ├── pending/           # unconfirmed drafts (NOT indexed; waiting for your "存档")
    ├── archive/           # outdated topics (kept, not searched)
    └── memory-log.md      # append-only operation log (audit + freshness)
```

### The six rules (all in AGENTS.md, injected into every session)

1. **Write trigger** — check at session end for memorable info.
2. **Admission** — unconfirmed → `pending/`; say "存档/确认" to promote to `reference/` + update index + log. TTL: 7d (interactive) / 30d (unattended).
3. **Unattended sessions** (task-board timers, background subagents) — write `pending/` only, never promote themselves.
4. **Periodic cleanup** — say "整理记忆" → agent proposes reorganization (split/merge/rename/archive), you approve, outdated content goes to `archive/`.
5. **Backup** — `workspace/` is a git repo; auto-commit after memory changes.
6. **Retrieval** — check the index first; if no match, scan `reference/` (fallback), never assume "no memory".

## Install

```bash
# from GitHub (recommended)
dsh plugin --profile web add github:<owner>/dsh-simple-wiki-memory

# or from npm once published
dsh plugin --profile web add dsh-simple-wiki-memory
```

First startup syncs the skeleton, scaffolds the vault, and git-inits `workspace/` — idempotent, merge-only, never clobbers your existing `~/.dsh/AGENTS.md` index entries.

## Usage

- Say **"存档/确认"** to promote pending drafts into confirmed memory.
- Say **"整理记忆"** to trigger the reorganization workflow (you approve before it executes).
- The bundled **`memory-query`** skill handles retrieval with the directory-scan fallback.
- Any session that relates to past preferences/decisions/facts should query memory first.

## Permission note

Reading memory works in **any** sandbox mode (reads are never sandboxed in DSH). Writing to `~/.dsh/workspace/` requires `danger-full-access`, or `workspace-write` with per-call approval escalation.

## Development

```bash
npm install        # install peer deps for type checking
node --check lib/index.js
```

The plugin follows the DSH bundle pattern (`dsh.bundle.patch` → `cordis.patch.yml`), same as `dsh-liangshen` / `dsh-vision-router`.

## License

MIT
