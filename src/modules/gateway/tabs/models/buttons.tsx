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

import { useState } from 'react';
import { Brain, Eye, ExternalLink, FlaskConical, HardDrive, Loader2, Wrench } from 'lucide-react';
import { StatusPill } from '../../components/StatusPill';
import type { CuratedCaps, ModelTestResult } from '../../types';
import { AA_BASE_URL, formatCtx } from './constants';

export function ActionButton({ icon, label, loading, onClick, variant, title }: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
  variant: 'primary' | 'danger' | 'secondary';
  title?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const colors = variant === 'primary'
    ? { bg: '#10b98120', color: '#10b981' }
    : variant === 'danger'
      ? { bg: '#ef444420', color: '#ef4444' }
      : { bg: 'var(--amber-dim)', color: 'var(--amber)' };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? colors.bg : 'transparent',
        color: hovered ? colors.color : 'var(--text-dim)',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 10px',
        fontSize: '0.75rem',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: loading ? 0.5 : 1,
      }}
    >
      {icon}
      {loading ? '...' : label}
    </button>
  );
}

// ─── Chips del catálogo CURADO (compartidos Catalog/Configured) ──────
// Metadata de core/data/model-catalog (lista curada a mano): capacidades,
// contexto máximo del modelo y enlace a Artificial Analysis. Sin match del
// catálogo, nada de esto se renderiza (degradación limpia).

const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: '0.6875rem',
  fontFamily: 'var(--font-sans)', fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 'var(--radius-sm)',
  whiteSpace: 'nowrap',
};

// Paleta de los chips de metadata (decisión del usuario 2026-07-14):
// contexto morado · Reasoning granate · Vision verde · Tools azul · disco cian.
const CHIP_COLORS = {
  ctx: { background: '#8b5cf620', color: '#a78bfa' },       // morado
  reasoning: { background: '#be123c26', color: '#fb7185' }, // granate
  vision: { background: '#10b98120', color: '#34d399' },    // verde
  tools: { background: '#3b82f620', color: '#60a5fa' },     // azul
  disk: { background: '#06b6d420', color: '#22d3ee' },      // cian
} as const;

/** Hueco de ancho FIJO para un chip/botón: presente o no, la columna se
 *  reserva → cada cosa queda SIEMPRE encima de la suya entre filas. Sin `w`
 *  (móvil) el hueco es auto: los vacíos colapsan y no se reserva columna. */
