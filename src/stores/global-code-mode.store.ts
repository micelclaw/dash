import { createStore } from 'zustand/vanilla';
import { globalCodeModeService, type CodeModeAttempt, type GlobalCodeModeSnapshot, type GlobalCodeModeChoice } from '@/services/global-code-mode.service';
type Pending = { desired: GlobalCodeModeChoice; revision: string; client_nonce?: string; change_id?: string; proposed_revision?: string };
interface State {
  owner: string | null; observed: GlobalCodeModeSnapshot | null; draft: GlobalCodeModeChoice | null;
  phase: 'loading' | 'ready' | 'saving' | 'error' | 'uncertain' | 'prepared'; error: string | null;
  initialize(owner: string): Promise<void>; refresh(): Promise<void>; choose(value: GlobalCodeModeChoice): Promise<void>; resume(): Promise<void>;
}
function browserStorage() { try { return typeof window === 'undefined' ? undefined : window.sessionStorage; } catch { return undefined; } }
export function createGlobalCodeModeStore(client = globalCodeModeService, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined = browserStorage()) {
  let pending: Pending | null = null, blocked = false, generation = 0, read = 0;
  const key = (owner: string) => `micelclaw.code-mode.pending.${owner}`;
  return createStore<State>((set, get) => {
    function persist() { const owner = get().owner; if (!storage || !owner || !pending) throw Error('Tracking unavailable'); storage.setItem(key(owner), JSON.stringify(pending)); }
    function consume(value: CodeModeAttempt) {
      const owner = get().owner;
      if (!pending?.client_nonce || value.attempt.client_nonce !== pending.client_nonce || pending.change_id && value.change_id !== pending.change_id) throw Error('Unrelated attempt');
      pending.change_id = value.change_id; persist();
      const receipt = value.receipt;
      if (receipt) {
        if (receipt.user_id !== owner || receipt.before_revision !== pending.revision || !pending.proposed_revision || receipt.proposed_revision !== pending.proposed_revision || receipt.result.code_mode.configured !== pending.desired || receipt.result.code_mode.presence !== 'explicit') throw Error('Unrelated receipt');
        storage!.removeItem(key(owner!)); blocked = false; pending = null;
        set({ observed: receipt.result.code_mode, draft: null, phase: 'ready', error: null }); return;
      }
      if (value.state === 'human_action_required') set({ phase: 'prepared', error: 'This proposal is saved but not confirmed as applied. Apply it explicitly or keep waiting; refreshing never sends it.' });
      else set({ phase: 'uncertain', error: 'No persistent terminal receipt is available. The change remains blocked and will not be resent.' });
    }
    async function send() {
      if (!pending?.change_id) return;
      const g = generation; set({ phase: 'saving', error: null });
      try { const value = await client.write(pending.change_id); if (g === generation) consume(value); }
      catch { if (g === generation) set({ phase: 'uncertain', error: 'The response was not confirmed. Check this attempt; no change will be resent automatically.' }); }
    }
    return {
      owner: null, observed: null, draft: null, phase: 'loading', error: null,
      async initialize(owner) {
        if (get().owner === owner) return;
        generation++; pending = null; blocked = false;
        try { const raw = storage?.getItem(key(owner)); if (raw) { blocked = true; const p = JSON.parse(raw) as Pending; if ([false, 'auto'].includes(p.desired) && typeof p.revision === 'string') pending = p; } } catch { blocked = true; }
        set({ owner, observed: null, draft: pending?.desired ?? null, phase: blocked ? 'uncertain' : 'loading', error: blocked ? 'Recovering the same attempt without resending it.' : null }); await get().refresh();
      },
      async refresh() {
        if (get().phase === 'saving') return;
        const g = generation, r = ++read;
        if (!blocked) set({ phase: 'loading', error: null });
        if (blocked && pending?.client_nonce) {
          try { const value = pending.change_id ? await client.result(pending.change_id) : await client.current(pending.client_nonce); if (g !== generation || r !== read) return;
            if (value) consume(value); else set({ phase: 'uncertain', error: 'No attempt was found for this correlation. Absence is not proof of rejection; nothing will be resent.' });
          } catch { if (g !== generation || r !== read) return; set({ phase: 'uncertain', error: 'The attempt cannot be verified. Its pending marker is preserved; nothing will be resent.' }); }
        }
        try { const observed = await client.read(); if (g !== generation || r !== read) return;
          set({ observed, ...blocked ? {} : { phase: 'ready', error: null } });
          if (blocked && !pending?.client_nonce) set({ phase: 'uncertain', error: 'This older request has no recoverable attempt identity. A matching value cannot confirm it; no change will be resent.' });
        } catch { if (g !== generation || r !== read) return; set({ observed: null, phase: blocked ? 'uncertain' : 'error', error: 'Code Mode is unavailable. Its current value is unknown; the pending request, if any, remains blocked.' }); }
      },
      async choose(desired) {
        const state = get(); if (state.phase !== 'ready' || blocked || !state.observed || !state.owner) return;
        const g = generation; blocked = true; read++; set({ phase: 'saving', draft: desired, error: null });
        try { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(desired))); if (g !== generation) return; pending = { desired, revision: state.observed.revision, client_nonce: crypto.randomUUID(), proposed_revision: Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('') }; persist(); }
        catch { if (g !== generation) return; pending = null; blocked = false; set({ phase: 'error', draft: desired, error: 'This browser cannot safely track the request. No change was sent.' }); return; }
        try { const value = await client.prepare({ enabled: desired, expected_revision: pending.revision, client_nonce: pending.client_nonce! }); if (g !== generation) return; consume(value); }
        catch { if (g === generation) set({ phase: 'uncertain', error: 'Preparation was not confirmed. Check the same correlation; no change has been resent.' }); return; }
        if (get().phase === 'prepared') await send();
      },
      async resume() { if (get().phase === 'prepared' && pending?.change_id) { read++; await send(); } },
    };
  });
}
export const globalCodeModeStore = createGlobalCodeModeStore();
