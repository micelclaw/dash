import { api, ApiError } from './api';
import { useAuthStore } from '@/stores/auth.store';
import { workspaceContentPath, type WorkspaceFile } from '@/stores/chat-workspace.store';
import type { PersistedScreenshot } from '@/modules/chat/components/BrowserSessionView';

export const chatWorkspaceService = {
  async text(chat: string, file: WorkspaceFile): Promise<string> {
    const path = workspaceContentPath(file.contentUrl, chat);
    if (!path) throw new Error('Este archivo no tiene una referencia autorizada. Ábrelo desde su mensaje.');
    const generation = useAuthStore.getState().sessionGeneration;
    const text = await api.getText(path);
    if (useAuthStore.getState().sessionGeneration !== generation) throw new ApiError('SESSION_CHANGED', 'La sesión cambió');
    if (new TextEncoder().encode(text).byteLength > 2 * 1024 * 1024) throw new Error('Este archivo es demasiado grande para la vista previa. Ábrelo desde su origen.');
    return text;
  },
  async blob(chat: string, file: WorkspaceFile) {
    const path = workspaceContentPath(file.contentUrl, chat);
    if (!path) throw new Error('Vuelve a abrir el archivo desde su mensaje.');
    const generation = useAuthStore.getState().sessionGeneration;
    const result = await api.getBlob(path);
    if (useAuthStore.getState().sessionGeneration !== generation) throw new ApiError('SESSION_CHANGED', 'La sesión cambió');
    return result;
  },
  async screenshots(chat: string): Promise<PersistedScreenshot[]> {
    const result = await api.get<{ data: PersistedScreenshot[] }>('/browser-screenshots', { conversation_id: chat });
    // The existing API has no pagination. Bound retained metadata, never eagerly download all images.
    return result.data.slice(0, 100).reverse();
  },
  async screenshot(id: string) { return api.getBlob(`/browser-screenshots/${encodeURIComponent(id)}/download`); },
  async removeScreenshot(id: string) { await api.delete(`/browser-screenshots/${encodeURIComponent(id)}`); },
};

export function downloadWorkspaceBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename.replace(/[\\/]/g, '_').split('').map(c => c.charCodeAt(0) < 32 ? '_' : c).join('');
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
