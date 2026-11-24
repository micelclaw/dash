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
  Radio, Play,
  Cable, MessageSquare, Bot,
  Stethoscope, ShieldCheck,
  RefreshCw, DollarSign, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/services/api';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import { StatusPill } from '../components/StatusPill';
import { MetricCard } from '../components/MetricCard';
import { HealthCheckList } from '../components/HealthCheckList';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { NativeOpenclawHost } from '@/components/openclaw/NativeOpenclawHost';
import { NATIVE_HOST_ADAPTER_DIGEST, type NativeHostTarget } from '@/services/openclaw-host-bridge';

const connectionTarget = async (): Promise<NativeHostTarget> => ({ surface: 'connection' });
type DoctorReport = {
  blocked: boolean; incomplete: boolean; passed: boolean;
  inspections_reported: number; checks_skipped: number | null;
  severities: { info: number; warning: number; error: number };
};
type Audit = {
  summary: { critical: number; warn: number; info: number };
  findings: Array<{ checkId: string; severity: string; title: string; detail: string; remediation?: string }>;
};
const diagnosedAt = (value: string) => new Date(value).toLocaleTimeString('es-ES');

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
  const user = useAuthStore((state) => state.user);
  const generation = useAuthStore((state) => state.sessionGeneration);
  if (user?.role !== 'owner' && user?.role !== 'admin') return <p role="status" className="p-4">Se necesita acceso de administración para ver Gateway.</p>;
  return <GatewayOverview key={`${user.id}:${generation}:${user.role}`} />;
}

