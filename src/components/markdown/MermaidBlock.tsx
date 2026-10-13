import { useEffect, useId, useState } from 'react';
import { Download, Edit3, ZoomIn, ZoomOut } from 'lucide-react';
import DOMPurify from 'dompurify';
import { useNavigate } from 'react-router';
import { api } from '@/services/api';
import { analyzeMermaidForSketches, parseMermaid } from '@/modules/sketches/import/mermaid-parser';
import type { FileRecord } from '@/types/files';
import type { ApiResponse } from '@/types/api';

function download(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}

/** Safe, local rendering of a Mermaid fenced block. Unsupported diagram forms
 * remain perfectly usable as Mermaid, but are not offered to Sketches where a
 * conversion would lose meaning. */
export function MermaidBlock({ source }: { source: string }) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const sketchSupport = analyzeMermaidForSketches(source);

  useEffect(() => {
    let live = true;
    void import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'dark' });
      const rendered = await mermaid.render(`micelclaw-mermaid-${id}`, source);
      if (live) setSvg(DOMPurify.sanitize(rendered.svg, { USE_PROFILES: { svg: true, svgFilters: true } }));
    }).catch((cause: unknown) => { if (live) setError(cause instanceof Error ? cause.message : 'No se pudo interpretar este diagrama Mermaid.'); });
    return () => { live = false; };
  }, [id, source]);

  const editInSketches = async () => {
    if (!sketchSupport.supported || creating) return;
    setCreating(true);
    try {
      const diagram = parseMermaid(source);
      const blob = new Blob([JSON.stringify(diagram, null, 2)], { type: 'application/vnd.claw.diagram+json' });
      const form = new FormData();
      form.append('file', blob, `${diagram.title || 'Mermaid diagram'}.diagram`);
      form.append('parent_folder', '/Diagrams/');
      const result = await api.upload<ApiResponse<FileRecord>>('/files/upload', form);
      navigate(`/sketches/${result.data.id}`);
    } finally { setCreating(false); }
  };

  return <section style={{ margin: '10px 0', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
      <strong style={{ marginRight: 'auto' }}>Mermaid</strong>
      <button type="button" title="Alejar" aria-label="Alejar diagrama" onClick={() => setZoom((value) => Math.max(.5, value - .15))}><ZoomOut size={14} /></button>
      <button type="button" title="Acercar" aria-label="Acercar diagrama" onClick={() => setZoom((value) => Math.min(2, value + .15))}><ZoomIn size={14} /></button>
      <button type="button" title="Descargar código Mermaid" onClick={() => download('diagrama.mmd', source, 'text/plain')}><Download size={14} /> Código</button>
      {svg && <button type="button" title="Descargar SVG" onClick={() => download('diagrama.svg', svg, 'image/svg+xml')}><Download size={14} /> SVG</button>}
      {sketchSupport.supported && <button type="button" disabled={creating} title="Abrir una copia editable en Sketches" onClick={() => void editInSketches()}><Edit3 size={14} /> Sketches</button>}
    </div>
    {error ? <pre style={{ margin: 0, padding: 12, overflow: 'auto', color: 'var(--danger, #d66)' }}>{error}{'\n\n'}{source}</pre>
      : !svg ? <p style={{ padding: 12, color: 'var(--text-muted)' }}>Renderizando diagrama…</p>
        : <div style={{ overflow: 'auto', padding: 12 }}><div style={{ minWidth: 'max-content', transform: `scale(${zoom})`, transformOrigin: 'top left' }} dangerouslySetInnerHTML={{ __html: svg }} /></div>}
    {!sketchSupport.supported && <p style={{ margin: '0 12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>Se puede ver y descargar, pero no editar en Sketches sin perder: {sketchSupport.reasons.join(', ')}.</p>}
  </section>;
}
