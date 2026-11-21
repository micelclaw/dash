import { api } from './api';
import type { ConfigHealthReport, AutoFixApplied } from '@/modules/gateway/types';

export interface ConfigHealthInspection {
  providers: 'current' | 'stale' | 'unavailable';
  authorization: 'complete' | 'partial' | 'not_checked';
  complete: boolean;
  checked_at: string;
  catalog_checked_at?: string;
}
export type InspectedConfigHealth = ConfigHealthReport & { inspection?: ConfigHealthInspection };
export interface ConfigRepairOperation {
  id: string;
  request_id: string;
  state: 'running' | 'succeeded' | 'blocked' | 'failed' | 'uncertain';
  phase: 'checking' | 'applying' | 'verifying' | 'finished';
  started_at: string;
  completed_at?: string;
  message: string;
  persisted: boolean;
  applied: boolean;
  fixes_applied: AutoFixApplied[];
  remaining_issues?: InspectedConfigHealth;
}

function receipt(value: ConfigRepairOperation): ConfigRepairOperation {
  if (!value || typeof value.request_id !== 'string' || !['running', 'succeeded', 'blocked', 'failed', 'uncertain'].includes(value.state)) {
    throw Error('El servicio todavía no ofrece seguimiento de la reparación. No se repetirá el intento automáticamente.');
  }
  return value;
}
export async function startConfigRepair(requestId: string): Promise<ConfigRepairOperation> {
  const result = await api.post<{ data: ConfigRepairOperation }>('/gateway/config-health/auto-fix', { request_id: requestId });
  return receipt(result.data);
}
export async function readConfigRepair(requestId: string): Promise<ConfigRepairOperation | null> {
  const result = await api.get<{ data: ConfigRepairOperation | null }>('/gateway/config-health/auto-fix', { request_id: requestId });
  return result.data === null ? null : receipt(result.data);
}
