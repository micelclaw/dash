import { create } from 'zustand';
import { getOfficeProviders, type OfficeProviders } from './office-providers.service';
interface State extends OfficeProviders { loaded: boolean; error: string | null; refresh(): Promise<void> }
export const useOfficeProviders = create<State>(set => ({ providers: [], platform_ready: false, cutover: false, loaded: false, error: null,
  refresh: async () => {
    try { set({ ...await getOfficeProviders(), loaded: true, error: null }); }
    catch (error) { set({ providers: [], loaded: true, error: error instanceof Error ? error.message : 'No se pudieron cargar las aplicaciones Office.' }); }
  },
}));
