/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Descarga binaria con auth de los export de finanzas (GET /finance/export/*).
// Generaliza el patrón de invoicePdf.ts: fetch con Bearer (1 reintento tras refresh
// en 401), blob, descarga vía <a download>. El nombre sale del content-disposition.

import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'contaplus';

export async function downloadExport(
  report: string,
  opts: { format: ExportFormat; from?: string; to?: string; accountId?: string; book?: 'issued' | 'received' },
): Promise<void> {
  const params = new URLSearchParams({ format: opts.format });
  if (opts.from) params.set('from', opts.from);
  if (opts.to) params.set('to', opts.to);
  if (opts.book) params.set('book', opts.book);
  const path = opts.accountId ? `ledger/${opts.accountId}` : report;
  const url = `${BASE_URL}/api/v1/finance/export/${path}?${params.toString()}`;

  const doFetch = () => {
    const token = useAuthStore.getState().tokens?.accessToken;
    return fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  };
  let res = await doFetch();
  if (res.status === 401) { await useAuthStore.getState().refresh(); res = await doFetch(); }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const j = await res.json(); msg = j?.error?.message ?? msg; } catch { /* no-op */ }
    throw new Error(msg);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const m = cd.match(/filename="?([^"]+)"?/);
  const filename = m ? m[1] : `${report}.${opts.format === 'contaplus' ? 'txt' : opts.format}`;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
