import { create } from 'zustand';
import { ApiError } from '@/services/api';
import { sessionsBoardApi as service, type SessionBoard, type SessionSnapshot, type SessionView, type WorkboardAgentOption } from './sessions-board.service';
interface SessionBoardsState {
  owner: string | null; generation: number; request: number; boards: SessionBoard[]; agents: WorkboardAgentOption[]; selected: string; snapshot: SessionSnapshot | null; pins: string[]; view: SessionView; loading: boolean; error: string;
  reset(owner: string | null): void; initialize(owner: string): Promise<void>; select(id: string): Promise<void>; refresh(full?: boolean): Promise<void>; setView(view: SessionView): Promise<void>; pin(id: string): Promise<void>;
}
const initial = { owner: null as string | null, generation: 0, request: 0, boards: [] as SessionBoard[], agents: [] as WorkboardAgentOption[], selected: '', snapshot: null as SessionSnapshot | null, pins: [] as string[], view: { involving_me: false, agent_id: null } as SessionView, loading: false, error: '' };
export const useSessionsBoardStore = create<SessionBoardsState>((set, get) => {
  let preferenceQueue = Promise.resolve();
  const queuedPreference = (run: () => Promise<void>) => { const task = preferenceQueue.then(run); preferenceQueue = task.catch(() => {}); return task; };
  const fail = (error: unknown) => { const denied = error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0); set({ error: error instanceof Error ? error.message : 'No se pudo leer el tablero.', loading: false, ...(denied ? { snapshot: null, boards: [], selected: '', request: get().request + 1 } : {}) }); };
  return { ...initial,
    reset(owner) { set({ ...initial, owner, generation: get().generation + 1 }); },
    async initialize(owner) {
      get().reset(owner); const generation = get().generation; set({ loading: true });
      try { const [boards, preferences, agents] = await Promise.all([service.list(), service.preferences(), service.agents()]); if (get().generation !== generation) return; const pins = preferences.pins; set({ boards, pins, agents, loading: false }); const selected = boards.some(board => board.id === preferences.last_board_id) ? preferences.last_board_id : pins.find(id => boards.some(board => board.id === id)) ?? boards[0]?.id; if (selected) await get().select(selected); }
      catch (error) { if (get().generation === generation) fail(error); }
    },
    async select(id) {
      const generation = get().generation, request = get().request + 1; set({ selected: id, snapshot: null, request, loading: true, error: '' });
      try { const view = await service.view(id); if (get().generation !== generation || get().request !== request) return; set({ view });
        await queuedPreference(async () => { if (get().generation === generation && get().selected === id) await service.saveLastBoard(id); });
        if (get().generation === generation && get().selected === id) await get().refresh(true); }
      catch (error) { if (get().generation === generation && get().request === request) fail(error); }
    },
    async refresh(full = false) {
      const { selected, generation, view, snapshot } = get(); if (!selected) return;
      const request = get().request + 1; set({ request });
      try { const result = await service.read(selected, view, full ? undefined : snapshot?.revision); if (get().generation !== generation || get().request !== request || get().selected !== selected) return;
        set({ ...('unchanged' in result ? {} : { snapshot: result }), loading: false, error: '' });
      } catch (error) { if (get().generation === generation && get().request === request) fail(error); }
    },
    async setView(view) { const { selected, generation } = get(); set({ view, snapshot: null }); try { await service.saveView(selected, view); if (get().generation === generation && get().selected === selected) await get().refresh(true); } catch (error) { if (get().generation === generation) fail(error); } },
    async pin(id) { const generation = get().generation; try { await queuedPreference(async () => { if (get().generation !== generation) return; const pins = get().pins; const result = await service.savePins(pins.includes(id) ? pins.filter(pin => pin !== id) : [...pins, id]); if (get().generation === generation) set({ pins: result }); }); } catch (error) { if (get().generation === generation) fail(error); } },
  };
});
