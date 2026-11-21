import type { ProductivityArea, ProductivityContext } from './types';
import { titles } from './types';

export interface ProductivityTabReference { version: 'micelclaw-productivity-preview/v1'; id: string; conversation_id: string; area: ProductivityArea; title: string; erp_profile_id: string | null; resource_id: string }
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
/** Untrusted local references are only lookup hints; never restore data, HTML or a lease from storage. */
export function parseProductivityTabReference(raw: unknown, conversationId: string): ProductivityTabReference | null {
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
 const data = raw as Record<string, unknown>; const area = data.area as ProductivityArea;
 if (!Object.prototype.hasOwnProperty.call(titles, area) || data.version !== 'micelclaw-productivity-preview/v1' || !uuid(data.id) || data.conversation_id !== conversationId) return null;
 if (typeof data.resource_id !== 'string' || !new RegExp(`^productivity:${area}:[a-f0-9]{32}$`).test(data.resource_id)) return null;
 if (['inventory', 'F1', 'F2', 'F6'].includes(area) ? !uuid(data.erp_profile_id) : data.erp_profile_id !== null) return null;
 return { version: data.version, id: data.id, conversation_id: conversationId, area, title: titles[area], erp_profile_id: data.erp_profile_id as string | null, resource_id: data.resource_id };
}
export function parseProductivityContext(raw: unknown, area: ProductivityArea): ProductivityContext | null {
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
 const data = raw as Record<string, unknown>; const selection = data.selection as { action?: unknown; params?: unknown } | undefined;
 if (data.version !== 'micelclaw-productivity-preview/v1' || data.area !== area || !uuid(data.id) || !uuid(data.conversation_id) || !selection || typeof selection.action !== 'string' || !selection.params || typeof selection.params !== 'object' || Array.isArray(selection.params)) return null;
 if (['inventory', 'F1', 'F2', 'F6'].includes(area) ? !uuid(data.erp_profile_id) : data.erp_profile_id !== null) return null;
 try {
  const serialized = JSON.stringify(selection.params); if (serialized.length > 8192) return null;
  const clean = JSON.parse(serialized, (key, value) => { if (/(?:token|password|secret|lease|proof|html)|^_(?:origin_context|conversation_id|ui)$/.test(key.toLowerCase())) throw Error('Unsafe descriptor'); return value; });
  return { version: data.version, id: data.id, conversation_id: data.conversation_id, area, title: titles[area], selection: { action: selection.action, params: clean }, erp_profile_id: data.erp_profile_id as string | null };
 } catch { return null; }
}
