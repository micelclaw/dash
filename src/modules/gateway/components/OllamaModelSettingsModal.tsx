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

// Panel "Ajustes Ollama" por-modelo (Configure → fila → ⚙ Editar). Controla
// contexto (num_ctx), offload a GPU (num_gpu), keep_alive y avanzado (num_batch,
// num_thread), con estimación de VRAM/RAM EN VIVO (lib/vram-estimate). Solo para
// modelos Ollama. Chrome + estilo tomados de CustomModelConfigModal.

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Cpu, Clock, HardDrive, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import type { OllamaModelInfo, OllamaTuningParams } from '@/services/gateway.service';
import { estimateVram, fmtGb } from '../lib/vram-estimate';

interface Props {
  modelId: string; // tag Ollama, p.ej. 'qwen3:14b' o 'hf.co/org/repo'
  modelName?: string;
  initialParams?: OllamaTuningParams;
  onClose: () => void;
  onSuccess: () => void;
}

const KEEP_ALIVE_OPTS = [
  { value: '5m', label: '5 min' },
  { value: '30m', label: '30 min' },
  { value: '-1', label: 'Siempre' },
  { value: '0', label: 'Descargar al terminar' },
];

export function OllamaModelSettingsModal({ modelId, modelName, initialParams, onClose, onSuccess }: Props) {
  const [info, setInfo] = useState<OllamaModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [numCtx, setNumCtx] = useState<number>(initialParams?.num_ctx ?? 32768);
  const [autoGpu, setAutoGpu] = useState<boolean>(initialParams?.num_gpu == null);
  const [numGpu, setNumGpu] = useState<number>(typeof initialParams?.num_gpu === 'number' ? initialParams.num_gpu : 0);
  const [keepAlive, setKeepAlive] = useState<string>(
    initialParams?.keep_alive != null ? String(initialParams.keep_alive) : '5m',
  );
  const [advOpen, setAdvOpen] = useState(false);
  const [numBatch, setNumBatch] = useState<number | ''>(typeof initialParams?.num_batch === 'number' ? initialParams.num_batch : '');
  const [numThread, setNumThread] = useState<number | ''>(typeof initialParams?.num_thread === 'number' ? initialParams.num_thread : '');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    gwService.getOllamaModelInfo(modelId)
      .then((d) => { if (alive) { setInfo(d); if (d.context_length_max && numCtx > d.context_length_max) setNumCtx(d.context_length_max); } })
      .catch((e) => { if (alive) setLoadErr(e instanceof Error ? e.message : 'No se pudo leer el modelo'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  const ctxMax = info?.context_length_max ?? 131072;
  const layers = info?.block_count ?? 0;
  const est = useMemo(() => (info ? estimateVram(info, numCtx, autoGpu ? null : numGpu) : null), [info, numCtx, autoGpu, numGpu]);
  const refreshSnapshot = () => { gwService.getOllamaModelInfo(modelId).then(setInfo).catch(() => {}); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const params: OllamaTuningParams = {
        num_ctx: numCtx,
        num_gpu: autoGpu ? null : numGpu,
        keep_alive: keepAlive,
        num_batch: numBatch === '' ? null : Number(numBatch),
        num_thread: numThread === '' ? null : Number(numThread),
      };
      await gwService.updateOllamaParams(modelId, params);
      toast.success(`Ajustes guardados: ${modelName ?? modelId}`);
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(`Fallo al guardar: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setSaving(false);
    }
  };

  const isTextOnly = true; // los modelos de chat Ollama del catálogo son input:['text']
  const barColor = est == null || est.status === 'unknown' ? 'var(--text-muted)' : est.status === 'fits' ? 'var(--green, #3fb950)' : est.status === 'over' ? 'var(--red, #f85149)' : 'var(--amber)';

  const label: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4 };
  const numInput: React.CSSProperties = { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', width: 100, outline: 'none' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 520, padding: 24, margin: 16, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>⚙ Ajustes Ollama · {modelName ?? modelId}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}><X size={18} /></button>
        </div>

        {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: '0.8125rem', padding: '20px 0' }}><Loader2 size={14} className="spin" /> Leyendo metadatos del modelo…</div>}
        {loadErr && <div style={{ color: 'var(--amber)', fontSize: '0.8125rem', marginBottom: 12 }}>⚠ {loadErr}. Puedes guardar igualmente; la estimación no estará disponible.</div>}

        {!loading && (
          <>
            {/* num_ctx */}
            <div style={{ marginBottom: 16 }}>
              <label style={label}>📐 Contexto (num_ctx) {info?.context_length_max ? <span style={{ color: 'var(--text-muted)' }}>· máx {ctxMax.toLocaleString()}</span> : null}</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="range" min={2048} max={ctxMax} step={1024} value={Math.min(numCtx, ctxMax)} onChange={(e) => setNumCtx(parseInt(e.target.value, 10))} style={{ flex: 1 }} />
                <input type="number" value={numCtx} min={2048} max={ctxMax} step={1024} onChange={(e) => setNumCtx(parseInt(e.target.value, 10) || 0)} style={numInput} />
              </div>
              <p style={{ fontSize: '0.6875rem', color: numCtx < 21000 ? 'var(--amber)' : 'var(--text-muted)', margin: '4px 0 0' }}>
                {numCtx < 21000 ? '⚠ El agente necesita ~21K tokens; por debajo se trunca el prompt (SOUL/TOOLS).' : 'Ventana de contexto del modelo.'}
              </p>
            </div>

            {/* num_gpu */}
            <div style={{ marginBottom: 16 }}>
              <label style={label}><Cpu size={11} style={{ verticalAlign: -1 }} /> Offload a GPU (num_gpu){layers ? <span style={{ color: 'var(--text-muted)' }}> · {layers} capas</span> : null}</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="range" min={0} max={layers || 40} step={1} value={autoGpu ? (layers || 40) : numGpu} disabled={autoGpu} onChange={(e) => setNumGpu(parseInt(e.target.value, 10))} style={{ flex: 1, opacity: autoGpu ? 0.4 : 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={autoGpu} onChange={(e) => setAutoGpu(e.target.checked)} /> auto
                </label>
              </div>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{autoGpu ? 'Automático: Ollama carga las capas que quepan en VRAM.' : `${numGpu} de ${layers || '?'} capas en GPU (resto en CPU/RAM).`}</p>
            </div>

            {/* keep_alive */}
            <div style={{ marginBottom: 16 }}>
              <label style={label}><Clock size={11} style={{ verticalAlign: -1 }} /> Mantener cargado (keep_alive)</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {KEEP_ALIVE_OPTS.map((o) => (
                  <button key={o.value} type="button" onClick={() => setKeepAlive(o.value)} style={{ background: keepAlive === o.value ? 'var(--amber-dim)' : 'var(--surface)', color: keepAlive === o.value ? 'var(--amber)' : 'var(--text-dim)', border: `1px solid ${keepAlive === o.value ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: '0.6875rem', cursor: 'pointer' }}>{o.label}</button>
                ))}
              </div>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>"Descargar al terminar" libera VRAM para visión/fotos tras cada chat.</p>
            </div>

            {/* Avanzado */}
            <div style={{ marginBottom: 14 }}>
              <button type="button" onClick={() => setAdvOpen(!advOpen)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>{advOpen ? '▾' : '▸'} Avanzado (num_batch, num_thread)</button>
              {advOpen && (
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <div><label style={label}>num_batch</label><input type="number" value={numBatch} min={0} step={64} placeholder="auto" onChange={(e) => setNumBatch(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)} style={numInput} /></div>
                  <div><label style={label}>num_thread</label><input type="number" value={numThread} min={0} step={1} placeholder="auto" onChange={(e) => setNumThread(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)} style={numInput} /></div>
                </div>
              )}
            </div>

            {isTextOnly && (
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', margin: '0 0 14px' }}>
                ℹ️ Modelo de texto: Fotos, digests y memoria usan modelos aparte y siguen funcionando. Solo las imágenes que pegues al agente <b>en el chat</b> necesitan un modelo de visión (Settings → image model).
              </p>
            )}

            {/* Estimación VRAM */}
            {est && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 6, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8 }}>
                  <span><HardDrive size={11} style={{ verticalAlign: -1 }} /> Estimación de memoria (aprox.)</span>
                  <button type="button" onClick={refreshSnapshot} title="Re-leer VRAM/RAM disponibles ahora" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}><RefreshCw size={10} /> snapshot</button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                  Pesos {fmtGb(est.weightsGb)} + KV@{numCtx.toLocaleString()} {fmtGb(est.kvGb)} + buffer {fmtGb(est.computeBufferGb)} = <b>{fmtGb(est.totalGb)} GB</b>
                </div>

                {/* Barra VRAM */}
                {est.vramTotalGb != null && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: 3 }}>
                      <span>VRAM (GPU){est.blockCount ? ` · ${est.gpuLayers}/${est.blockCount} capas` : ''}</span>
                      <span style={{ color: est.vramUsedGb > est.vramTotalGb ? 'var(--red, #f85149)' : 'var(--text-dim)' }}>{fmtGb(est.vramUsedGb)} / {fmtGb(est.vramTotalGb)} GB</span>
                    </div>
                    <div style={{ height: 9, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (est.vramUsedGb / est.vramTotalGb) * 100)}%`, height: '100%', background: est.vramUsedGb > est.vramTotalGb ? 'var(--red, #f85149)' : 'var(--green, #3fb950)', transition: 'width .15s' }} />
                    </div>
                  </div>
                )}

                {/* Barra RAM (solo si hay parte en RAM) */}
                {est.ramUsedGb > 0.05 && est.ramAvailGb != null && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-dim)', marginBottom: 3 }}>
                      <span>RAM (CPU)</span>
                      <span style={{ color: est.ramUsedGb > est.ramAvailGb ? 'var(--red, #f85149)' : 'var(--text-dim)' }}>{fmtGb(est.ramUsedGb)} / {fmtGb(est.ramAvailGb)} GB disp.</span>
                    </div>
                    <div style={{ height: 9, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (est.ramUsedGb / est.ramAvailGb) * 100)}%`, height: '100%', background: est.ramUsedGb > est.ramAvailGb ? 'var(--red, #f85149)' : 'var(--amber)', transition: 'width .15s' }} />
                    </div>
                  </div>
                )}

                {/* Estado */}
                <div style={{ fontSize: '0.75rem', color: barColor, fontWeight: 500 }}>
                  {est.status === 'fits' ? '🟢 ' : est.status === 'spill' ? '🟡 ' : est.status === 'over' ? '🔴 ' : ''}{est.reason}
                </div>
                {est.vramTotalGb == null && <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>Sin GPU NVIDIA detectada.</div>}
                <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                  Snapshot al abrir{est.ramAvailGb != null ? ` · RAM disp. ${fmtGb(est.ramAvailGb)} GB` : ''}. Ollama carga de uno en uno; si coincide con fotos/embeddings, suman. Aprox (sin KV-quant ni flash-attn).
                </p>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: '0.8125rem', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || loading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--amber)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 600, cursor: saving || loading ? 'not-allowed' : 'pointer', opacity: saving || loading ? 0.6 : 1 }}>
            {saving && <Loader2 size={12} className="spin" />}{saving ? 'Guardando…' : '💾 Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
