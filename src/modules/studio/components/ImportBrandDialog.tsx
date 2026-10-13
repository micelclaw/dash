/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see repo LICENSE.
 */

// ─── "Import my brand" ──────────────────────────────────────────────
// Same SHAPE as Claude Design's "Set up your design system" (name, tell me
// about your brand, optional sources, notes) with a different engine: the
// import is DETERMINISTIC. Paste a DESIGN.md and it is used verbatim; paste
// CSS (a tokens.css, a :root{} copied off your site, several files one after
// another) and the tokens are harvested — following var() indirection and
// brand prefixes, so a layered package imports whole; drop a logo and the
// palette is sampled from the pixels. Only the words-only path asks a model,
// and even that has a deterministic palette behind it, so this dialog can
// never hang or dead-end.

import { useRef, useState } from 'react';
import { X, Upload, Loader2, Palette, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface Props {
  /** Enables the optional model draft for the words-only path. */
  projectId?: string;
  onClose: () => void;
  onImported: (slug: string) => void;
}

interface ImportResult {
  slug: string;
  name: string;
  source: string;
  design_md: string;
  tokens_css: string;
  warnings: string[];
  n_colors: number;
}

const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '0.82rem',
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)',
};
const label: React.CSSProperties = {
  fontSize: '0.7rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 4,
};
const hint: React.CSSProperties = { fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 3 };

export function ImportBrandDialog({ projectId, onClose, onImported }: Props) {
  const [name, setName] = useState('');
  const [blurb, setBlurb] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [notes, setNotes] = useState('');
  const [logo, setLogo] = useState<{ name: string; base64: string } | null>(null);
  const [dark, setDark] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function readFiles(files: FileList | null) {
    if (!files?.length) return;
    const texts: string[] = [];
    for (const f of Array.from(files)) {
      if (/^image\//.test(f.type)) {
        const b64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = () => rej(r.error);
          r.readAsDataURL(f);
        });
        setLogo({ name: f.name, base64: b64 });
        continue;
      }
      texts.push(`/* ${f.name} */\n${await f.text()}`);
    }
    // Several token files concatenate cleanly — the harvest is name-based.
    if (texts.length) setSourceText((prev) => [prev, ...texts].filter(Boolean).join('\n\n'));
  }

  async function handleImport() {
    if (!name.trim()) { toast.error('Give your brand a name'); return; }
    if (!sourceText.trim() && !logo && !blurb.trim()) {
      toast.error('Paste your styles, drop a logo, or describe the brand');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ data: ImportResult }>('/studio/design-systems', {
        name: name.trim(),
        blurb: blurb.trim() || undefined,
        notes: notes.trim() || undefined,
        source_text: sourceText.trim() || undefined,
        logo_base64: logo?.base64,
        dark,
        project_id: projectId,
      }, { timeout: 5 * 60 * 1000 });
      setResult(res.data);
      for (const w of res.data.warnings ?? []) toast.warning(w);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // Swatches straight from the derived tokens — what the model will receive.
  const swatches = result
    ? [...result.tokens_css.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)].slice(0, 12)
      .map((m) => ({ name: m[1]!, value: m[2]!.trim() }))
    : [];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-import-brand-dialog
        style={{ width: 640, maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <Palette size={15} style={{ color: 'var(--amber)' }} />
          <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>Set up your design system</strong>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }} aria-label="Close"><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!result ? (
            <>
              <div>
                <label style={label} htmlFor="ibd-name">What is your brand called?</label>
                <input id="ibd-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Acme, my portfolio, Micelclaw…" style={field} />
              </div>

              <div>
                <label style={label} htmlFor="ibd-blurb">Tell me about it</label>
                <textarea
                  id="ibd-blurb" value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={3}
                  placeholder="Warm and artisanal, for a neighbourhood bakery. Friendly, not corporate."
                  style={{ ...field, resize: 'vertical' }}
                />
                <div style={hint}>Used as guidance when designing, and to fill in anything your files do not cover.</div>
              </div>

              <div>
                <label style={label} htmlFor="ibd-source">Paste your styles <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <textarea
                  id="ibd-source" value={sourceText} onChange={(e) => setSourceText(e.target.value)} rows={5}
                  placeholder={':root { --color-primary: #d4a018; --color-background: #06050a; … }'}
                  style={{ ...field, resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.72rem' }}
                />
                <div style={hint}>
                  A DESIGN.md, a tokens.css, or a <code>:root&#123;&#125;</code> copied off your site. Several files can go one after another.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <input
                  ref={fileRef} type="file" multiple accept=".css,.md,.txt,image/*"
                  onChange={(e) => { void readFiles(e.target.files); e.target.value = ''; }}
                  style={{ display: 'none' }}
                />
                <button
                  type="button" onClick={() => fileRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: '0.75rem', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                >
                  <Upload size={12} /> Add files or a logo
                </button>
                {logo && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Logo: {logo.name}</span>}
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> dark interface
                </label>
              </div>

              <div>
                <label style={label} htmlFor="ibd-notes">Anything to always respect? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <textarea
                  id="ibd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Never use gradients. The logo always sits on a dark background."
                  style={{ ...field, resize: 'vertical' }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
                <strong>{result.name}</strong> is ready — {result.n_colors} colours.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {swatches.map((s) => (
                  <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 62 }}>
                    <div style={{ width: 46, height: 34, borderRadius: 'var(--radius-sm)', background: s.value, border: '1px solid var(--border)' }} />
                    <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{s.name}</span>
                  </div>
                ))}
              </div>
              {(result.warnings ?? []).map((w) => (
                <div key={w} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <AlertTriangle size={12} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />{w}
                </div>
              ))}
              <details>
                <summary style={{ cursor: 'pointer', fontSize: '0.72rem', color: 'var(--text-muted)' }}>See the design system it wrote</summary>
                <pre style={{ marginTop: 8, maxHeight: 220, overflow: 'auto', fontSize: '0.66rem', color: 'var(--text-muted)', background: 'var(--surface)', padding: 10, borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap' }}>
                  {result.design_md}
                </pre>
              </details>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            type="button" onClick={onClose}
            style={{ padding: '7px 12px', fontSize: '0.78rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result ? (
            <button
              type="button" onClick={() => { void handleImport(); }} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--amber)', color: '#1a1400', border: 'none', borderRadius: 'var(--radius-sm)', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: 'var(--font-sans)' }}
            >
              {busy ? <><Loader2 size={12} className="spin" /> Building…</> : 'Create my design system'}
            </button>
          ) : (
            <button
              type="button" onClick={() => { onImported(result.slug); onClose(); }}
              style={{ padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--amber)', color: '#1a1400', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Use it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
