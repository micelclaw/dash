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

/**
 * ConfigHealthBanner — visualiza inconsistencias en openclaw.json.
 *
 * Llama a `GET /gateway/config-health?check_agent_auth=1` al montar y
 * cada vez que llega un WS `agent.model_changed` (con 500 ms de debounce
 * para que el filesystem write del configPatch se asiente). Aparece solo
 * si `has_issues=true` y devuelve `null` en mock mode o tras un fetch
 * fallido (silent). Filtra orphans de OTROS usuarios por scope prefix.
 *
 * Tres severidades: 🔴 primary/fallbacks rotos → 🟡 agentes individuales
 * → 🔵 modelos en allow-list sin uso. El color del banner refleja la
 * peor severidad presente.
 *
 * Acciones rápidas (per categoría):
 *   • Ir al agente   → navigate('/agents?selected=<UUID>')
 *   • Reasignar modelo → modal con lista de modelos válidos →
 *                        POST /managed-agents/:id/set-model
 *   • Elegir otro default → modal → setDefaultModel(model)
 *
 * Dismiss con heurística de count:
 *   - Si el count baja o queda igual tras dismiss → banner permanece oculto.
 *   - Si el count sube (nueva inconsistencia) → reaparece automáticamente.
 *   - Botón Refresh siempre resetea dismissed (intent explícito).
 *
 * Lookup openclaw_id → managed_agent.id vía useAgents(); si el agente
 * no pertenece al usuario actual no se renderiza (scope filter), y si la
 * lista todavía no está cargada los botones aparecen disabled.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  RefreshCw,
  ExternalLink,
  Edit,
  Loader2,
  Wand2,
} from 'lucide-react';
import { api } from '@/services/api';
import * as gwService from '@/services/gateway.service';
import { useGatewayStore } from '@/stores/gateway.store';
import { useAuthStore } from '@/stores/auth.store';
import { useWebSocket } from '@/hooks/use-websocket';
import { useIsMobile } from '@/hooks/use-media-query';
import type { ConfigHealthReport } from '@/modules/gateway/types';
import type { ManagedAgent } from '@/modules/agents/types';

// ─── Helpers puros ──────────────────────────────────────────────────

type Severity = 'red' | 'amber' | 'blue' | 'none';

function severityOf(r: ConfigHealthReport): Severity {
  if (r.orphan_primary || r.orphan_fallbacks.length > 0) return 'red';
  if (r.orphan_agent_models.length > 0 || (r.agents_missing_auth?.length ?? 0) > 0) return 'amber';
  if (r.orphan_allowed_models.length > 0) return 'blue';
  return 'none';
}

/**
 * Hash + count de issues VISIBLES al usuario (tras filtrar scope).
 * Usado para la heurística de dismiss: si el count sube, el banner reaparece;
 * si baja o queda igual, se mantiene oculto.
 */
function computeIssuesHash(r: ConfigHealthReport, userPrefix: string): { hash: string; count: number } {
  const prefix = userPrefix ? userPrefix + '--' : null;
  const inScope = (agentId: string) => (prefix ? agentId.startsWith(prefix) : true);

  const allowed = r.orphan_allowed_models;
  const agents = r.orphan_agent_models.filter((a) => inScope(a.agent_id));
  const missingAuth = (r.agents_missing_auth ?? []).filter((a) => inScope(a.agent_id));
  const primaryHasIssue = r.orphan_primary !== null;
  const fallbacks = r.orphan_fallbacks;

  const parts = [
    ...allowed.map((m) => `al:${m}`),
    ...agents.map((a) => `ag:${a.agent_id}:${a.model}`),
    primaryHasIssue ? `pr:${r.orphan_primary}` : '',
    ...fallbacks.map((f) => `fb:${f}`),
    ...missingAuth.map((a) => `ma:${a.agent_id}:${a.model}`),
  ].filter(Boolean).sort();
  return { hash: parts.join('|'), count: parts.length };
}

