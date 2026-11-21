import { api } from '@/services/api';

export interface RecoveryItem {
  id: string; card_id: string; state: 'retained' | 'restoring' | 'discarding' | 'restored' | 'discarded';
  revision: number; bytes: number; created_at: number; updated_at: number;
  partial_discard?: boolean; root_retained?: boolean;
  native_retirement?: { status: 'retired' | 'pending' | 'not-started' };
}
export interface PendingRecoveryAttempt { artifact_id:string; card_id:string; operation_id:string; action:'restore'|'discard'; phase:'reserved'|'dispatched'|'uncertain'; reconcilable:boolean; retry_after_ms:number }
export interface RecoveryList { pending_attempts?:PendingRecoveryAttempt[]; items: RecoveryItem[]; used_bytes: number; limit_bytes: 2147483648; limit_kind: 'admission-threshold' }
export type RecoveryResult = Omit<RecoveryItem, 'bytes' | 'created_at' | 'updated_at'>;
const path = (cardId: string) => `/workboard/cards/${encodeURIComponent(cardId)}/recovery`;
export const workboardRecoveryApi = {
  list: (cardId: string) => api.get<{ data: RecoveryList }>(path(cardId)).then(r => r.data),
  restore: (cardId: string, item: RecoveryItem, operationId: string) => api.post<{ data: RecoveryResult }>(path(cardId), {
    operation: 'restore', id: item.id, revision: item.revision, operation_id: operationId, confirmation: 'restore-worktree',
  }).then(r => r.data),
  discard: (cardId: string, item: RecoveryItem, operationId: string) => api.post<{ data: RecoveryResult }>(path(cardId), {
    operation: 'discard', id: item.id, revision: item.revision, operation_id: operationId, confirmation: 'delete-including-new-files',
  }).then(r => r.data),
  reconcile: (cardId: string, item: RecoveryItem) => api.post<{ data: RecoveryResult }>(`${path(cardId)}/${encodeURIComponent(item.id)}/reconcile`, { revision: item.revision }).then(r => r.data),
};
