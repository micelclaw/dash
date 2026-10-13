/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useId, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, Clipboard, ExternalLink,
  Loader2, XCircle,
} from 'lucide-react';
import { Link } from 'react-router';
import type { ToolCallRecord, ToolPresentationPayload, ToolRunState } from '@/types/chat';
import { classify } from '@/config/tool-rendering';
import { truncateLine } from './shared';
import { ToolDomainIcon } from './ToolDomainIcon';

interface Props {
  tool: ToolCallRecord;
  onOpenTechnicalCanvas?: (value: { title: string; content: string }) => void;
  nested?: boolean;
}

const MAX_INITIAL_ITEMS = 3;
const MAX_EXPANDED_ITEMS = 20;
const MAX_FACTS = 5;

function normalizedState(tool: ToolCallRecord): ToolRunState {
  if (tool.presentation?.state) return tool.presentation.state;
  return tool.status ?? 'success';
}

function legacyPresentation(tool: ToolCallRecord): ToolPresentationPayload {
  const def = classify(tool.tool);
  const mcp = /^([a-z0-9][a-z0-9_-]*)__(.+)$/i.exec(tool.tool);
  const externalMcp = mcp && !tool.tool.startsWith('claw-os__');
  const title = externalMcp ? `${mcp[1]} · ${mcp[2]}` : (def.label || tool.tool);
  const state = normalizedState(tool);
  const fallback = state === 'running' || state === 'pending'
    ? `Ejecutando ${title}…`
    : state === 'error' ? `${title} no se pudo completar` : `${title} completada`;
  return {
    version: 1,
    definition_version: 1,
    tool_name: tool.tool,
    domain: externalMcp ? mcp[1]! : 'legacy',
    result_kind: 'generic',
    operation: 'execute',
    title,
    action_label: 'Ejecutar tool',
    summary: truncateLine(tool.summary, 90) || fallback,
    state,
    visibility: 'normal',
    approval_level: 0,
    facts: [],
    items: [],
    technical: { input: null, output: null, metadata: {}, truncated: false },
    // Historical/MCP raw input and output are intentionally not promoted to
    // technical details. Only Core's sanitized snapshot may be mounted.
  };
}

export function getToolPresentation(tool: ToolCallRecord): ToolPresentationPayload {
  return tool.presentation ?? legacyPresentation(tool);
}

function StateIcon({ state }: { state: ToolRunState }) {
  if (state === 'running' || state === 'pending') {
    return <Loader2 size={14} aria-hidden className="animate-spin" style={{ color: 'var(--amber)', flexShrink: 0 }} />;
  }
  if (state === 'approval') return <AlertTriangle size={14} aria-hidden style={{ color: 'var(--amber)', flexShrink: 0 }} />;
  if (state === 'error') return <XCircle size={14} aria-hidden style={{ color: 'var(--error)', flexShrink: 0 }} />;
  return <Check size={14} aria-hidden style={{ color: 'var(--success)', flexShrink: 0 }} />;
}

function safeJson(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return '[No se pudo serializar]'; }
}

function formatFactValue(value: string | number | boolean, format: ToolPresentationPayload['facts'][number]['format']): string {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if ((format === 'date' || format === 'datetime') && typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat('es-ES', format === 'date'
      ? { dateStyle: 'medium' }
      : { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  if (typeof value === 'number') {
    if (format === 'percent') return new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 2 }).format(value);
    if (format === 'bytes') return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value) + ' B';
    if (format === 'duration') return `${new Intl.NumberFormat('es-ES').format(value)} ms`;
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);
  }
  return String(value);
}

