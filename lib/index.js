/**
 * dsh-simple-wiki-memory (DSWM) — Simple Wiki Memory for DeepSeek Harness.
 *
 * A self-maintaining persistent memory system:
 *   - syncs the AGENTS.md skeleton (seven-branch maintenance convention) into
 *     ~/.dsh/AGENTS.md (merge-only; never clobbers the user's index entries),
 *   - scaffolds ~/.dsh/workspace/{reference,reference/skills,pending,archive}/
 *     + memory-log.md,
 *   - initializes a git repo over ~/.dsh/workspace for backup/rollback,
 *   - auto-commits memory changes after each turn,
 *   - reports pending (unconfirmed) memory items at the start of a user turn,
 *   - tells the user's agent when its AGENTS.md rules are older than the
 *     shipped template (the agent merges them; this plugin never rewrites an
 *     existing rules section).
 *
 * Rule versions: v1 = untagged (no `dswm:rules` marker, ≤0.2.0), v2 = the
 * marker plus per-tool memory under reference/skills/ (first shipped here).
 *
 * Distribution: a cordis plugin package with `dsh.bundle.patch` →
 * `cordis.patch.yml`; install via `dsh plugin --profile web add <pkg>`.
 *
 * Source: https://github.com/rainow/dsh-simple-wiki-memory (MIT)
 */

import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const name = "dsh-simple-wiki-memory";

/** Files the plugin ships (relative to this package root). */
const AGENTS_TEMPLATE = "assets/AGENTS.md.template";
const LOG_TEMPLATE = "assets/memory-log.md.template";
const SKILLS_ABOUT_TEMPLATE = "assets/skills-about.md";

/** Rules-section version shipped by this plugin version (see the header). */
const TEMPLATE_RULES_VERSION = 2;

/** Version tag the agent writes back after merging: `<!-- dswm:rules v=2 -->`. */
const RULES_MARKER_RE = /<!--\s*dswm:rules\s+v=(\d+)\s*-->/;

/** Section fences inside AGENTS.md (prefix match covers v1 and v2 headings). */
const RULES_START = "## 持久记忆维护规则";
const INDEX_HEAD = "## 记忆索引";

/** Feature probe: a rules section mentioning this has the v2 per-tool memory. */
const SKILLS_MEMORY_PROBE = "reference/skills/";

/** Resolve the DSH home dir (~/.dsh unless DSH_HOME overrides). */
function resolveDshHome(env = process.env, home = homedir()) {
	const raw = env.DSH_HOME;
	if (raw !== void 0 && raw.trim() !== "") {
		const expanded = raw.startsWith("~/") ? join(home, raw.slice(2)) : raw;
		return isAbsolute(expanded) ? expanded : join(process.cwd(), expanded);
	}
	return join(home, ".dsh");
}

/** Path of the plugin package root (…/dsh-simple-wiki-memory). */
function packageRoot() {
	return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

/**
 * Merge the plugin-owned rules section into the user's AGENTS.md.
 *
 * Never overwrites user content: the "记忆索引" section and anything below it
 * is user data, and an existing rules section is never rewritten — an outdated
 * one is reported back so the user's agent can merge it deliberately.
 *
 * @param dshHome - resolved DSH home directory.
 * @returns `rulesUpgrade` with `{ have, want }` when the on-disk rules are older
 *   than the template and the v2 feature probe is absent; otherwise null.
 */
function mergeAgentsTemplate(dshHome) {
	const target = join(dshHome, "AGENTS.md");
	const template = readFileSync(join(packageRoot(), AGENTS_TEMPLATE), "utf8");
	if (!existsSync(target)) {
		writeFileSync(target, template);
		return { rulesUpgrade: null };
	}
	const current = readFileSync(target, "utf8");
	if (!current.includes(RULES_START)) {
		const rulesBlock = template.slice(template.indexOf(RULES_START), template.indexOf(INDEX_HEAD)).trimEnd();
		const idx = current.indexOf(INDEX_HEAD);
		const updated = idx === -1
			? `${current.trimEnd()}\n\n${rulesBlock}\n\n${INDEX_HEAD}\n`
			: `${current.slice(0, idx).trimEnd()}\n\n${rulesBlock}\n\n${current.slice(idx)}`;
		writeFileSync(target, updated);
		return { rulesUpgrade: null };
	}
	const marker = RULES_MARKER_RE.exec(current);
	const have = marker === null ? 1 : Number(marker[1]);
	if (!Number.isFinite(have) || have >= TEMPLATE_RULES_VERSION) return { rulesUpgrade: null };
	// Feature fallback: the agent merged v2 but never wrote the marker back.
	if (current.includes(SKILLS_MEMORY_PROBE)) return { rulesUpgrade: null };
	return { rulesUpgrade: { have, want: TEMPLATE_RULES_VERSION } };
}

/** Scaffold workspace dirs, memory-log, skills guide, and the git repo. Idempotent. */
function scaffoldWorkspace(dshHome) {
	const ws = join(dshHome, "workspace");
	for (const sub of ["reference", "reference/skills", "pending", "archive"]) {
		mkdirSync(join(ws, sub), { recursive: true });
	}
	const logPath = join(ws, "memory-log.md");
	if (!existsSync(logPath)) {
		writeFileSync(logPath, readFileSync(join(packageRoot(), LOG_TEMPLATE), "utf8"));
	}
	const about = join(ws, "reference", "skills", "_about.md");
	if (!existsSync(about)) {
		writeFileSync(about, readFileSync(join(packageRoot(), SKILLS_ABOUT_TEMPLATE), "utf8"));
	}
	if (!existsSync(join(ws, ".git"))) {
		try {
			execFileSync("git", ["init", "-q"], { cwd: ws, stdio: "ignore" });
		} catch {
			/* git unavailable — memory still works, just without backup */
		}
	}
	return ws;
}

/** Commit pending git changes in the workspace, if any. Never throws. */
function maybeCommit(ws) {
	if (!existsSync(join(ws, ".git"))) return;
	try {
		const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ws, encoding: "utf8" });
		if (dirty.trim() === "") return;
		execFileSync("git", ["add", "-A"], { cwd: ws, stdio: "ignore" });
		execFileSync("git", ["-c", "user.name=dsh-memory", "-c", "user.email=memory@dsh.local",
			"commit", "-m", `memory: auto checkpoint ${new Date().toISOString().slice(0, 16)}`],
		{ cwd: ws, stdio: "ignore" });
	} catch {
		/* commit failure is non-fatal */
	}
}

