/**
 * dsh-simple-wiki-memory (DSWM) type declarations.
 */
import type { Context } from '@deepseek-ai/cordis';

/** User-facing plugin configuration (all optional with safe defaults). */
export interface Config {
	/** Override the DSH home directory (defaults to $DSH_HOME or ~/.dsh). */
	dshHome?: string;
	/** Auto-commit memory changes after each turn (default true). */
	autoCommit?: boolean;
	/** Report pending items at the start of a user turn (default true). */
	pendingReport?: boolean;
}

declare module '@deepseek-ai/cordis' {
	interface Context { }
}

/**
 * The pending-report message is attributed to this plugin.
 *
 * dsh 0.2 dropped the shared catch-all `plugin` source kind; each producer
 * now declares its own through `MessageSourceMap` augmentation. Consumers
 * fall through unknown kinds, so `dswm` needs no renderer of its own.
 */
declare module '@deepseek-ai/dsh-llm' {
	interface MessageSourceMap {
		dswm: { readonly kind: 'dswm' };
	}
}

/** Cordis plugin entry. */
export function apply(ctx: Context, config?: Config): void;

declare const plugin: { name: string; apply: typeof apply };
export default plugin;
