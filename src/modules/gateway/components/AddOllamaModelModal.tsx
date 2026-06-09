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

// Modal "Añadir modelo local (Ollama)" — abierto desde el botón + Añadir de la
// cabecera del Catalog de Ollama. Pensado para novatos: campo de texto (tag de
// Ollama o repo GGUF de HuggingFace), ayuda con ejemplos, validación de URL web,
// link a HuggingFace para buscar, chips de modelos populares y barra de progreso
// de descarga en vivo (SSE). Reúsa GET /gateway/models/ollama-pull + addModelWithConfig.

import { useState } from 'react';
import { X, Download, ExternalLink, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { useAuthStore } from '@/stores/auth.store';
import { POPULAR_OLLAMA_SUGGESTIONS } from '@/config/chat-model-catalog';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const HF_SEARCH = 'https://huggingface.co/models?library=gguf&sort=trending';

/** URL web del navegador (no sirve para el pull). */
function isWebUrl(v: string): boolean {
  return /^https?:\/\//i.test(v.trim());
}
/** Convierte https://huggingface.co/<repo>[/...] → hf.co/<repo> (si aplica). */
function hfUrlToRef(v: string): string | null {
  const m = v.trim().match(/^https?:\/\/huggingface\.co\/([^?#]+)/i);
  if (!m) return null;
  // quita /tree/main, /blob/..., barras finales
  const repo = m[1].replace(/\/(tree|blob|resolve)\/.*$/i, '').replace(/\/+$/, '');
  return repo ? `hf.co/${repo}` : null;
}
/** Aceptamos cualquier tag/repo que NO sea una URL web. */
function isValidRef(v: string): boolean {
  const t = v.trim();
  return t.length > 0 && !isWebUrl(t);
}
const fmtGb = (bytes: number) => (bytes / 1e9).toFixed(1);

export function AddOllamaModelModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [value, setValue] = useState('');
  const [progress, setProgress] = useState<number | null>(null); // null = idle, 0..100 = pull, -1 = registrando
  const [phase, setPhase] = useState<string>('');                // línea de estado del pull
  const [done, setDone] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ref = value.trim();
  const busy = progress !== null;
  const webUrl = isWebUrl(ref);
  const hfFix = webUrl ? hfUrlToRef(ref) : null;
  const canDownload = isValidRef(ref) && !busy;

  async function downloadAndAdd() {
    if (!isValidRef(ref)) return;
    setError(null);
    setProgress(0);
    setPhase('Conectando con Ollama…');
    setDone(null);
    try {
      const token = useAuthStore.getState().tokens?.accessToken;
      const res = await fetch(`${BASE_URL}/api/v1/gateway/models/ollama-pull?id=${encodeURIComponent(ref)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok || !res.body) throw new Error(`pull HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      outer: while (true) {
        const { done: rdone, value: chunk } = await reader.read();
        if (rdone) break;
        for (const line of dec.decode(chunk).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          let j: { error?: string; status?: string; completed?: number; total?: number };
          try { j = JSON.parse(line.slice(6)); } catch { continue; }
          if (j.error) throw new Error(j.error);
          if (j.status === 'done' || j.status === 'success') break outer;
          if (j.status) setPhase(j.status);
          if (typeof j.completed === 'number' && typeof j.total === 'number' && j.total > 0) {
            setProgress(Math.round((j.completed / j.total) * 100));
            setDone({ completed: j.completed, total: j.total });
          }
        }
      }
      // Registrar como modelo de chat (idempotente, solo texto). El contexto/offload
      // se afinan luego con el ⚙ Editar por-modelo (OllamaModelSettingsModal).
      setProgress(-1);
      setPhase('Registrando el modelo…');
      await gwService.addModelWithConfig({
        model: `ollama/${ref}`, provider_id: 'ollama', model_id: ref,
        name: ref, context_window: 32768, max_tokens: 8192, input: ['text'],
      });
      toast.success(`Modelo añadido: ${ref}`);
      onAdded();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'error';
      setError(msg);
      setProgress(null);
      toast.error(`No se pudo añadir ${ref}: ${msg}`);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--surface)',
    border: `1px solid ${webUrl ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)',
    padding: '8px 10px', color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)',
  };
  const chip: React.CSSProperties = {
    padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer',
    border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={busy ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 540, padding: 24, margin: 16, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Download size={16} /> Añadir modelo local (Ollama)
          </h3>
          <button onClick={onClose} disabled={busy} style={{ background: 'transparent', border: 'none', cursor: busy ? 'default' : 'pointer', color: 'var(--text-dim)', padding: 4, opacity: busy ? 0.4 : 1 }}><X size={18} /></button>
        </div>

        {progress === null ? (
          <>
            {/* Input */}
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text)', marginBottom: 6 }}>
              Pega un tag de Ollama o un repo GGUF de HuggingFace:
            </label>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canDownload) downloadAndAdd(); }}
              placeholder="qwen3:14b   o   hf.co/<repo>:<quant>"
              style={inputStyle}
            />

            {/* Ayuda / validación */}
            {webUrl ? (
              <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--amber)' }}>
                ⚠ Eso es una URL web. Usa el formato <code style={{ fontFamily: 'var(--font-mono)' }}>hf.co/&lt;repo&gt;:&lt;quant&gt;</code>.
                {hfFix && (
                  <div style={{ marginTop: 4 }}>
                    ¿Quieres decir{' '}
                    <button onClick={() => setValue(hfFix)} style={{ background: 'transparent', border: 'none', color: 'var(--amber)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-mono)', padding: 0 }}>
                      {hfFix}
                    </button>
                    ?
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                <div>Ejemplos:</div>
                <div>• Tag Ollama: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>qwen3:14b</code></div>
                <div>• Repo GGUF (HF): <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>hf.co/&lt;repo&gt;:&lt;quant&gt;</code></div>
                <div style={{ color: 'var(--text-muted)' }}>La URL web del navegador (https://huggingface.co/…) no sirve.</div>
              </div>
            )}

            {/* Buscar en HuggingFace */}
            <a href={HF_SEARCH} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: '0.8125rem', color: 'var(--accent, #58a6ff)', textDecoration: 'none' }}>
              <Search size={13} /> ¿No sabes cuál? Buscar modelos GGUF en HuggingFace <ExternalLink size={12} />
            </a>

            {/* Chips populares */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 6 }}>Populares (clic para rellenar):</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {POPULAR_OLLAMA_SUGGESTIONS.map((m) => (
                  <span key={m.id} style={chip} onClick={() => setValue(m.id)} title={m.note ?? m.name}>
                    {m.name} <span style={{ color: 'var(--text-muted)' }}>·{m.sizeGb}GB</span>
                  </span>
                ))}
              </div>
            </div>

            {error && <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--red, #f85149)' }}>⚠ {error}</div>}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={onClose} style={{ padding: '8px 14px', fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}>Cancelar</button>
              <button onClick={downloadAndAdd} disabled={!canDownload}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 'var(--radius-sm)', cursor: canDownload ? 'pointer' : 'default', border: '1px solid var(--amber)', background: 'var(--amber)', color: '#1a1a1a', opacity: canDownload ? 1 : 0.4 }}>
                <Download size={14} /> Descargar
              </button>
            </div>
          </>
        ) : (
          /* Estado: descargando / registrando */
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text)', marginBottom: 10, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
              {progress === -1 ? 'Registrando' : 'Descargando'}  {ref}
            </div>
            {/* Barra */}
            <div style={{ position: 'relative', height: 10, background: 'var(--surface)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: progress === -1 ? '100%' : `${progress}%`,
                background: 'var(--amber)', borderRadius: 999, transition: 'width 0.3s ease',
                opacity: progress === -1 ? 0.6 : 1,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={12} className="spin" /> {progress === -1 ? 'Registrando el modelo…' : (phase || 'Descargando…')}
              </span>
              <span>
                {progress === -1 ? '' : `${progress}%`}
                {done && progress !== -1 ? `  ·  ${fmtGb(done.completed)} / ${fmtGb(done.total)} GB` : ''}
              </span>
            </div>
            <div style={{ marginTop: 16, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              No cierres esta ventana. Al terminar, el modelo aparecerá en el catálogo y podrás ajustar su contexto con ⚙ Editar.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
