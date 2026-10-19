import { createSupabaseApi } from './api';
import type { CloudApi, CloudUser } from './api';
import { cloudConfig } from './config';
import type { CloudConfig } from './config';

/**
 * FR-031 (D67) one cloud connection per page. The Supabase library loads only when someone uses the cloud or when a
 * previous sign-in (stored session or an OAuth return) is present, so local-only use never touches the network.
 */
export type CloudStatus = 'off' | 'idle' | 'loading' | 'signed-out' | 'signed-in' | 'failed';
export interface CloudSessionState { readonly status: CloudStatus; readonly user: CloudUser | null; readonly signInFailed?: true }
/** Snapshot and subscription used when the build has no cloud configuration; constant so React sees no change. */
export const CLOUD_OFF: CloudSessionState = { status: 'off', user: null };
export const noSubscription = (): (() => void) => () => undefined;
export class CloudSession {
  #state: CloudSessionState = { status: 'idle', user: null }; #listeners = new Set<() => void>(); #api: Promise<CloudApi | null> | null = null;
  constructor(private readonly config: CloudConfig, private readonly factory: (config: CloudConfig) => Promise<CloudApi> = createSupabaseApi) {}
  getSnapshot = (): CloudSessionState => this.#state;
  subscribe = (listener: () => void): (() => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  #set(state: CloudSessionState): void { this.#state = state; for (const listener of [...this.#listeners]) listener(); }
  /** Loads the library once; a failed load can be retried. */
  ensure(): Promise<CloudApi | null> {
    this.#api ??= (async () => {
      this.#set({ status: 'loading', user: null });
      try {
        const api = await this.factory(this.config), user = api.user();
        api.onUser(next => this.#set({ status: next ? 'signed-in' : 'signed-out', user: next }));
        this.#set({ status: user ? 'signed-in' : 'signed-out', user });
        api.onSignInFailed(() => this.#set({ ...this.#state, signInFailed: true })); return api;
      } catch { this.#api = null; this.#set({ status: 'failed', user: null }); return null; }
    })();
    return this.#api;
  }
}
/**
 * A stored Supabase session, a sign-in still waiting for its code (the Android app may have been restarted while the
 * system browser was open), or an OAuth return (`?code=`) means the person already chose the cloud.
 */
export function cloudWasUsed(storage: Pick<Storage, 'length' | 'key'> | null, search: string): boolean {
  if (/[?&]code=/.test(search)) return true;
  try { for (let i = 0; storage && i < storage.length; i++) if (/^sb-.+-auth-token(-code-verifier)?$/.test(storage.key(i) ?? '')) return true; } catch { /* blocked storage: wait for a tap */ }
  return false;
}
const config = cloudConfig();
export const cloud: CloudSession | null = config ? new CloudSession(config) : null;
