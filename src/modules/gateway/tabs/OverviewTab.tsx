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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Radio, RotateCw, Play, Square,
  Cable, MessageSquare, Bot,
  Stethoscope, ShieldCheck,
  RefreshCw, DollarSign, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import { StatusPill } from '../components/StatusPill';
import { MetricCard } from '../components/MetricCard';
import { HealthCheckList } from '../components/HealthCheckList';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

const safeUncertainOperationErrors = new Set([
  'No se puede guardar el seguimiento en esta pestaña. No se ha enviado ninguna acción.',
  'No se puede leer el seguimiento de Gateway en esta pestaña. No se enviará ninguna acción.',
  'No se puede actualizar el seguimiento en esta pestaña.',
  'La respuesta no corresponde a la operación pendiente. No se repetirá la solicitud.',
  'Otra operación de Gateway está en curso. Comprueba su resultado antes de iniciar otra.',
  'Otra operación de Gateway sigue sin confirmar. Comprueba de nuevo o contacta con un administrador.',
  'No se puede comprobar cuál era la operación anterior. Contacta con un administrador.',
]);

export function OverviewTab() {
  const isMobile = useIsMobile();
  const {
    status, health, usage, models, channels, sessions, channelsCheckedAt, sessionsCheckedAt, modelsCheckedAt, modelsLoading, modelsError, statusLoading, statusError,
    gatewayOperation, pendingGatewayRequestId, operationUncertain, operationError,
    fetchSnapshot, fetchUsage, fetchModels, fetchChannels, fetchSessions, checkGatewayOperation,
    gatewayStart, gatewayStop, gatewayRestart, gatewayRecover,
  } = useGatewayStore();

  const navigate = useNavigate();
  const [refreshHover, setRefreshHover] = useState(false);
  const [restartConfirmationOpen, setRestartConfirmationOpen] = useState(false);
  const [doctorOutput, setDoctorOutput] = useState<string | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorHasFixes, setDoctorHasFixes] = useState(false);
  const [auditResult, setAuditResult] = useState<{ summary: { critical: number; warn: number; info: number }; findings: Array<{ check_id: string; severity: string; title: string; detail: string; remediation?: string }> } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Poll status every 15s using snapshot (fast, cached)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSnapshot();
    }, 15_000);
    return () => clearInterval(interval);
  }, [fetchSnapshot]);

  // Fetch usage on mount
  useEffect(() => {
    void fetchUsage();
    const current = useGatewayStore.getState();
    // Inventories load independently, and a remount does not duplicate an
    // outstanding read or present a prior list as a current availability check.
    if (!current.modelsLoading && !current.modelsCheckedAt) void fetchModels();
    if (!current.channelsLoading && !current.channelsCheckedAt) void fetchChannels();
    if (!current.sessionsLoading && !current.sessionsCheckedAt) void fetchSessions();
  }, [fetchUsage, fetchModels, fetchChannels, fetchSessions]);

  const handleAction = async (action: 'start' | 'recover' | 'stop' | 'restart') => {
    const operation = action === 'start' ? await gatewayStart() : action === 'recover' ? await gatewayRecover()
      : action === 'stop' ? await gatewayStop() : await gatewayRestart();
    if (operation?.state === 'succeeded') toast.success(operation.message);
    // An accepted/in-progress request is shown below; it is never a success toast.
  };
  const checkAgain = async () => {
    if (pendingGatewayRequestId || gatewayOperation?.state === 'running' || operationUncertain) await checkGatewayOperation();
    await fetchSnapshot();
  };
  const availability = status?.availability === 'available' && status.stale ? 'unknown' : status?.availability ?? 'unknown';
  const isRunning = status?.running === true;
  const operational = availability === 'available';
  const busy = !!pendingGatewayRequestId || gatewayOperation?.state === 'running' || operationUncertain;
  const needsAction = ['configuration_required', 'pairing_required', 'auth_required'].includes(availability);
  const canRequestRestart = isRunning && !status?.stale && (operational || availability === 'disconnected') && !busy;
  const safeUncertainError = operationError && safeUncertainOperationErrors.has(operationError) && operationError !== gatewayOperation?.message ? operationError : null;
  const stateLabel = gatewayOperation?.state === 'running' ? 'Recuperación en curso'
    : availability === 'available' ? 'Disponible'
    : availability === 'stopped' ? 'Detenido'
    : availability === 'disconnected' ? 'Sin conexión'
    : needsAction ? 'Requiere acción'
    : statusLoading ? 'Comprobando' : 'Sin comprobar';
  const explanation = status?.message ?? (availability === 'available'
    ? 'Gateway responde a una consulta autenticada. La disponibilidad de los modelos se comprueba por separado.'
    : availability === 'stopped' ? 'El servicio está detenido. Puedes iniciarlo desde aquí.'
    : availability === 'disconnected' ? 'El proceso está iniciado, pero Core no ha confirmado la conexión. Puedes volver a conectarlo.'
    : availability === 'pairing_required' ? 'La identidad interna de Core necesita revisión. Revisa el dispositivo antes de autorizarlo.'
    : availability === 'auth_required' ? 'Gateway necesita autorización. Revisa su configuración; reconectar no cambia los permisos.'
    : availability === 'configuration_required' ? 'La configuración no es válida o todavía no está preparada. Puedes revisarla en Settings.'
    : 'Todavía no se ha podido comprobar el servicio. Esto no demuestra que esté detenido o sin configurar.');

  // Default Model card: `agents.defaults.model.primary` may point to a
  // model that's no longer in `agents.defaults.models` (e.g. user
  // removed the provider but didn't update the pointer). Surface that
  // gap instead of showing a dangling string.
  const defaultModelId = status?.default_model;
  const configuredCount = status?.models_configured ?? 0;
  const modelInventoryCurrent = modelsCheckedAt !== null && !modelsLoading && !modelsError;
  const defaultIsConfigured = !!defaultModelId &&
    models.some(m => m.id === defaultModelId || m.model === defaultModelId);
  const defaultModelValue = !defaultModelId
    ? 'None'
    : !modelInventoryCurrent
      ? defaultModelId
      : defaultIsConfigured
      ? defaultModelId
      : `${defaultModelId} (invalid)`;
  const defaultModelSubtitle = !modelInventoryCurrent ? (modelsCheckedAt ? `Último inventario: ${new Date(modelsCheckedAt).toLocaleString()}` : 'Inventario sin comprobar') : !defaultModelId
    ? `${configuredCount} configured`
    : defaultIsConfigured
      ? `${configuredCount} configured`
      : 'Not in configured list';

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{
        padding: isMobile ? 12 : 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 1100,
      }}>
        {/* ─── Status Hero ─────────────────────────────────── */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: isMobile ? 16 : 20,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            {/* Left: status info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-md)',
                background: operational ? '#10b98115' : '#6b728015',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Radio size={24} style={{ color: operational ? '#10b981' : '#6b7280' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    OpenClaw Gateway
                  </span>
                  <StatusPill status={operational ? 'available' : needsAction ? 'warn' : availability === 'unknown' ? 'unknown' : availability} label={stateLabel} size="md" />
                </div>
                <div style={{
                  display: 'flex',
                  gap: isMobile ? 10 : 20,
                  flexWrap: 'wrap',
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {status?.version && <span>v{status.version}</span>}
                  {status?.service_status && <span>{status.service_status}</span>}
                  {status?.port && <span>Port: {status.port}</span>}
                  {status?.bind && <span>Bind: {status.bind}</span>}
                </div>
              </div>
            </div>

            {/* Right: action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => void checkAgain()}
                disabled={statusLoading}
                aria-label="Comprobar de nuevo"
                onMouseEnter={() => setRefreshHover(true)}
                onMouseLeave={() => setRefreshHover(false)}
                style={{
                  background: refreshHover ? 'var(--surface-hover)' : 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  transition: 'var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Comprobar de nuevo"
              >
                <RefreshCw size={14} />
              </button>

              {availability === 'stopped' && (
                <ActionButton icon={Play} label="Iniciar" onClick={() => void handleAction('start')} loading={busy} color="var(--success)" />
              )}
              {availability === 'disconnected' && (
                <ActionButton icon={Cable} label="Reconectar" onClick={() => void handleAction('recover')} loading={busy} color="var(--amber)" />
              )}
              {needsAction && (
                <ActionButton icon={ShieldCheck} label="Resolver el problema" onClick={() => { void navigate(availability === 'pairing_required' ? '/gateway?tab=devices' : '/settings?group=connectivity&section=gateway-auth'); }} loading={false} color="var(--warning)" />
              )}
              {(operational || availability === 'disconnected') && isRunning && !status?.stale && (
                <ActionButton icon={RotateCw} label="Reiniciar" onClick={() => setRestartConfirmationOpen(true)} loading={busy} color="var(--warning)" />
              )}
              {operational && isRunning && (
                <ActionButton icon={Square} label="Stop" onClick={() => void handleAction('stop')} loading={busy} color="var(--error)" />
              )}
            </div>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>{explanation}</p>
          {status?.checked_at && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{status.stale ? 'Última comprobación' : 'Comprobado'}: {new Date(status.checked_at).toLocaleString()}</p>}
          {status?.stale && status.last_known && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Último dato válido: {new Date(status.last_known.checked_at).toLocaleString()} · {status.last_known.reachable ? 'respondía' : status.last_known.running ? 'proceso iniciado' : 'detenido'}</p>}
          {statusError && <p role="alert" style={{ color: 'var(--warning)', fontSize: 13 }}>No se pudo actualizar el estado. Comprueba de nuevo; los datos anteriores no son una comprobación actual.</p>}
          {(gatewayOperation || operationError || operationUncertain) && (
            <div role={gatewayOperation?.state === 'failed' || operationError ? 'alert' : 'status'} style={{ marginTop: 12, fontSize: 13, color: gatewayOperation?.state === 'succeeded' ? 'var(--success)' : 'var(--text-dim)' }}>
              {gatewayOperation?.message}
              {operationUncertain ? <>{safeUncertainError !== 'No se puede guardar el seguimiento en esta pestaña. No se ha enviado ninguna acción.' && <p>El resultado todavía no se ha confirmado. Usa Comprobar de nuevo; no se repetirá la operación automáticamente.</p>}{safeUncertainError && <p>{safeUncertainError}</p>}</> : operationError && <p>{operationError}</p>}
            </div>
          )}
          <Dialog open={restartConfirmationOpen} onOpenChange={setRestartConfirmationOpen}>
            <DialogContent style={{ width: 'min(90vw, 440px)' }}>
              <DialogTitle>¿Reiniciar Gateway?</DialogTitle>
              <DialogDescription>
                La conexión se interrumpirá brevemente. Antes de continuar, comprueba que no haya cambios pendientes o de resultado desconocido; Micelclaw no puede verificarlos todos. El reinicio no vuelve a enviar esos cambios.
              </DialogDescription>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }} onClick={() => setRestartConfirmationOpen(false)}>Cancelar</button>
                <button style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', border: 0, background: 'var(--warning)', color: 'var(--card)', cursor: canRequestRestart ? 'pointer' : 'not-allowed', opacity: canRequestRestart ? 1 : 0.6 }} disabled={!canRequestRestart} onClick={() => { if (!canRequestRestart) return; setRestartConfirmationOpen(false); void handleAction('restart'); }}>Confirmar reinicio</button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* ─── Metrics Grid ────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}>
          <MetricCard
            icon={Cable}
            label="Channels"
            value={channelsCheckedAt ? channels.filter(channel => channel.status === 'connected').length : '—'}
            subtitle={channelsCheckedAt ? `Conectados · lista ${new Date(channelsCheckedAt).toLocaleTimeString()}` : 'Inventario sin comprobar'}
            accentColor="#06b6d4"
          />
          <MetricCard
            icon={MessageSquare}
            label="Sesiones recientes"
            value={sessionsCheckedAt ? sessions.length : '—'}
            subtitle={sessionsCheckedAt ? `Lista ${new Date(sessionsCheckedAt).toLocaleTimeString()}` : 'Inventario sin comprobar'}
            accentColor="#8b5cf6"
          />
          <MetricCard
            icon={Bot}
            label="Default Model"
            value={defaultModelValue}
            subtitle={defaultModelSubtitle}
            accentColor={modelInventoryCurrent && defaultModelId && !defaultIsConfigured ? '#f43f5e' : '#f59e0b'}
          />
          <MetricCard
            icon={DollarSign}
            label="Usage Today"
            value={usage?.total_tokens != null
              ? `${(usage.total_tokens / 1000).toFixed(1)}k`
              : '—'}
            subtitle={usage?.total_cost_usd != null
              ? `$${usage.total_cost_usd.toFixed(4)}`
              : undefined}
            accentColor="#10b981"
          />
        </div>

        {/* ─── Health Checks ───────────────────────────────── */}
        {health && health.checks.length > 0 && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}>
              <Stethoscope size={16} style={{ color: 'var(--text-dim)' }} />
              <span style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
              }}>
                Health Checks
              </span>
              <StatusPill status={health.status} size="sm" />
            </div>
            <HealthCheckList checks={health.checks} />
          </div>
        )}

        {/* ─── Quick Actions ───────────────────────────────── */}
        <div>
          <span style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            display: 'block',
            marginBottom: 10,
          }}>
            Quick Actions
          </span>
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <QuickActionBtn icon={Stethoscope} label="Run Doctor" loading={doctorLoading} onClick={async () => {
              setDoctorLoading(true);
              setDoctorOutput(null);
              setAuditResult(null);
              try {
                const res = await api.post<{ data: { output: string; has_fixes: boolean } }>('/gateway/doctor');
                const d = (res as any).data ?? res;
                setDoctorOutput(d.output);
                setDoctorHasFixes(d.has_fixes);
              } catch { toast.error('Failed to run doctor'); }
              finally { setDoctorLoading(false); }
            }} />
            <QuickActionBtn icon={ShieldCheck} label="Security Audit" loading={auditLoading} onClick={async () => {
              setAuditLoading(true);
              setAuditResult(null);
              setDoctorOutput(null);
              try {
                const res = await api.get<{ data: { summary: any; findings: any[] } }>('/gateway/security-audit');
                setAuditResult((res as any).data ?? res);
              } catch { toast.error('Failed to run security audit'); }
              finally { setAuditLoading(false); }
            }} />
          </div>
        </div>

        {/* Doctor output panel */}
        {doctorOutput && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Doctor Diagnostic
              </span>
              {doctorHasFixes && (
                <button
                  onClick={async () => {
                    setDoctorLoading(true);
                    try {
                      const res = await api.post<{ data: { output: string; has_fixes: boolean } }>('/gateway/doctor', undefined, { timeout: 60000 } as any);
                      const d = (res as any).data ?? res;
                      setDoctorOutput(d.output);
                      setDoctorHasFixes(d.has_fixes);
                      toast.success('Fixes applied');
                    } catch { toast.error('Failed to apply fixes'); }
                    finally { setDoctorLoading(false); }
                  }}
                  style={{
                    padding: '4px 10px', fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
                    background: 'var(--amber)', color: '#000', border: 'none',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  Apply Fixes
                </button>
              )}
            </div>
            <div style={{
              background: '#0d0d0d', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '10px 14px',
              maxHeight: 320, overflowY: 'auto', overflowX: 'auto',
              fontFamily: 'var(--font-mono)', fontSize: '0.625rem',
              lineHeight: 1.5, color: 'var(--text-dim)', whiteSpace: 'pre-wrap',
            }}>
              {doctorOutput}
            </div>
          </div>
        )}

        {/* Security Audit results */}
        {auditResult && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Security Audit — {auditResult.summary.critical} critical · {auditResult.summary.warn} warnings · {auditResult.summary.info} info
              </span>
              {auditResult.findings.length > 0 && (
                <button
                  onClick={async () => {
                    setAuditLoading(true);
                    try {
                      const res = await api.post<{ data: any }>('/gateway/security-audit/fix');
                      setAuditResult((res as any).data ?? res);
                      toast.success('Safe fixes applied');
                    } catch { toast.error('Failed to apply fixes'); }
                    finally { setAuditLoading(false); }
                  }}
                  style={{
                    padding: '4px 10px', fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
                    background: 'var(--amber)', color: '#000', border: 'none',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  Apply Safe Fixes
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {auditResult.findings.map((f, i) => (
                <div key={i} style={{
                  padding: '8px 12px', background: 'var(--surface)',
                  borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: f.severity === 'critical' ? '#f43f5e' : f.severity === 'warn' ? '#f97316' : '#3b82f6',
                    }} />
                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>{f.title}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 'auto', textTransform: 'uppercase' }}>{f.severity}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{f.detail}</div>
                  {f.remediation && (
                    <div style={{ fontSize: '0.6875rem', color: 'var(--amber)', marginTop: 4 }}>Fix: {f.remediation}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function ActionButton({ icon: Icon, label, onClick, loading, color }: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  loading: boolean;
  color: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: hovered ? `${color}20` : 'transparent',
        color,
        border: `1px solid ${color}40`,
        borderRadius: 'var(--radius-sm)',
        padding: '6px 12px',
        fontSize: '0.8125rem',
        fontWeight: 500,
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <Icon size={14} />
      {loading ? `${label}...` : label}
    </button>
  );
}

function QuickActionBtn({ icon: Icon, label, onClick, loading }: { icon: typeof Play; label: string; onClick: () => void; loading?: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: hovered ? 'var(--surface-hover)' : 'var(--surface)',
        color: 'var(--text-dim)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 14px',
        fontSize: '0.8125rem',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Icon size={14} />}
      {loading ? `${label}...` : label}
    </button>
  );
}