export function Slot({ w, children }: { w?: number; children?: React.ReactNode }) {
  return (
    <div style={{ width: w, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
      {children ?? null}
    </div>
  );
}

// Anchos de columna del cluster de metadata (desktop). Compartidos por
// Catalog y Configured para que las DOS superficies casen igual.
export const META_SLOTS = { disk: 82, ctx: 82, reasoning: 96, vision: 74, tools: 66 } as const;

/** Chip de espacio en disco (Ollama/LM Studio) — mismo formato que el resto. */
export function DiskChip({ sizeBytes }: { sizeBytes?: number | null }) {
  if (sizeBytes == null) return null;
  const gb = sizeBytes >= 1e9 ? `${(sizeBytes / 1e9).toFixed(1)} GB` : `${Math.round(sizeBytes / 1e6)} MB`;
  return (
    <span style={{ ...chipStyle, ...CHIP_COLORS.disk }} title="Espacio en disco">
      <HardDrive size={11} /> {gb}
    </span>
  );
}

/** Chips Reasoning / Vision / Tools (solo los que el modelo tiene). */
export function CapChips({ caps }: { caps?: CuratedCaps | null }) {
  if (!caps) return null;
  return (
    <>
      {caps.reasoning && <span style={{ ...chipStyle, ...CHIP_COLORS.reasoning }} title="Modelo razonador"><Brain size={11} /> Reasoning</span>}
      {caps.vision && <span style={{ ...chipStyle, ...CHIP_COLORS.vision }} title="Acepta imágenes"><Eye size={11} /> Vision</span>}
      {caps.tools && <span style={{ ...chipStyle, ...CHIP_COLORS.tools }} title="Tool calling"><Wrench size={11} /> Tools</span>}
    </>
  );
}

/**
 * Cluster de metadata con columnas FIJAS (desktop): disco · ctx · Reasoning ·
 * Vision · Tools. En móvil fluye inline (sin huecos reservados).
 */
export function ModelMetaCluster({ isMobile, sizeBytes, ctxAssigned, ctxMax, knowledge, isOllamaUnassigned, caps }: {
  isMobile: boolean;
  sizeBytes?: number | null;
  ctxAssigned?: number | null;
  ctxMax?: number | null;
  knowledge?: string | null;
  isOllamaUnassigned?: boolean;
  caps?: CuratedCaps | null;
}) {
  const disk = <DiskChip sizeBytes={sizeBytes} />;
  const ctx = <CtxChip assigned={ctxAssigned} max={ctxMax} knowledge={knowledge} isOllamaUnassigned={isOllamaUnassigned} />;
  if (isMobile) {
    // Línea PROPIA a ancho completo: los chips envuelven dentro de la pantalla
    // (nunca scroll horizontal) y no compiten con el nombre por la línea 1.
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
        {disk}{ctx}<CapChips caps={caps} />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
      <Slot w={META_SLOTS.disk}>{sizeBytes != null ? disk : null}</Slot>
      <Slot w={META_SLOTS.ctx}>{ctx}</Slot>
      <Slot w={META_SLOTS.reasoning}>{caps?.reasoning ? <span style={{ ...chipStyle, ...CHIP_COLORS.reasoning }} title="Modelo razonador"><Brain size={11} /> Reasoning</span> : null}</Slot>
      <Slot w={META_SLOTS.vision}>{caps?.vision ? <span style={{ ...chipStyle, ...CHIP_COLORS.vision }} title="Acepta imágenes"><Eye size={11} /> Vision</span> : null}</Slot>
      <Slot w={META_SLOTS.tools}>{caps?.tools ? <span style={{ ...chipStyle, ...CHIP_COLORS.tools }} title="Tool calling"><Wrench size={11} /> Tools</span> : null}</Slot>
    </div>
  );
}

/**
 * Chip ÚNICO de contexto: muestra el ASIGNADO si existe (es lo que usa el
 * runtime); el máximo del modelo y el knowledge cutoff van al tooltip. El caso
 * Ollama sin asignar conserva el "ctx def" itálico (mostrar el máximo curado
 * engañaría: el runtime usaría el default 4096).
 */
export function CtxChip({ assigned, max, knowledge, isOllamaUnassigned }: {
  assigned?: number | null;
  max?: number | null;
  knowledge?: string | null;
  isOllamaUnassigned?: boolean;
}) {
  if (!assigned && !max && !isOllamaUnassigned) return null;
  const value = assigned ? formatCtx(assigned)
    : isOllamaUnassigned ? 'ctx def'
      : max ? formatCtx(max) : null;
  if (!value) return null;
  const parts: string[] = [];
  if (assigned) parts.push(`Contexto asignado (num_ctx): ${formatCtx(assigned)}`);
  else if (isOllamaUnassigned) parts.push('Sin asignar — Ollama usaría su contexto por defecto. Añádelo y ajústalo con ⚙ Editar.');
  if (max) parts.push(`Máximo del modelo: ${formatCtx(max)}`);
  if (knowledge) parts.push(`Conocimiento hasta ${knowledge}`);
  const italic = !assigned && isOllamaUnassigned;
  return (
    <span
      style={italic
        // "ctx def" (Ollama sin asignar) se queda gris/itálico: es un aviso,
        // no un dato — el morado se reserva para valores reales.
        ? { ...chipStyle, background: 'var(--surface)', color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 500 }
        : { ...chipStyle, ...CHIP_COLORS.ctx }}
      title={parts.join(' · ')}
    >
      {value}
    </span>
  );
}

/** Enlace a la ficha del modelo en Artificial Analysis. Solo con slug
 *  VERIFICADO del catálogo curado (cero enlaces rotos). `<a>` nativo a
 *  propósito: semántica de enlace (middle-click, copiar URL) sin fetch. */
export function AaLinkButton({ slug }: { slug?: string | null }) {
  const [hovered, setHovered] = useState(false);
  if (!slug) return null;
  return (
    <a
      href={`${AA_BASE_URL}${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Ver benchmarks en Artificial Analysis"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center',
        background: hovered ? 'var(--amber-dim)' : 'transparent',
        color: hovered ? 'var(--amber)' : 'var(--text-dim)',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 8px',
        transition: 'var(--transition-fast)',
      }}
    >
      <ExternalLink size={12} />
    </a>
  );
}

// ─── Test de salud por modelo (botón + pill, compartidos Catalog/Configured) ──

/** Lanza el test real del modelo (1-token completion / presencia Ollama). */
export function TestButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <ActionButton
      icon={loading ? <Loader2 size={12} className="spin" /> : <FlaskConical size={12} />}
      label="Test"
      loading={loading}
      onClick={onClick}
      variant="secondary"
      title="Probar el modelo con una petición real (1 token)"
    />
  );
}

// tag → variante de color del StatusPill + label específico del TIPO de error.
const TEST_TAG_STATUS: Record<ModelTestResult['tag'], string> = {
  available: 'available',   // verde
  present: 'available',     // verde (Ollama: existe en disco)
  rate_limit: 'warn',       // amarillo
  auth: 'error',
  not_found: 'error',
  not_serving: 'error',
  unreachable: 'error',
  error: 'error',
};
const TEST_TAG_LABEL: Record<ModelTestResult['tag'], string> = {
  available: 'Available',
  present: 'Present',
  rate_limit: 'Rate limit',
  auth: 'Auth failed',
  not_found: 'Not found',
  not_serving: 'Not serving',
  unreachable: 'Unreachable',
  error: 'Error',
};

const formatLatency = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

// Umbral espejo del core (AGENT_TURN_TOKENS_ESTIMATE): un turno real de agente
// ronda 40-70k tokens. Si el provider declara un cap/min por debajo, el modelo
// responde al test pero un turno de chat NO cabe → pill ámbar "Limited".
const AGENT_TURN_TOKENS_ESTIMATE = 40_000;
const formatTokenCap = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

/** Pill del resultado del test (o azul "Testing…" mientras corre). Tooltip
 *  con upstream_status, message y tested_at. */
export function TestResultPill({ result, testing }: { result?: ModelTestResult | null; testing?: boolean }) {
  if (testing) return <StatusPill status="loading" label="Testing…" />;
  if (!result) return null;
  const limited = result.tag === 'available'
    && result.limit_tokens_per_minute != null
    && result.limit_tokens_per_minute < AGENT_TURN_TOKENS_ESTIMATE;
  const base = TEST_TAG_LABEL[result.tag] ?? result.tag;
  const label = limited
    ? `Limited · ${formatTokenCap(result.limit_tokens_per_minute as number)}/min`
    : result.tag === 'available' && result.latency_ms != null
      ? `${base} · ${formatLatency(result.latency_ms)}`
      : base;
  const title = [
    result.upstream_status != null ? `HTTP ${result.upstream_status}` : null,
    result.message || null,
    result.tested_at ? `Tested ${new Date(result.tested_at).toLocaleString()}` : null,
  ].filter(Boolean).join(' — ');
  return (
    <StatusPill
      status={limited ? 'warn' : (TEST_TAG_STATUS[result.tag] ?? 'error')}
      label={label}
      title={title || undefined}
    />
  );
}