function GatewayOverview() {
  const isMobile = useIsMobile();
  const {
    status, health, usage, usageLoading, usageError, models, channelsRuntime, sessions, sessionsCheckedAt, modelsCheckedAt,
    channelsError, channelsLoading, sessionsError, sessionsLoading, modelsLoading, modelsError, statusLoading, statusError,
    gatewayOperation, pendingGatewayRequestId, operationUncertain, operationError,
    fetchSnapshot, fetchUsage, fetchModels, fetchChannels, fetchSessions, checkGatewayOperation,
    gatewayStart,
  } = useGatewayStore();

  const navigate = useNavigate();
  const [refreshHover, setRefreshHover] = useState(false);
  const [doctorConfirmationOpen, setDoctorConfirmationOpen] = useState(false);
  const [doctorReport, setDoctorReport] = useState<DoctorReport | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<Audit | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditConfirmationOpen, setAuditConfirmationOpen] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

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
    void fetchChannels(true);
    if (!current.sessionsLoading && !current.sessionsCheckedAt) void fetchSessions();
  }, [fetchUsage, fetchModels, fetchChannels, fetchSessions]);

  const startGateway = async () => {
    const operation = await gatewayStart();
    if (operation?.state === 'succeeded') toast.success(operation.message);
    // An accepted/in-progress request is shown below; it is never a success toast.
  };
  const checkAgain = async () => {
    if (pendingGatewayRequestId || gatewayOperation?.state === 'running' || operationUncertain) await checkGatewayOperation();
    await Promise.all([fetchSnapshot(), fetchUsage(), fetchModels(), fetchChannels(true), fetchSessions()]);
  };
  const runDoctor = async () => {
    setDoctorConfirmationOpen(false);
    setDoctorLoading(true);
    setDoctorReport(null);
    setAuditResult(null);
    setDiagnosticError(null);
    try {
      const { data } = await api.post<{ data: { report: DoctorReport } }>('/gateway/doctor/inspect', undefined, { timeout: 70_000 });
      setDoctorReport(data.report);
    } catch (error) {
      setDiagnosticError(error instanceof ApiError && (error.status === 404 || error.code === 'DOCTOR_VERSION_UNREVIEWED')
        ? 'La versión activa no ofrece un diagnóstico de lectura verificado.'
        : 'No se pudo ejecutar Doctor.');
    } finally {
      setDoctorLoading(false);
    }
  };
  const runAudit = async () => {
    setAuditConfirmationOpen(false);
    setAuditLoading(true);
    setAuditResult(null);
    setDoctorReport(null);
    setDiagnosticError(null);
    try {
      const { data } = await api.get<{ data: Audit }>('/gateway/security-audit', undefined, { timeout: 35_000 });
      setAuditResult(data);
    } catch {
      setDiagnosticError('No se pudo completar la auditoría de seguridad.');
    } finally {
      setAuditLoading(false);
    }
  };
  const availability = statusError || status?.stale ? 'unknown' : status?.availability ?? 'unknown';
  const operational = availability === 'available';
  const busy = !!pendingGatewayRequestId || gatewayOperation?.state === 'running' || operationUncertain;
  const needsAction = ['configuration_required', 'pairing_required', 'auth_required'].includes(availability);
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
    : availability === 'disconnected' ? 'El proceso está iniciado, pero Core no ha confirmado la conexión. Puedes volver a comprobarla.'
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
    ? modelInventoryCurrent ? 'Sin configurar' : 'No disponible'
    : !modelInventoryCurrent
      ? defaultModelId
      : defaultIsConfigured
      ? defaultModelId
      : `${defaultModelId} (no configurado)`;
  const defaultModelSubtitle = !modelInventoryCurrent ? (modelsCheckedAt ? `Último inventario: ${new Date(modelsCheckedAt).toLocaleString()}` : 'Inventario sin comprobar') : !defaultModelId
    ? `${configuredCount} configurados`
    : defaultIsConfigured
      ? `${configuredCount} configurados`
      : 'Ausente del inventario';
  const usageReported = usage?.today_reported === true && !!usage.period_start && !!usage.observed_at;

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{
        padding: isMobile ? 12 : 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 1280,
        marginInline: 'auto',
      }}>
        {/* ─── Status Hero ─────────────────────────────────── */}
        <section aria-label="Estado del servicio Gateway" style={{
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
                  {status?.port && <span>Puerto {status.port}</span>}
                  {status?.bind && <span>Escucha en {status.bind}</span>}
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
                <ActionButton icon={Play} label="Iniciar" onClick={() => void startGateway()} loading={busy} color="var(--success)" />
              )}
              {needsAction && (
                <ActionButton icon={ShieldCheck} label="Resolver el problema" onClick={() => { void navigate(availability === 'pairing_required' ? '/gateway?tab=devices' : '/settings?group=connectivity&section=gateway-auth'); }} loading={false} color="var(--warning)" />
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
        </section>

        {availability !== 'stopped' && <div data-testid="gateway-native-connection" className="min-w-0 overflow-hidden rounded-md border has-[iframe]:h-[min(1100px,max(600px,80dvh))]">
          <NativeOpenclawHost artifactDigest={NATIVE_HOST_ADAPTER_DIGEST}
            resolveTarget={connectionTarget} title="Conexión nativa de Gateway" />
        </div>}

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
            label="Canales"
            value={!channelsError && channelsRuntime ? channelsRuntime.connected : '—'}
            subtitle={channelsError ? 'Error de lectura' : channelsLoading ? 'Comprobando…' : channelsRuntime
              ? `Conectados · ${diagnosedAt(channelsRuntime.observed_at)}` : 'La conexión de los canales no está confirmada'}
            accentColor="#06b6d4"
          />
          <MetricCard
            icon={MessageSquare}
            label="Sesiones recientes"
            value={sessionsCheckedAt && !sessionsError ? sessions.length : '—'}
            subtitle={sessionsError ? 'Error de lectura' : sessionsLoading ? 'Comprobando…' : sessionsCheckedAt ? `Sesiones de la lista recibida · ${diagnosedAt(sessionsCheckedAt)}` : 'Inventario sin comprobar'}
            accentColor="#8b5cf6"
          />
          <MetricCard
            icon={Bot}
            label="Modelo predeterminado"
            value={defaultModelValue}
            subtitle={defaultModelSubtitle}
            accentColor={modelInventoryCurrent && defaultModelId && !defaultIsConfigured ? '#f43f5e' : '#f59e0b'}
          />
          <MetricCard
            icon={DollarSign}
            label="Consumo del día UTC"
            value={usageReported ? `${usage.total_tokens.toLocaleString('es-ES')} tokens` : '—'}
            subtitle={usageReported
              ? `${usage.total_cost_usd.toLocaleString('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })} · ${usage.period_start} · ${diagnosedAt(usage.observed_at!)}`
              : usageLoading ? 'Comprobando…' : usageError ? 'Error de lectura' : 'Sin datos de consumo para el día'}
            accentColor="#10b981"
          />
        </div>

        {/* ─── Health Checks ───────────────────────────────── */}
        {health && (
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
                Salud de Core, configuración y Gateway
              </span>
              <StatusPill status={health.status} size="sm" />
            </div>
            {health.checked_at && <p className="mb-2 text-xs text-muted-foreground">{health.stale ? 'Datos anteriores' : 'Comprobado'} · {diagnosedAt(health.checked_at)}</p>}
            {health.error && <p className="mb-2 text-sm text-muted-foreground">No se pudo verificar la salud de todos los componentes.</p>}
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
            Diagnósticos
          </span>
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <QuickActionBtn icon={Stethoscope} label="Ejecutar Doctor" loading={doctorLoading || auditLoading} onClick={() => setDoctorConfirmationOpen(true)} />
            <QuickActionBtn icon={ShieldCheck} label="Auditoría de seguridad" loading={auditLoading || doctorLoading} onClick={() => setAuditConfirmationOpen(true)} />
          </div>
        </div>

        <Dialog open={doctorConfirmationOpen} onOpenChange={setDoctorConfirmationOpen}>
          <DialogContent style={{ width: 'min(90vw, 440px)' }}>
            <DialogTitle>¿Ejecutar Doctor?</DialogTitle>
            <DialogDescription>
              Se inspeccionará la configuración con el diagnóstico de lectura de la versión activa.
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDoctorConfirmationOpen(false)}>Cancelar</Button>
              <Button onClick={() => void runDoctor()} disabled={doctorLoading}>Ejecutar Doctor</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={auditConfirmationOpen} onOpenChange={setAuditConfirmationOpen}>
          <DialogContent>
            <DialogTitle>¿Ejecutar la auditoría de seguridad?</DialogTitle>
            <DialogDescription>Se inspeccionará la configuración y se comprobará la conexión con Gateway.</DialogDescription>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAuditConfirmationOpen(false)}>Cancelar</Button>
              <Button onClick={() => void runAudit()}>Ejecutar auditoría</Button>
            </div>
          </DialogContent>
        </Dialog>
        {diagnosticError && <p role="alert" className="text-sm text-destructive">{diagnosticError}</p>}
        {doctorReport && (
          <section role="status" className="rounded-md border p-3 text-sm">
            <h3 className="font-semibold">Informe de Doctor</h3>
            <p>{doctorReport.blocked ? 'Inspección bloqueada' : doctorReport.incomplete
              ? 'Inspección incompleta' : doctorReport.passed ? 'Comprobación completada' : 'Hallazgos que requieren revisión'}</p>
            <p>{doctorReport.inspections_reported} comprobaciones · {doctorReport.checks_skipped ?? 0} omitidas · {doctorReport.severities.error} errores · {doctorReport.severities.warning} avisos</p>
          </section>
        )}
        {auditResult && (
          <section className="space-y-2 text-sm">
            <h3 className="font-semibold">Resultado de la auditoría de seguridad</h3>
            <p>{auditResult.summary.critical} críticos · {auditResult.summary.warn} avisos · {auditResult.summary.info} informativos</p>
            <ul className="space-y-2">
              {auditResult.findings.map((finding, index) => (
                <li key={finding.checkId + index} className="break-words rounded-md border p-3">
                  <span className="font-semibold">{finding.title}</span>
                  <p className="whitespace-pre-wrap text-muted-foreground">{finding.detail}</p>
                  {finding.remediation && <p>{finding.remediation}</p>}
                </li>
              ))}
            </ul>
          </section>
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