const SEVERITY_STYLE: Record<Exclude<Severity, 'none'>, {
  bg: string;
  border: string;
  text: string;
  Icon: typeof AlertTriangle;
  label: string;
}> = {
  red: {
    bg: 'color-mix(in srgb, #ef4444 12%, transparent)',
    border: '1px solid color-mix(in srgb, #ef4444 35%, transparent)',
    text: '#ef4444',
    Icon: AlertTriangle,
    label: 'Crítico',
  },
  amber: {
    bg: 'var(--amber-dim)',
    border: '1px solid var(--amber)',
    text: 'var(--amber)',
    Icon: AlertCircle,
    label: 'Advertencia',
  },
  blue: {
    bg: 'color-mix(in srgb, #3b82f6 12%, transparent)',
    border: '1px solid color-mix(in srgb, #3b82f6 35%, transparent)',
    text: '#3b82f6',
    Icon: Info,
    label: 'Informativo',
  },
};

// ─── Modal interno: ModelPickerModal ────────────────────────────────

interface ModelPickerProps {
  title: string;
  description: string;
  currentValue: string | null;
  onConfirm: (model: string) => Promise<void> | void;
  onClose: () => void;
}

function ModelPickerModal({ title, description, currentValue, onConfirm, onClose }: ModelPickerProps) {
  const models = useGatewayStore((s) => s.models);
  const validModels = useMemo(
    () => (models ?? []).filter((m) => !m.orphan && m.status === 'available'),
    [models],
  );
  const [selected, setSelected] = useState<string>(currentValue ?? validModels[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);

  const isEmpty = validModels.length === 0;

  const handleConfirm = useCallback(async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(selected);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [selected, submitting, onConfirm, onClose]);

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [submitting, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => !submitting && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          width: '100%',
          maxWidth: 520,
          fontFamily: 'var(--font-sans)',
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text)', fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} disabled={submitting} aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: submitting ? 'wait' : 'pointer', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {description}
        </p>

        {isEmpty ? (
          <div style={{
            padding: '16px 12px',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-dim)',
            fontSize: '0.8125rem',
            lineHeight: 1.5,
          }}>
            No hay modelos válidos. Configura un provider primero en{' '}
            <strong style={{ color: 'var(--text)' }}>Gateway → Models → Catalog</strong>.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            {validModels.map((m) => {
              const isSelected = m.id === selected;
              const isCurrent = m.id === currentValue;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m.id)}
                  title={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 12px',
                    background: isSelected ? 'var(--amber-dim)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    color: isSelected ? 'var(--amber)' : 'var(--text)',
                    fontSize: '0.8125rem',
                    fontFamily: 'inherit',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                    gap: 8,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.id}</span>
                  {isCurrent && <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', flexShrink: 0 }}>actual</span>}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              padding: '6px 14px', borderRadius: 'var(--radius-md)',
              color: 'var(--text)', cursor: submitting ? 'wait' : 'pointer',
              fontSize: '0.8125rem', fontFamily: 'inherit',
            }}
          >
            Cancelar
          </button>
          {!isEmpty && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !selected}
              style={{
                background: 'var(--amber)', border: 'none',
                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                color: '#000', cursor: submitting ? 'wait' : 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: submitting || !selected ? 0.6 : 1,
              }}
            >
              {submitting && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
              Confirmar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ConfigHealthBanner ─────────────────────────────────────────────

type PickerState =
  | { mode: 'agent'; openclawId: string; managedAgentId: string; currentModel: string }
  | { mode: 'default'; currentPrimary: string | null }
  | null;

export function ConfigHealthBanner() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const userPrefix = useAuthStore((s) => s.user?.id?.slice(0, 8) ?? '');

  // ─── Estado del fetch + dismiss ──────────────────────────────────
  const seqRef = useRef(0);
  const [report, setReport] = useState<ConfigHealthReport | null>(null);
  // Agentes con hidden incluidos — necesario para resolver el UUID de
  // `studio-builder` (Studio v2) y otros hidden cuando aparecen como orphan.
  // GET /managed-agents filtra hidden por defecto; aquí pasamos
  // ?include_hidden=1 explícitamente. Si falla, queda como [] y los
  // botones de acción se renderizan disabled (degradación segura).
  const [agentsAll, setAgentsAll] = useState<ManagedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetchKey, setRefetchKey] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [picker, setPicker] = useState<PickerState>(null);

  // Fetch con guard anti-race y mock-mode opt-out.
  // Pedimos config-health + lista de agentes (con hidden) en paralelo.
  useEffect(() => {
    if (import.meta.env.VITE_MOCK_API === 'true') {
      setLoading(false);
      return;
    }
    const mySeq = ++seqRef.current;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      gwService.getConfigHealth({ checkAgentAuth: true }),
      api.get<{ data: ManagedAgent[] }>('/managed-agents', { include_hidden: '1' })
        .then((res) => res.data)
        .catch(() => [] as ManagedAgent[]),
    ])
      .then(([r, agents]) => {
        if (cancelled || mySeq !== seqRef.current) return;
        setReport(r);
        setAgentsAll(agents);
      })
      .catch(() => {
        if (cancelled || mySeq !== seqRef.current) return;
        setReport(null);
      })
      .finally(() => {
        if (cancelled || mySeq !== seqRef.current) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refetchKey]);

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  // WS re-fetch tras cambios de modelo (500 ms debounce para que el
  // configPatch del backend se asiente en disco antes de leer).
  const wsEvent = useWebSocket('agent.model_changed');
  useEffect(() => {
    if (!wsEvent) return;
    const t = setTimeout(refetch, 500);
    return () => clearTimeout(t);
  }, [wsEvent, refetch]);

  // Lookup openclaw_id → managed_agent.id (devuelve null si fuera de scope).
  // `agentsAll` incluye hidden_from_ui=true (vía ?include_hidden=1), así que
  // `studio-builder` y otros agentes hidden quedan resolubles aquí.
  const resolveManagedAgent = useCallback((openclawId: string) => {
    if (!userPrefix || !openclawId.startsWith(userPrefix + '--')) return null;
    const name = openclawId.slice(userPrefix.length + 2);
    return agentsAll.find((a) => a.name === name) ?? null;
  }, [agentsAll, userPrefix]);

  // ─── Filtrado por scope ──────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!report) return null;
    const inScope = (id: string) => userPrefix && id.startsWith(userPrefix + '--');
    return {
      orphan_allowed_models: report.orphan_allowed_models,
      orphan_agent_models: report.orphan_agent_models.filter((a) => inScope(a.agent_id)),
      orphan_primary: report.orphan_primary,
      orphan_fallbacks: report.orphan_fallbacks,
      agents_missing_auth: (report.agents_missing_auth ?? []).filter((a) => inScope(a.agent_id)),
    };
  }, [report, userPrefix]);

  // Hash + count visibles para la heurística de dismiss.
  const issues = useMemo(() => report ? computeIssuesHash(report, userPrefix) : { hash: '', count: 0 }, [report, userPrefix]);

  // ─── Acciones ────────────────────────────────────────────────────
  const handleReassignAgent = useCallback(async (model: string) => {
    if (picker?.mode !== 'agent') return;
    // El backend devuelve `auth_propagation: {source, reason}` cuando aplica
    // (ver `core/src/routes/managed-agents.ts:set-model`). Lo usamos para
    // formatear un toast preciso en lugar del genérico anterior.
    const res = await api.post<{
      data: { auth_propagation?: { source: string | null; reason: string } | null };
    }>(`/managed-agents/${picker.managedAgentId}/set-model`, { model });

    const ap = res.data.auth_propagation;
    const slashIdx = model.indexOf('/');
    const provider = slashIdx > 0 ? model.slice(0, slashIdx) : model;

    if (ap?.reason === 'propagated' && ap.source) {
      toast.success(`Modelo reasignado. Auth propagada desde ${ap.source} para ${provider}.`);
    } else if (ap?.reason === 'no_donor') {
      toast.warning(`Modelo reasignado, pero no hay donor con auth para ${provider}. Configura el token manualmente.`);
    } else if (ap?.reason === 'already_present') {
      toast.success('Modelo reasignado. (Auth ya estaba presente.)');
    } else {
      // 'unknown_provider', null (no provider in model), o error capturado por backend
      toast.success('Modelo reasignado.');
    }
    // WS llega después; el banner se actualizará solo. No llamar a refetch aquí
    // para no duplicar (esperar el WS event en ~500 ms).
  }, [picker]);

  const handleSetDefault = useCallback(async (model: string) => {
    await gwService.setDefaultModel(model);
    toast.success('Default primary actualizado.');
    // No hay WS para set-default — refetch manual.
    refetch();
  }, [refetch]);

  const handleNavigateToAgent = useCallback((openclawId: string) => {
    const managed = resolveManagedAgent(openclawId);
    if (!managed) return;
    navigate(`/agents?selected=${managed.id}`);
  }, [navigate, resolveManagedAgent]);

  // Auto-fix: cierra el modal si está abierto, dispara el endpoint, muestra
  // toast con count y refetcha. Si `remaining_issues.has_issues`, warning.
  const [autoFixBusy, setAutoFixBusy] = useState(false);
  const handleAutoFix = useCallback(async () => {
    if (autoFixBusy) return;
    setPicker(null); // cualquier modal abierto se cancela
    setAutoFixBusy(true);
    try {
      const result = await gwService.autoFixConfigHealth();
      const count = result.fixes_applied.length;
      if (count === 0 && !result.remaining_issues.has_issues) {
        toast.success('No había inconsistencias que arreglar.');
      } else if (result.remaining_issues.has_issues) {
        toast.warning(
          `Aplicadas ${count} fixes. Quedan ${
            result.remaining_issues.orphan_agent_models.length +
            result.remaining_issues.orphan_allowed_models.length +
            (result.remaining_issues.orphan_primary ? 1 : 0) +
            result.remaining_issues.orphan_fallbacks.length
          } sin resolver (probablemente faltan modelos válidos — configura un provider).`,
        );
      } else {
        toast.success(`${count} ${count === 1 ? 'inconsistencia' : 'inconsistencias'} resuelta${count === 1 ? '' : 's'}.`);
      }
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auto-fix falló');
    } finally {
      setAutoFixBusy(false);
    }
  }, [autoFixBusy, refetch]);

  // ─── Render guard ────────────────────────────────────────────────
  // Silent en mock mode, durante la carga inicial, y si has_issues=false.
  // También cuando todas las categorías visibles (post-scope-filter) están vacías.
  if (loading && !report) return null;
  if (!report || !report.has_issues || !filtered) return null;

  const visibleTotal =
    filtered.orphan_allowed_models.length +
    filtered.orphan_agent_models.length +
    (filtered.orphan_primary ? 1 : 0) +
    filtered.orphan_fallbacks.length +
    filtered.agents_missing_auth.length;
  if (visibleTotal === 0) return null; // todo era de otros usuarios

  // Heurística de dismiss basada en count
  if (dismissed && issues.count <= dismissedCount) return null;

  const sev = severityOf({
    has_issues: true,
    orphan_allowed_models: filtered.orphan_allowed_models,
    orphan_agent_models: filtered.orphan_agent_models,
    orphan_primary: filtered.orphan_primary,
    orphan_fallbacks: filtered.orphan_fallbacks,
    agents_missing_auth: filtered.agents_missing_auth,
    generated_at: report.generated_at,
  });
  if (sev === 'none') return null;

  const style = SEVERITY_STYLE[sev];
  const SeverityIcon = style.Icon;

  return (
    <>
      <div
        role="alert"
        style={{
          margin: isMobile ? '8px 12px' : '10px 16px',
          padding: isMobile ? '10px 12px' : '12px 14px',
          background: style.bg,
          border: style.border,
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.8125rem',
        }}
      >
        {/* Header: severity + title + actions */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 10, marginBottom: 10, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: style.text, fontWeight: 600, minWidth: 0 }}>
            <SeverityIcon size={16} style={{ flexShrink: 0 }} />
            <span>
              Tu config tiene {visibleTotal} {visibleTotal === 1 ? 'inconsistencia' : 'inconsistencias'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {/* Auto-fix: visible cuando hay 2+ issues O cuando hay primary/fallback
                rotos (afectan a todos los agentes), porque ahí el ROI vs click
                individual es alto. Para 1 issue trivial, se mantiene oculto. */}
            {(visibleTotal >= 2 || filtered.orphan_primary || filtered.orphan_fallbacks.length > 0) && (
              <button
                onClick={() => {
                  if (window.confirm(
                    `Esto reasignará ${visibleTotal} inconsistencia${visibleTotal === 1 ? '' : 's'} a tus modelos válidos y propagará la auth automáticamente. ¿Continuar?`,
                  )) {
                    void handleAutoFix();
                  }
                }}
                disabled={autoFixBusy || loading}
                aria-label="Auto-fix all"
                title="Arreglar todas las inconsistencias automáticamente"
                style={{
                  background: style.text, border: 'none',
                  color: '#000', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                  cursor: autoFixBusy ? 'wait' : 'pointer', fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4,
                  opacity: autoFixBusy || loading ? 0.6 : 1,
                }}
              >
                {autoFixBusy
                  ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Wand2 size={11} />}
                Arreglar todo
              </button>
            )}
            <button
              onClick={() => { setDismissed(false); refetch(); }}
              disabled={loading}
              aria-label="Refresh"
              title="Refrescar"
              style={{
                background: 'transparent', border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
                color: style.text, padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                cursor: loading ? 'wait' : 'pointer', fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading
                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                : <RefreshCw size={11} />}
              Refrescar
            </button>
            <button
              onClick={() => { setDismissed(true); setDismissedCount(issues.count); }}
              aria-label="Hide"
              title="Ocultar (reaparecerá si surge nueva inconsistencia)"
              style={{
                background: 'transparent', border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
                color: style.text, padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', fontSize: '0.75rem',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={11} />
            </button>
          </div>
        </div>

        {/* Issues body — agrupado por categoría */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 🔴 Primary roto */}
          {filtered.orphan_primary && (
            <IssueRow
              severity="red"
              title="Default primary apunta a provider eliminado"
              detail={filtered.orphan_primary}
              actions={(
                <ActionButton
                  label="Elegir otro default"
                  onClick={() => setPicker({ mode: 'default', currentPrimary: filtered.orphan_primary })}
                />
              )}
            />
          )}

          {/* 🔴 Fallbacks rotos */}
          {filtered.orphan_fallbacks.length > 0 && (
            <IssueRow
              severity="red"
              title={`${filtered.orphan_fallbacks.length} fallback${filtered.orphan_fallbacks.length === 1 ? '' : 's'} con provider eliminado`}
              detail={filtered.orphan_fallbacks.join(', ')}
            />
          )}

          {/* 🟡 Agentes con missing auth (por agente) */}
          {filtered.agents_missing_auth.map((a) => {
            const managed = resolveManagedAgent(a.agent_id);
            return (
              <IssueRow
                key={`ma-${a.agent_id}`}
                severity="amber"
                title={`${a.agent_id} sin token de ${a.provider}`}
                detail={`Modelo asignado: ${a.model}`}
                actions={(
                  <>
                    <ActionButton
                      label="Ir al agente"
                      icon={<ExternalLink size={11} />}
                      onClick={() => handleNavigateToAgent(a.agent_id)}
                      disabled={!managed}
                      tooltip={!managed ? 'Agente fuera de tu scope' : undefined}
                    />
                    <ActionButton
                      label="Reasignar modelo"
                      icon={<Edit size={11} />}
                      onClick={() => managed && setPicker({
                        mode: 'agent',
                        openclawId: a.agent_id,
                        managedAgentId: managed.id,
                        currentModel: a.model,
                      })}
                      disabled={!managed}
                    />
                  </>
                )}
              />
            );
          })}

          {/* 🟡 Agentes apuntando a provider inexistente */}
          {filtered.orphan_agent_models.map((a) => {
            const managed = resolveManagedAgent(a.agent_id);
            return (
              <IssueRow
                key={`ag-${a.agent_id}`}
                severity="amber"
                title={`${a.agent_id} apunta a provider eliminado`}
                detail={`Modelo asignado: ${a.model}`}
                actions={(
                  <>
                    <ActionButton
                      label="Ir al agente"
                      icon={<ExternalLink size={11} />}
                      onClick={() => handleNavigateToAgent(a.agent_id)}
                      disabled={!managed}
                      tooltip={!managed ? 'Agente fuera de tu scope' : undefined}
                    />
                    <ActionButton
                      label="Reasignar modelo"
                      icon={<Edit size={11} />}
                      onClick={() => managed && setPicker({
                        mode: 'agent',
                        openclawId: a.agent_id,
                        managedAgentId: managed.id,
                        currentModel: a.model,
                      })}
                      disabled={!managed}
                    />
                  </>
                )}
              />
            );
          })}

          {/* 🔵 Allow-list models sin provider */}
          {filtered.orphan_allowed_models.length > 0 && (
            <IssueRow
              severity="blue"
              title={`${filtered.orphan_allowed_models.length} modelo${filtered.orphan_allowed_models.length === 1 ? '' : 's'} en allow-list sin provider`}
              detail={filtered.orphan_allowed_models.join(', ')}
              note="Se limpiarán automáticamente al borrar el provider o reasignar agentes."
            />
          )}
        </div>
      </div>

      {/* Modal picker */}
      {picker?.mode === 'agent' && (
        <ModelPickerModal
          title="Reasignar modelo del agente"
          description={`Selecciona un modelo válido para ${picker.openclawId}. La auth se propagará automáticamente si el agente no tiene token para el nuevo provider.`}
          currentValue={picker.currentModel}
          onConfirm={handleReassignAgent}
          onClose={() => setPicker(null)}
        />
      )}
      {picker?.mode === 'default' && (
        <ModelPickerModal
          title="Elegir nuevo default primary"
          description="Este modelo será el que usen los agentes que no tienen uno asignado explícitamente."
          currentValue={picker.currentPrimary}
          onConfirm={handleSetDefault}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}

// ─── Subcomponentes presentation ────────────────────────────────────

interface IssueRowProps {
  severity: 'red' | 'amber' | 'blue';
  title: string;
  detail?: string;
  note?: string;
  actions?: React.ReactNode;
}

function IssueRow({ severity, title, detail, note, actions }: IssueRowProps) {
  const style = SEVERITY_STYLE[severity];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      paddingLeft: 22, position: 'relative',
    }}>
      <span style={{
        position: 'absolute', left: 0, top: 2,
        fontSize: '0.875rem', lineHeight: 1,
      }}>{severity === 'red' ? '🔴' : severity === 'amber' ? '🟡' : '🔵'}</span>
      <div style={{ color: style.text, fontWeight: 500 }}>{title}</div>
      {detail && (
        <div title={detail} style={{
          color: 'var(--text-dim)', fontSize: '0.75rem',
          fontFamily: 'monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{detail}</div>
      )}
      {note && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontStyle: 'italic' }}>
          ℹ {note}
        </div>
      )}
      {actions && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>{actions}</div>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  tooltip?: string;
}

function ActionButton({ label, onClick, icon, disabled, tooltip }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      style={{
        background: disabled ? 'transparent' : 'var(--surface)',
        border: '1px solid var(--border)',
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        color: disabled ? 'var(--text-muted)' : 'var(--text)',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
