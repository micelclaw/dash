/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// F2c — descarga/visualización del PDF de un documento. La ruta
// GET /finance/documents/:id/pdf devuelve bytes application/pdf (auth Bearer), así
// que no se puede abrir por <a href> directo: se fetchea con el token, se crea un
// blob y se abre/descarga. Patrón hermano del PdfViewer de Office.

import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** Fetchea el PDF del documento con auth (1 reintento tras refresh si 401). */
async function fetchInvoicePdfBlob(documentId: string): Promise<Blob> {
  const url = `${BASE_URL}/api/v1/finance/documents/${documentId}/pdf`;
  const doFetch = () => {
    const token = useAuthStore.getState().tokens?.accessToken;
    return fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  };
  let res = await doFetch();
  if (res.status === 401) {
    await useAuthStore.getState().refresh();
    res = await doFetch();
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const j = await res.json(); msg = j?.error?.message ?? msg; } catch { /* no-op */ }
    throw new Error(msg);
  }
  return res.blob();
}

/** Abre el PDF del documento en una pestaña nueva (preview). */
export async function openInvoicePdf(documentId: string): Promise<void> {
  const blob = await fetchInvoicePdfBlob(documentId);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener');
  // El navegador retiene el blob mientras la pestaña lo use; lo liberamos tarde.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

/** Descarga el PDF del documento con el nombre dado. */
export async function downloadInvoicePdf(documentId: string, filename: string): Promise<void> {
  const blob = await fetchInvoicePdfBlob(documentId);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
