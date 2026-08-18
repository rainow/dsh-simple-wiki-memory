/**
 * dsh-simple-wiki-memory (DSWM) — Simple Wiki Memory for DeepSeek Harness.
 *
 * A self-maintaining persistent memory system:
 *   - syncs the AGENTS.md skeleton (six-rule maintenance convention) into
 *     ~/.dsh/AGENTS.md (merge-only; never clobbers the user's index entries),
 *   - scaffolds ~/.dsh/workspace/{reference,pending,archive}/ + memory-log.md,
 *   - initializes a git repo over ~/.dsh/workspace for backup/rollback,
 *   - auto-commits memory changes after each turn,
 *   - reports pending (unconfirmed) memory items at the start of a user turn.
 *
 * Distribution: a cordis plugin package with `dsh.bundle.patch` →
 * `cordis.patch.yml`; install via `dsh plugin --profile web add <pkg>`.
 *
 * Source: https://github.com/<owner>/dsh-simple-wiki-memory (MIT)
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

/** Marker that fences the plugin-owned rules section inside AGENTS.md. */
const RULES_HEAD = "## 持久记忆维护规则（六分支）";
const RULES_START = "## 持久记忆维护规则";
const INDEX_HEAD = "## 记忆索引";

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
 * is user data. If the rules section already exists, it is left untouched
 * (a future version may diff-update it); if absent, it is inserted right
 * before the existing 记忆索引 section (or appended).
 */
function mergeAgentsTemplate(dshHome) {
	const target = join(dshHome, "AGENTS.md");
	if (!existsSync(target)) {
		writeFileSync(target, readFileSync(join(packageRoot(), AGENTS_TEMPLATE), "utf8"));
		return;
	}
	const current = readFileSync(target, "utf8");
	if (current.includes(RULES_HEAD)) return; // rules already present — leave user file alone
	const template = readFileSync(join(packageRoot(), AGENTS_TEMPLATE), "utf8");
	const rulesBlock = template.slice(template.indexOf(RULES_START), template.indexOf(INDEX_HEAD)).trimEnd();
	const idx = current.indexOf(INDEX_HEAD);
	const updated = idx === -1
		? `${current.trimEnd()}\n\n${rulesBlock}\n\n${INDEX_HEAD}\n`
		: `${current.slice(0, idx).trimEnd()}\n\n${rulesBlock}\n\n${current.slice(idx)}`;
	writeFileSync(target, updated);
}

/** Scaffold workspace dirs, memory-log, and the git repo. Idempotent. */
function scaffoldWorkspace(dshHome) {
	const ws = join(dshHome, "workspace");
	for (const sub of ["reference", "pending", "archive"]) mkdirSync(join(ws, sub), { recursive: true });
	const logPath = join(ws, "memory-log.md");
	if (!existsSync(logPath)) {
		writeFileSync(logPath, readFileSync(join(packageRoot(), LOG_TEMPLATE), "utf8"));
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

/** Plugin entry. */
export function apply(ctx, config = {}) {
	const dshHome = resolveDshHome();
	const ws = scaffoldWorkspace(dshHome);
	mergeAgentsTemplate(dshHome);
	const reported = new WeakSet();

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

	// Pending report: inject once per session at the first user turn.
	ctx.on("agent/pre-step", async (payload, next) => {
		const decision = await next();
		if (decision?.kind !== "enter") return decision;
		const agent = payload?.agent;
		if (agent === void 0 || reported.has(agent)) return decision;
		const summary = pendingSummary(ws);
		if (summary === "") return decision;
		reported.add(agent);
		const message = createUserMessage({
			content: [{ type: "text", text: summary }],
			source: { kind: "plugin", plugin: name }
		});
		return { ...decision, messages: [...decision.messages, message] };
	}, { prepend: true });
}

export default { name, apply };
