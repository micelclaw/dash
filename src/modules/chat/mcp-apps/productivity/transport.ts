import type { Params, ProductivityArea, ProductivityResponse, ProductivityTransport } from './types';
import { UnconfirmedWriteError } from './write-outcome';

type Rpc = (method: string, params: Params, signal?: AbortSignal) => Promise<unknown>;
const object = (value: unknown): Params => value && typeof value === 'object' && !Array.isArray(value) ? value as Params : {};
/** Uses existing domain tools and their original scopes/approvals. No HTTP, session storage or credentials in the App. */
export function createProductivityTransport(rpc: Rpc): ProductivityTransport {
 // Ephemeral per-App protection, independent of editor mounts. Not a permission or a persisted lease.
 const pending = new Map<string, UnconfirmedWriteError>();
 return { async call<T>(area: ProductivityArea, action: string, params: Params, signal?: AbortSignal): Promise<ProductivityResponse<T>> {
  const domain = ['F1', 'F2', 'F6'].includes(area) ? 'finance' : area;
  if (!/^[a-z_]+$/.test(action)) throw new Error('Esta acción no está disponible.');
  for (const key of Object.keys(params)) if (/^(?:auth_token|_conversation_id|_origin_context|_ui)$/.test(key)) throw new Error('El contexto de acceso corresponde al host.');
  const writing = ['update', 'sync_edit', 'save_draft', 'card_update', 'task_update', 'comment_create', 'checklist_update', 'update_transaction'].includes(action);
  const entity = params.id ?? params.transaction_id ?? params.card_id ?? 'collection';
  // A connected-note revision can advance only after an authorized fresh read in the consumer.
  const key = JSON.stringify([domain, action, entity, params.checklist_id ?? null, action === 'sync_edit' ? params.expected_local_revision : null]);
  if (writing && pending.has(key)) throw pending.get(key)!;
  const hold = (kind: 'approval' | 'provider' | 'unknown'): never => { const error = new UnconfirmedWriteError(kind); if (writing) pending.set(key, error); throw error; };
  let result: Params;
  try { result = object(await rpc('tools/call', { name: `${domain}_${action}`, arguments: { ...params, _ui: 'productivity/v1' } }, signal)); }
  catch (error) { if (writing) hold('unknown'); throw error; }
  const body = object(result.structuredContent);
  if (body.outcome === 'approval_pending') hold('approval');
  if (body.outcome === 'provider_pending') hold('provider');
  // Native approval/error adapters do not all expose a typed execution status.
  // An MCP error bit alone cannot prove that a deferred mutation was never accepted.
  if (result.isError) { if (writing) hold('unknown'); throw new Error('No se pudo completar la operación. Comprueba el acceso o la aprobación pendiente.'); }
  if (writing && (body.ui_version !== 'productivity/v1' || body.outcome !== 'confirmed' || !('data' in body))) hold('unknown');
  if (body.ui_version !== 'productivity/v1' || !('data' in body)) throw new Error('El servidor todavía no ha activado los datos de este visor.');
  return { data: body.data as T, meta: object(body.meta) as ProductivityResponse<T>['meta'] };
 } };
}
