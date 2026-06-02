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

// Add model (chat, local Ollama): catálogo curado con filtros (empresa/tamaño)
// + campo libre (tag Ollama o repo GGUF). Pull con progreso SSE y registro como
// modelo de chat del agente. Reusa el patrón SSE de MultimodalModelSection y el
// endpoint nuevo GET /gateway/models/ollama-pull. Registro = addModelWithConfig.

import { useEffect, useMemo, useState } from 'react';
import { Download, Check, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { useAuthStore } from '@/stores/auth.store';
import { CHAT_MODEL_CATALOG, CATALOG_COMPANIES, SIZE_BUCKETS, type CatalogModel } from '@/config/chat-model-catalog';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export function AddModelPanel({ onAdded }: { onAdded?: () => void }) {
  const [company, setCompany] = useState<string>('all');
  const [sizeIdx, setSizeIdx] = useState<number>(-1);
  const [search, setSearch] = useState('');
  const [freeText, setFreeText] = useState('');
  // Mapa id-normalizado (sin `:latest`) → nombre real en Ollama. Tolera que un
  // pull de HF GGUF se guarde como `hf.co/...:latest` aunque el catálogo use el id
  // sin sufijo, y guarda el nombre real para poder borrarlo de disco.
  const [installed, setInstalled] = useState<Map<string, string>>(new Map());
  const [progress, setProgress] = useState<Map<string, number>>(new Map()); // id → 0..100, -1 = registrando
  const [busy, setBusy] = useState<string | null>(null);

  const refreshInstalled = async () => {
    try {
      const d = await gwService.discoverProviderModels('ollama');
      setInstalled(new Map((d.models ?? []).map((m) => [m.id.replace(/:latest$/, ''), m.id])));
    } catch { /* ollama offline */ }
  };
  useEffect(() => { refreshInstalled(); }, []);

  const filtered = useMemo(() => CHAT_MODEL_CATALOG.filter((m) => {
    if (company !== 'all' && m.company !== company) return false;
    if (sizeIdx >= 0 && !SIZE_BUCKETS[sizeIdx].test(m.sizeGb)) return false;
    if (search && !`${m.name} ${m.id} ${m.company}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [company, sizeIdx, search]);

  // Pull (si no está instalado) por SSE + registrar como modelo de chat.
  async function pullAndRegister(id: string, name?: string) {
    if (busy) return;
    setBusy(id);
    try {
      if (!installed.has(id)) {
        const token = useAuthStore.getState().tokens?.accessToken;
        setProgress((p) => new Map(p).set(id, 0));
        const res = await fetch(`${BASE_URL}/api/v1/gateway/models/ollama-pull?id=${encodeURIComponent(id)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok || !res.body) throw new Error(`pull HTTP ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            let j: { error?: string; status?: string; completed?: number; total?: number };
            try { j = JSON.parse(line.slice(6)); } catch { continue; }
            if (j.error) throw new Error(j.error);
            if (j.status === 'done' || j.status === 'success') break outer;
            if (typeof j.completed === 'number' && typeof j.total === 'number' && j.total > 0) {
              setProgress((p) => new Map(p).set(id, Math.round((j.completed! / j.total!) * 100)));
            }
          }
        }
      }
      // Registrar como modelo de chat (idempotente). input solo texto.
      setProgress((p) => new Map(p).set(id, -1));
      await gwService.addModelWithConfig({
        model: `ollama/${id}`, provider_id: 'ollama', model_id: id,
        name: name ?? id, context_window: 32768, max_tokens: 8192, input: ['text'],
      });
      toast.success(`Modelo añadido: ollama/${id}`);
      await refreshInstalled();
      onAdded?.();
    } catch (e) {
      toast.error(`Fallo añadiendo ${id}: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setBusy(null);
      setProgress((p) => { const n = new Map(p); n.delete(id); return n; });
    }
  }

  // Hard delete de disco (Ollama rm) + desregistro best-effort como modelo de chat.
  async function deleteModel(catalogId: string, name: string) {
    if (busy) return;
    const actual = installed.get(catalogId) ?? catalogId;
    if (!window.confirm(`¿Borrar "${name}" del disco? Libera espacio; tendrás que volver a descargarlo para usarlo.`)) return;
    setBusy(catalogId);
    try {
      await gwService.deleteOllamaModel(actual);
      try { await gwService.removeModel(`ollama/${catalogId}`); } catch { /* no estaba registrado como modelo de chat */ }
      toast.success(`Modelo borrado del disco: ${name}`);
      await refreshInstalled();
      onAdded?.();
    } catch (e) {
      toast.error(`Fallo borrando ${name}: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setBusy(null);
    }
  }

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer',
    border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
    background: active ? 'var(--surface-hover)' : 'transparent', color: 'var(--text)',
  });
  const btnLabel = (id: string) => {
    const pr = progress.get(id);
    if (pr === -1) return 'Registrando…';
    if (typeof pr === 'number') return `Descargando ${pr}%`;
    return installed.has(id) ? 'Añadir' : 'Pull y añadir';
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>Añadir modelo de chat (local · Ollama)</h3>
      <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        Los modelos locales no consumen cuota. Elige del catálogo o pega un tag de Ollama / repo GGUF.
      </p>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select value={company} onChange={(e) => setCompany(e.target.value)}
          style={{ ...chip(company !== 'all'), padding: '4px 8px' }}>
          <option value="all">Todas las empresas</option>
          {CATALOG_COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {SIZE_BUCKETS.map((b, i) => (
          <span key={b.label} style={chip(sizeIdx === i)} onClick={() => setSizeIdx(sizeIdx === i ? -1 : i)}>{b.label}</span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 140 }}>
          <Search size={13} style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="buscar…"
            style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', color: 'var(--text)', fontSize: '0.8125rem' }} />
        </span>
      </div>

      {/* Catálogo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
        {filtered.map((m: CatalogModel) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
                {m.name} {installed.has(m.id) && <Check size={12} style={{ color: 'var(--green, #3fb950)' }} />}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {m.company} · {m.params} · ~{m.sizeGb}GB · tools: {m.tools}{m.note ? ` · ${m.note}` : ''}
              </div>
            </div>
            <button disabled={!!busy} onClick={() => pullAndRegister(m.id, m.name)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)', cursor: busy ? 'default' : 'pointer', border: '1px solid var(--border)', background: busy === m.id ? 'var(--surface-hover)' : 'transparent', color: 'var(--text)', opacity: busy && busy !== m.id ? 0.5 : 1 }}>
              <Download size={13} /> {btnLabel(m.id)}
            </button>
            {installed.has(m.id) && (
              <button disabled={!!busy} onClick={() => deleteModel(m.id, m.name)} title="Borrar de disco"
                style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)', cursor: busy ? 'default' : 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--red, #f85149)', opacity: busy && busy !== m.id ? 0.5 : 1 }}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: 8 }}>Sin modelos con esos filtros.</div>}
      </div>

      {/* Campo libre */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <input value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="qwen3:14b  o  hf.co/Qwen/Qwen3-14B-GGUF:Q4_K_M"
          style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', color: 'var(--text)', fontSize: '0.8125rem' }} />
        <button disabled={!!busy || !freeText.trim()} onClick={() => pullAndRegister(freeText.trim())}
          style={{ padding: '6px 12px', fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)', cursor: busy || !freeText.trim() ? 'default' : 'pointer', border: '1px solid var(--amber)', background: 'var(--surface-hover)', color: 'var(--text)', opacity: !freeText.trim() ? 0.5 : 1 }}>
          {busy === freeText.trim() ? btnLabel(freeText.trim()) : 'Pull y añadir'}
        </button>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        Acepta un tag de Ollama (qwen3:14b) o un repo GGUF de HuggingFace (hf.co/&lt;repo&gt;:&lt;quant&gt;). La URL web cruda no sirve.
      </p>
    </div>
  );
}
