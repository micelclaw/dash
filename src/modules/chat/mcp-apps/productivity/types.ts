import type { OriginEntity } from '@/types/origins';

export type ProductivityArea = 'notes' | 'calendar' | 'contacts' | 'emails' | 'files' | 'projects' | 'inventory' | 'F1' | 'F2' | 'F6';
export type Params = Record<string, unknown>;
export interface ProductivitySelection { action: string; params: Params }
/** Presentation data only. The host revalidates identity, conversation, ACL and ERP profile on every operation. */
export interface ProductivityContext {
 version: 'micelclaw-productivity-preview/v1'; id: string; conversation_id: string;
 area: ProductivityArea; title: string; selection: ProductivitySelection; erp_profile_id: string | null;
}
export interface ProductivityPage<T> { items: T[]; total?: number; hasMore: boolean }
export interface ProductivityResponse<T> { data: T; meta?: { total?: number; has_more?: boolean }; }
export interface ProductivityTransport {
 call<T>(area: ProductivityArea, action: string, params: Params, signal?: AbortSignal): Promise<ProductivityResponse<T>>;
}
export type Entity = OriginEntity & { id: string; source?: string | null; updated_at?: string };
export const titles: Record<ProductivityArea, string> = { notes: 'Notas', calendar: 'Calendario', contacts: 'Contactos', emails: 'Correo', files: 'Archivos', projects: 'Proyectos', inventory: 'Inventario', F1: 'Resumen personal', F2: 'Cuentas y movimientos', F6: 'Resumen y rendimiento' };
export function pageOf<T>(response: ProductivityResponse<T[]>, limit: number): ProductivityPage<T> {
 if (!Array.isArray(response.data)) throw new Error('El servidor todavía no ofrece esta lista visual.');
 return { items: response.data, total: response.meta?.total, hasMore: response.meta?.has_more ?? response.data.length >= limit };
}