export function TechnicalDetails({ payload, regionId, moduleLink, canvasAction, state, identity }: {
  payload: NonNullable<ToolPresentationPayload['technical']>;
  regionId: string;
  moduleLink?: string;
  canvasAction?: { label: string; onClick: () => void };
  state?: ToolRunState;
  identity?: Pick<ToolPresentationPayload, 'tool_name' | 'origin' | 'canonical_name' | 'alias_of' | 'plugin_id'>;
}) {
  const [tab, setTab] = useState<'input' | 'output' | 'metadata' | 'error'>(() =>
    state === 'error' ? 'error' : payload.output != null ? 'output' : payload.input != null ? 'input' : 'metadata');
  const metadata = { ...payload.metadata, ...(identity?.origin ? { origin: identity.origin } : {}),
    ...(identity?.canonical_name ? { canonical_name: identity.canonical_name } : {}),
    ...(identity?.alias_of ? { alias_of: identity.alias_of } : {}),
    ...(identity?.plugin_id ? { plugin_id: identity.plugin_id } : {}) };
  const visible = safeJson(tab === 'error' ? payload.error ?? (state === 'error' && payload.metadata.error_available !== false ? payload.output : undefined) : tab === 'metadata' ? metadata : payload[tab]);
  const attemptReasons: Record<string, string> = {
    blocked: 'La comprobación de seguridad bloqueó la llamada.',
    failed: 'Falló la comprobación previa de la llamada.',
    cancelled: 'La llamada se canceló.',
    timeout: 'Se agotó el tiempo de espera de la llamada.',
    approval_unavailable: 'No se pudo solicitar la aprobación.',
    result_unavailable: 'No se recibió un resultado. No se puede confirmar cómo terminó la ejecución.',
  };
  const reason = typeof payload.metadata.terminal_reason === 'string' ? payload.metadata.terminal_reason : '';
  const attemptReason = payload.metadata.attempt_phase && Object.hasOwn(attemptReasons, reason) ? attemptReasons[reason] : undefined;
  const absent = tab === 'input' ? 'No se conservaron parámetros seguros para esta llamada.'
    : tab === 'error' ? 'El productor indicó un error sin entregar detalles seguros.'
    : tab === 'metadata' ? payload.metadata_truncated ? 'Metadatos omitidos por el límite de esta vista.' : 'No hay metadatos disponibles.'
    : state === 'running' || state === 'pending' ? 'Resultado aún no recibido.'
    : payload.output_present === true ? 'Resultado vacío.' : payload.metadata.result_available === false
      ? 'El productor no entregó un resultado para esta llamada.' : 'No se conservó un resultado seguro.';
  const copy = async () => {
    if (!visible) return;
    await navigator.clipboard.writeText(visible);
  };
  return (
    <section id={regionId} aria-label="Datos de la tool" style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
      {attemptReason && <p style={{ margin: '0 0 8px', color: 'var(--text-dim)', fontSize: '0.75rem' }}>{attemptReason}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        <div role="tablist" aria-label="Datos de la tool" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {(['input', 'output', ...(state === 'error' ? ['error' as const] : []), 'metadata'] as const).map((key) => (
            <button key={key} id={`${regionId}-${key}`} role="tab" aria-controls={`${regionId}-panel`} aria-selected={tab === key} onClick={() => setTab(key)} style={{
              border: '1px solid var(--border)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer',
              background: tab === key ? 'var(--surface-hover)' : 'transparent', color: 'var(--text-dim)', fontSize: '0.7rem',
            }}>{key === 'input' ? 'Parámetros' : key === 'output' ? 'Resultado' : key === 'error' ? 'Error' : 'Metadatos'}</button>
          ))}
        </div>
        {moduleLink && <Link to={moduleLink} style={{ marginLeft: 5, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', textDecoration: 'none' }}><ExternalLink size={12} /> Abrir módulo</Link>}
        {canvasAction && <button type="button" onClick={canvasAction.onClick} style={{
          border: 0, padding: '3px 0', background: 'transparent', color: 'var(--amber)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem',
        }}><ExternalLink size={12} /> {canvasAction.label}</button>}
        <button onClick={() => void copy()} disabled={!visible} aria-label="Copiar detalle visible" style={{
          marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center', border: 0,
          background: 'transparent', color: 'var(--text-muted)', cursor: visible ? 'pointer' : 'default', fontSize: '0.7rem',
        }}><Clipboard size={12} /> Copiar visible</button>
      </div>
      <pre id={`${regionId}-panel`} role="tabpanel" aria-labelledby={`${regionId}-${tab}`} style={{ margin: '7px 0 0', padding: 9, borderRadius: 7, background: 'var(--bg)', color: 'var(--text)',
        fontFamily: 'var(--font-mono)', fontSize: '0.72rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 280, overflow: 'auto' }}>{visible && !(tab === 'metadata' && visible === '{}') ? visible : absent}</pre>
      {tab === 'metadata' && payload.metadata_truncated && <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.68rem' }}>Parte de los metadatos se omitió por el límite de esta vista.</p>}
    </section>
  );
}

function hasSafeTechnical(payload: ToolPresentationPayload): boolean {
  return payload.technical.input != null || payload.technical.output != null || Object.keys(payload.technical.metadata).length > 0;
}

export function ProgressiveToolBlock({ tool, onOpenTechnicalCanvas, nested = false }: Props) {
  const payload = useMemo(() => getToolPresentation(tool), [tool]);
  // `tool_name` es estable también en snapshots históricos cuyo `title` era
  // solo el dominio (p. ej. "Calendario"). Así se corrige el historial sin
  // reescribir JSONB y las llamadas nuevas añaden action/context por separado.
  const displayTitle = payload.tool_name || payload.title;
  const forceOpen = payload.state === 'error' || payload.state === 'approval';
  const [functionalOpen, setFunctionalOpen] = useState(false);
  const [dismissedAutoKey, setDismissedAutoKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const functionalId = useId();
  const technicalId = useId();
  const facts = (payload.facts ?? []).slice(0, MAX_FACTS);
  const items = (payload.items ?? []).slice(0, showAll ? MAX_EXPANDED_ITEMS : MAX_INITIAL_ITEMS);
  const moduleLink = payload.module_link?.startsWith('/') && !payload.module_link.startsWith('//') ? payload.module_link : undefined;
  const hasTechnical = hasSafeTechnical(payload);
  const serializedOutput = safeJson(payload.technical.output);
  const canOpenTechnicalCanvas = !!onOpenTechnicalCanvas && !!serializedOutput && (
    payload.technical.truncated
    || serializedOutput.length > 1_500
    || ['code', 'file', 'diagnostic', 'command'].includes(payload.result_kind)
  );
  const hasFunctional = true; // Every visible call is inspectable, including honest absence.

  const autoKey = forceOpen ? `${payload.state}:${tool.completed_at ?? tool.id}` : null;
  const isFunctionalOpen = (autoKey != null && dismissedAutoKey !== autoKey) || functionalOpen;
  const toggleFunctional = () => {
    if (!hasFunctional) return;
    if (autoKey && dismissedAutoKey !== autoKey) {
      setDismissedAutoKey(autoKey);
      setFunctionalOpen(false);
      return;
    }
    if (autoKey && dismissedAutoKey === autoKey) {
      setDismissedAutoKey(null);
      return;
    }
    setFunctionalOpen((value) => !value);
  };

  return (
    <article aria-label={`${displayTitle}: ${payload.summary}`} style={{
      border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden',
      background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
    }}>
      <button
        type="button"
        aria-expanded={isFunctionalOpen}
        aria-controls={functionalId}
        onClick={toggleFunctional}
        style={{ width: '100%', minHeight: nested ? 34 : 38, padding: nested ? '6px 9px' : '7px 10px', border: 0,
          display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', color: 'var(--text)',
          background: 'transparent', cursor: hasFunctional ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}
      >
        <StateIcon state={payload.state} />
        <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
          {payload.state === 'running' || payload.state === 'pending' ? 'Tool en ejecución' : payload.state === 'approval' ? 'Tool pendiente de aprobación' : payload.state === 'error' ? 'Tool con error' : 'Tool completada'}
        </span>
        <ToolDomainIcon payload={payload} toolName={tool.tool} />
        <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.79rem' }}>
          <strong style={{ fontWeight: 600 }}>{displayTitle}</strong>
          {payload.action_label && <span style={{ color: 'var(--text-dim)' }}> · {payload.action_label}</span>}
          {payload.context_label && <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}> · {payload.context_label}</span>}
          <span style={{ color: 'var(--text-dim)' }}> · {payload.summary}</span>
        </span>
        {tool.duration_ms != null && <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', flexShrink: 0 }}>{tool.duration_ms} ms</span>}
        {hasFunctional && (isFunctionalOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />)}
      </button>

      {isFunctionalOpen && hasFunctional && (
        <div id={functionalId} style={{ borderTop: '1px solid var(--border)', padding: '9px 10px', fontSize: '0.77rem' }}>
          {facts.length > 0 && <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, auto) 1fr', gap: '4px 10px', margin: 0 }}>
            {facts.map((fact, index) => <div key={`${fact.label}-${index}`} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--text-muted)' }}>{fact.label}</dt><dd style={{ margin: 0, color: 'var(--text)' }}>{formatFactValue(fact.value, fact.format)}</dd>
            </div>)}
          </dl>}
          {items.length > 0 && <ul style={{ listStyle: 'none', padding: 0, margin: facts.length ? '9px 0 0' : 0, display: 'grid', gap: 5 }}>
            {items.map((item, index) => <li key={item.id ?? `${item.title}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <span><strong style={{ fontWeight: 500 }}>{item.title}</strong>{item.subtitle && <span style={{ color: 'var(--text-muted)' }}> · {item.subtitle}</span>}</span>
              {item.status && <span style={{ color: 'var(--text-dim)' }}>{item.status}</span>}
            </li>)}
          </ul>}
          {(payload.items?.length ?? 0) > MAX_INITIAL_ITEMS && <button type="button" onClick={() => setShowAll((v) => !v)} style={{
            border: 0, padding: '7px 0 0', background: 'transparent', color: 'var(--amber)', cursor: 'pointer', fontSize: '0.72rem',
          }}>{showAll ? 'Mostrar menos' : `Mostrar hasta ${Math.min(MAX_EXPANDED_ITEMS, payload.items!.length)}`}</button>}
          {!tool.presentation && <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Esta llamada no conservó un detalle técnico saneado.
          </p>}
          {/* El snapshot seguro se monta únicamente al abrir la tool. Output es
              la pestaña inicial; Input y Metadata son vistas alternativas. */}
          {<TechnicalDetails
            payload={payload.technical}
            identity={payload}
            state={payload.state}
            regionId={technicalId}
            moduleLink={moduleLink}
            canvasAction={canOpenTechnicalCanvas ? {
              label: 'Abrir en Canvas',
              onClick: () => onOpenTechnicalCanvas?.({ title: `${displayTitle} · resultado`, content: serializedOutput }),
            } : undefined}
          />}
          {hasTechnical && payload.technical.truncated && <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.68rem' }}>Vista truncada de forma segura.</p>}
        </div>
      )}
    </article>
  );
}
