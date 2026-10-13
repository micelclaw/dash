import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';

/** Keyed by noteId in the parent. Navigation/revocation cancels a pending download's delivery. */
export function NoteNativeExport({ noteId }: { noteId: string }) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  async function download() {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try {
      const result = await api.getBlob(`/notes/${noteId}/native-export`);
      if (!mounted.current) return;
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url; link.download = `note-${noteId}-native.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if (mounted.current) toast.error('No se pudo exportar el contenido nativo. Comprueba tu acceso y vuelve a intentarlo.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section aria-label="Conservar contenido nativo" className="border-t border-[var(--border)] px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void download()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          {busy ? 'Exportando…' : 'Exportar contenido nativo'}
        </Button>
        <span className="text-[var(--text-dim)]">JSON de conservación · adjuntos por separado</span>
      </div>
      <p className="mt-1 text-[var(--text-muted)]">No sustituye una copia de seguridad completa del proveedor.</p>
    </section>
  );
}
