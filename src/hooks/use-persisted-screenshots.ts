import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { chatWorkspaceService, downloadWorkspaceBlob } from '@/services/chat-workspace.service';
import { useAuthStore } from '@/stores/auth.store';
import type { PersistedScreenshot } from '@/modules/chat/components/BrowserSessionView';

export function usePersistedScreenshots(conversationId: string | null) {
  const [screenshots, setScreenshots] = useState<PersistedScreenshot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const generation = useAuthStore(s => s.sessionGeneration);
  const epoch = useRef(0); const loaded = useRef(new Map<string, string>());
  useEffect(() => {
    const ticket = ++epoch.current; let active = true;
    loaded.current.clear(); setScreenshots([]); setCurrentIndex(0); setError('');
    if (!conversationId) return;
    setLoading(true);
    void chatWorkspaceService.screenshots(conversationId).then(items => {
      if (!active || epoch.current !== ticket || useAuthStore.getState().sessionGeneration !== generation) return;
      setScreenshots(items); setCurrentIndex(Math.max(0, items.length - 1));
    }).catch(() => { if (active && epoch.current === ticket) setError('No se pudieron recuperar las capturas.'); })
      .finally(() => { if (active && epoch.current === ticket) setLoading(false); });
    return () => { active = false; epoch.current++; loaded.current.clear(); };
  }, [conversationId, generation, revision]);
  const selected = screenshots[currentIndex];
  useEffect(() => {
    if (!selected || selected.base64) return;
    const ticket = epoch.current; let active = true; const cache = loaded.current.get(selected.id);
    if (cache) { setScreenshots(items => items.map(s => s.id === selected.id ? { ...s, base64: cache } : s)); return; }
    setLoading(true); setError('');
    void chatWorkspaceService.screenshot(selected.id).then(async ({ blob }) => {
      if (blob.size > 10 * 1024 * 1024) throw new Error('La captura es demasiado grande');
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] ?? ''); reader.onerror = reject; reader.readAsDataURL(blob); });
      if (!active || epoch.current !== ticket || useAuthStore.getState().sessionGeneration !== generation) return;
      if (loaded.current.size >= 8) loaded.current.delete(loaded.current.keys().next().value!);
      loaded.current.set(selected.id, base64);
      setScreenshots(items => items.map(s => ({ ...s, base64: loaded.current.get(s.id) })));
    }).catch(() => { if (active && epoch.current === ticket) setError('No se pudo cargar esta captura.'); })
      .finally(() => { if (active && epoch.current === ticket) setLoading(false); });
    return () => { active = false; };
  }, [selected?.id, selected?.base64, generation]);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  const navigate = useCallback((index: number) => { if (index >= 0 && index < screenshots.length) setCurrentIndex(index); }, [screenshots.length]);
  const deleteScreenshot = useCallback(async (id: string) => {
    const ticket = epoch.current;
    try { await chatWorkspaceService.removeScreenshot(id); if (ticket !== epoch.current) return; loaded.current.delete(id); setScreenshots(items => items.filter(s => s.id !== id)); setCurrentIndex(v => Math.max(0, v - 1)); }
    catch { toast.error('No se pudo eliminar la captura.'); }
  }, []);
  const downloadScreenshot = useCallback(async (id: string) => {
    const current = screenshots.find(s => s.id === id); if (!current) return;
    const ticket = epoch.current;
    try { const result = await chatWorkspaceService.screenshot(id); if (ticket === epoch.current && useAuthStore.getState().sessionGeneration === generation) downloadWorkspaceBlob(result.blob, current.filename); }
    catch { toast.error('No se pudo descargar la captura.'); }
  }, [screenshots, generation]);
  return { screenshots, currentIndex, loading, error, navigate, deleteScreenshot, downloadScreenshot, refresh };
}