/** List pending items as a short user-visible summary ('' when none). */
function pendingSummary(ws) {
	try {
		const dir = join(ws, "pending");
		if (!existsSync(dir)) return "";
		const items = readdirSync(dir).filter((f) => f.endsWith(".md"));
		if (items.length === 0) return "";
		return `【DSWM】有 ${items.length} 条待确认记忆（~/.dsh/workspace/pending/）：\n${items.map((f) => `- ${f}`).join("\n")}\n说"存档/确认"可晋升到正式记忆，或忽略。`;
	} catch {
		return "";
	}
}

/**
 * Bilingual instruction telling the agent how to merge newer rules.
 *
 * The plugin deliberately does not edit the rules section itself: the agent
 * reads both files and merges only what changed, so user customisation and the
 * index section survive. Backup is mandatory, and unattended sessions must not
 * touch the file.
 *
 * @param upgrade - `{ have, want }` rule versions.
 * @returns the message text injected as a user message.
 */
function rulesUpgradeHint({ have, want }) {
	const templatePath = join(packageRoot(), AGENTS_TEMPLATE);
	return `【DSWM 规则升级 / Rules upgrade】v${have} → v${want}

v2 新增：技能记忆（skill / MCP 的稳定事实与坑点 → reference/skills/）、写入前定归属两问、出错即回报、记录规范（删除测试 / 三类禁写 / 预算）、安全红线。
v2 adds: per-tool memory (reference/skills/), a write-time placement test, error feedback, lean-recording rules and a secrets red line.

请按下面步骤合并 / Merge as follows:
1. read 新规则全文 / read the new rules: ${templatePath}
2. read ~/.dsh/AGENTS.md
3. 只把**新增或变化**的部分并入「持久记忆维护规则」区；**保留**用户自定义内容与整个「记忆索引」区，不要整体覆盖。
   Merge only new or changed parts into the rules section; keep user customisation and the whole index section — never overwrite wholesale.
4. **先备份 / back up first**: cp ~/.dsh/AGENTS.md ~/.dsh/AGENTS.md.bak-<今天日期>
5. 合并后在规则区顶部加一行 / then add this line at the top of the rules section: <!-- dswm:rules v=${want} -->
6. 向用户简述改了哪些规则 / tell the user what changed.

无人值守会话（定时任务 / 后台 subagent）：**不要改文件**，只写一条 pending 记录提醒用户手动处理。
Unattended sessions (scheduled task / background subagent): do NOT edit files; write a pending note instead.
用户暂时不想升级就忽略，下次会话会再提醒 / ignore to postpone; this reminder returns next session.`;
}

/** Plugin entry. Never throws — a memory plugin must never brick the harness. */
export function apply(ctx, config = {}) {
	let ws;
	let rulesUpgrade = null;
	try {
		const dshHome = resolveDshHome();
		ws = scaffoldWorkspace(dshHome);
		({ rulesUpgrade } = mergeAgentsTemplate(dshHome));
	} catch (error) {
		console.warn(`[dswm] init failed (memory plugin disabled): ${error?.message ?? error}`);
		return;
	}
	const reported = new WeakSet();
	// Rules upgrade is announced once per process, not once per agent: subagents
	// are separate agents and would otherwise repeat it (and write pending notes).
	let upgradeHinted = false;

	// Auto-commit after each turn (debounced per session via WeakMap of timers).
	const timers = new WeakMap();
	ctx.on("session/event", (session, event) => {
		if (event?.type !== "turn/end") return;
		const old = timers.get(session);
		if (old !== void 0) clearTimeout(old);
		timers.set(session, setTimeout(() => {
			timers.delete(session);
			maybeCommit(ws);
		}, 1500));
	});

	// First user turn of a session: rules-upgrade notice and/or pending report.
	ctx.on("agent/pre-step", async (payload, next) => {
		const decision = await next();
		if (decision?.kind !== "enter") return decision;
		const agent = payload?.agent;
		if (agent === void 0) return decision;
		const texts = [];
		if (rulesUpgrade !== null && !upgradeHinted) {
			upgradeHinted = true;
			texts.push(rulesUpgradeHint(rulesUpgrade));
		}
		if (!reported.has(agent)) {
			const summary = pendingSummary(ws);
			if (summary !== "") {
				reported.add(agent);
				texts.push(summary);
			}
		}
		if (texts.length === 0) return decision;
		const messages = texts.map((text) => createUserMessage({
			content: [{ type: "text", text }],
			// dsh 0.2 removed the shared catch-all `plugin` source kind: every
			// producer declares its own kind through MessageSourceMap
			// augmentation (see lib/types/index.d.ts). `dswm` is ours.
			source: { kind: "dswm" }
		}));
		return { ...decision, messages: [...decision.messages, ...messages] };
	}, { prepend: true });
}

export default { name, apply };
