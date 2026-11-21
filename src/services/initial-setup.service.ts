import { api,ApiError } from './api';
import type { SetupProgress } from '@/components/onboarding/progress';
import type { User } from '@/types/auth';
export interface InitialAuthStatus { mode: 'setup' | 'single_user' | 'multi_user'; requires_setup: boolean; owner_exists?:boolean; ownership_recovery_required?:boolean; auto_login?: boolean; access_token?: string; user?: User }
export async function initialAuthStatus(): Promise<InitialAuthStatus> {
  if(typeof document!=='undefined'&&document.querySelector('meta[name="micelclaw-startup"][content="installed-vite-v1"]')){
    const preparation=await api.installationReadiness();
    if(!preparation.ready)throw new ApiError('INSTALLATION_PREPARING','Preparando Micelclaw');
  }
  const response = await api.get<{data: InitialAuthStatus}>('/auth/status', undefined, {timeout: 5000});
  const status = response?.data;
  if (!status || !['setup', 'single_user', 'multi_user'].includes(status.mode)
      || typeof status.requires_setup !== 'boolean'
      || (status.mode === 'setup') !== status.requires_setup) throw new Error('Estado inicial del servicio no válido');
  return status;
}
export async function createOwner(body: {display_name: string; email: string; password: string}) {
  return api.post<{data: {user: User; access_token?: string; refresh_token?: string; refresh_token_id?: string}; tier?: User['tier']}>('/auth/setup', body);
}
export async function confirmInitialSession() { return (await api.get<{data: User}>('/auth/me')).data; }

export async function readInitialProgress() { return (await api.get<{data:SetupProgress | null}>('/initial-setup/progress')).data; }
export async function saveInitialProgress(progress:SetupProgress) { return (await api.put<{data:SetupProgress}>('/initial-setup/progress',progress)).data; }
