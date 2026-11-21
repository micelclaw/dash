import { api } from './api';
export type BrowserViewLease = { view_id: string; stream_nonce: string; expires_at: number; capabilities: string[] };
export type BrowserControls = { snapshot_id: string; url: string; controls: Array<{ id: string; label: string; kind: 'click' | 'type' }> };
const base = (chat: string) => `/conversations/${encodeURIComponent(chat)}/browser/views`;
export const browserViewService = {
  async open(chat: string, signal: AbortSignal) { return (await api.post<{ data: BrowserViewLease }>(base(chat), {}, { signal })).data; },
  async close(chat: string, id: string) { await api.delete(`${base(chat)}/${encodeURIComponent(id)}`); },
  async renew(chat: string, id: string) { await api.post(`${base(chat)}/${encodeURIComponent(id)}/renew`, {}); },
  async controls(chat: string, id: string, frame: number) { return (await api.post<{ data: BrowserControls }>(`${base(chat)}/${encodeURIComponent(id)}/controls`, { frame_id: frame })).data; },
  async action(chat: string, id: string, action: Record<string, unknown>) { await api.post(`${base(chat)}/${encodeURIComponent(id)}/actions`, action); },
  streamUrl(chat: string, id: string): string {
    const url = new URL(api.frameUrl(`${base(chat)}/${encodeURIComponent(id)}/stream`), window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; return url.href;
  },
};
