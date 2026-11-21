import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** The existing PDF.js dependency works on mobile too; no browser PDF plugin or active PDF actions. */
export default function WorkspacePdfPreview({ url }: { url: string }) {
  const { t } = useI18n();
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1); const [error, setError] = useState(''); const [width, setWidth] = useState(600); const [rendering, setRendering] = useState(true);
  const host = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true; const task = pdfjs.getDocument({ url, enableXfa: false, useSystemFonts: true });
    setDocument(null); setPage(1); setError('');
    void task.promise.then(value => { if (active) setDocument(value); }).catch(() => { if (active) setError(t('chat.pdf.openError')); });
    return () => { active = false; void task.destroy(); };
  }, [url, t]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const observer = new ResizeObserver(entries => { const measured = entries[0]?.contentRect.width; if (measured) setWidth(Math.max(200, measured - 32)); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let active = true; let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    setRendering(true);
    void document.getPage(page).then(value => {
      if (!active || !canvas.current) return;
      const original = value.getViewport({ scale: 1 }); const scale = Math.min(2, width / original.width);
      const viewport = value.getViewport({ scale });
      canvas.current.width = Math.ceil(viewport.width); canvas.current.height = Math.ceil(viewport.height);
      task = value.render({ canvas: canvas.current, viewport });
      return task.promise;
    }).then(() => { if (active) setRendering(false); }).catch(() => { if (active) setError(t('chat.pdf.renderError')); });
    return () => { active = false; task?.cancel(); };
  }, [document, page, width, t]);
  return <div ref={host} className="flex h-full min-h-0 flex-col">
    {error ? <p role="alert" className="p-5 text-sm text-[var(--text-muted)]">{error}</p> : <>
      <nav aria-label={t('chat.pdf.pages')} className="flex shrink-0 items-center justify-center gap-3 border-b border-[var(--border)] p-2 text-xs text-[var(--text-muted)]"><Button size="icon" variant="ghost" aria-label={t('chat.pdf.previousPage')} disabled={!document || page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={15} /></Button><span>{document ? t('chat.pdf.pageOf', { page, total: document.numPages }) : t('chat.pdf.loading')}</span><Button size="icon" variant="ghost" aria-label={t('chat.pdf.nextPage')} disabled={!document || page === document.numPages} onClick={() => setPage(value => value + 1)}><ChevronRight size={15} /></Button></nav>
      <div className="relative min-h-0 flex-1 overflow-auto p-4">{rendering && <div role="status" className="flex items-center justify-center p-3"><Loader2 size={16} className="animate-spin" /></div>}<canvas ref={canvas} aria-label={t('chat.pdf.pageLabel', { page })} className="mx-auto block max-w-full bg-white shadow-sm" /></div>
    </>}
  </div>;
}
