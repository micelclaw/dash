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

// ─── OmniRoute setup wizard ─────────────────────────────────────────
// OmniRoute es un AI gateway self-hosted OpenAI-compatible. A diferencia de un provider
// normal ("pega tu API key"), la tarjeta lo INSTALA localmente: (1) arranca el contenedor
// con logs en vivo (WS service.omniroute), (2) el Core registra el provider `omniroute`
// apuntando a http://127.0.0.1:20128/v1, (3) el usuario conecta ≥1 upstream en el dashboard
// PROPIO de OmniRoute (pestaña nueva), (4) descubre + añade modelos (flujo estándar).
//
// El estado (instalado/arrancando/corriendo) se deriva del services store (evento
// service.omniroute), NUNCA de un flag local → sobrevive a un refresh.

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, ExternalLink, CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { useServicesStore } from '@/stores/services.store';
import { useWebSocket } from '@/hooks/use-websocket';
import { getProviderIcon } from '@/config/provider-icons';
import type { OmniRouteStatus } from '@/services/gateway.service';

const DASHBOARD_FALLBACK_URL = 'http://127.0.0.1:20128';

export function OmniRouteSetupWizard({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const svc = useServicesStore((s) => s.services.find((x) => x.name === 'omniroute'));
  const fetchServices = useServicesStore((s) => s.fetchServices);

  const [status, setStatus] = useState<OmniRouteStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<number | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  const refreshStatus = async () => {
    try { setStatus(await gwService.getOmnirouteStatus()); } catch { /* Core arrancando */ }
  };

  // Hidrata estado del backend al montar (estado derivado, no local).
  useEffect(() => { void fetchServices(); void refreshStatus(); }, [fetchServices]);

  // Poll del estado mientras NO esté corriendo (patrón canónico MailServerSection): la señal
  // autoritativa de "listo" es el services store / GET /omniroute/status, NO cazar service.ready
  // en el componente — ese evento viaja por el wsAlias del eventBus y no llega fiable al hook
  // useWebSocket (los service.logs sí, por el broadcaster crudo → por eso se ven los logs pero
  // el modal no giraba). El poll cierra el modal en cuanto el contenedor está running.
  const runningNow = svc?.state === 'running' || status?.running || false;
  useEffect(() => {
    if (runningNow) return;
    const t = setInterval(() => { void fetchServices(); void refreshStatus(); }, 2500);
    return () => clearInterval(t);
  }, [runningNow, fetchServices]);

  // Logs + transiciones en vivo (mismo patrón que PluginsBrowser / MailServerSection).
  const wsEvent = useWebSocket('service.*');
  useEffect(() => {
    if (!wsEvent || (wsEvent.data as Record<string, unknown>)?.service !== 'omniroute') return;
    const data = wsEvent.data as Record<string, unknown>;
    switch (wsEvent.event) {
      case 'service.starting':
        setLogs([]); setStarting(true);
        break;
      case 'service.logs': {
        const lines = data.lines as string[] | undefined;
        if (lines?.length) setLogs((p) => [...p, ...lines].slice(-400));
        break;
      }
      case 'service.ready':
        setStarting(false);
        void refreshStatus();
        void fetchServices();
        break;
      case 'service.failed':
        setStarting(false);
        toast.error(`OmniRoute no pudo arrancar: ${(data.error as string) ?? 'error desconocido'}`, { duration: 8000 });
        void fetchServices();
        break;
    }
  }, [wsEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight; }, [logs]);

  const running = svc?.state === 'running' || status?.running || false;
  // Una vez running NUNCA seguimos en "instalando" aunque el flag local `starting` no se haya
  // limpiado (el service.ready puede no llegar al componente) → el poll de arriba trae running.
  const installing = !running && (starting || svc?.state === 'starting');
  const ready = running && (status?.ready ?? true);
  const dashboardUrl = status?.dashboard_url ?? DASHBOARD_FALLBACK_URL;

  const handleInstall = async () => {
    setStarting(true);
    setLogs([]);
    try {
      await gwService.startOmniroute();
      await fetchServices();
    } catch (err) {
      setStarting(false);
      toast.error(err instanceof Error ? err.message : 'No se pudo instalar OmniRoute');
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await gwService.discoverProviderModels('omniroute');
      setDiscovered(res.models.length);
      if (res.models.length > 0) {
        toast.success(`${res.models.length} modelo${res.models.length !== 1 ? 's' : ''} disponible${res.models.length !== 1 ? 's' : ''} desde OmniRoute`);
      } else {
        toast.warning('OmniRoute está listo, pero aún no devuelve modelos — conecta un proveedor upstream en su panel.', { duration: 8000 });
      }
    } catch (err) {
      toast.error(`No se pudieron descubrir modelos: ${err instanceof Error ? err.message : 'error desconocido'}`, { duration: 8000 });
    } finally {
      setDiscovering(false);
    }
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  return (
    <ModalShell
      title="OmniRoute"
      titleIcon={(() => {
        const Icon = getProviderIcon('omniroute');
        return Icon ? <Icon size={26} style={{ color: 'var(--amber)' }} /> : null;
      })()}
      onClose={onClose}
    >
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 16 }}>
        AI gateway self-hosted: un único endpoint OpenAI-compatible que enruta a 268+ proveedores.
        Micelclaw lo instala localmente y apunta OpenClaw a{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>http://127.0.0.1:20128/v1</code>.
      </p>

      {/* ── Paso 1: instalar / arrancar ── */}
      {!running && !installing && (
        <>
          <ol style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.7, margin: '0 0 16px', paddingLeft: 18 }}>
            <li>Descarga la imagen de OmniRoute (~250&nbsp;MB) y arranca el contenedor.</li>
            <li>Registra el proveedor <code style={{ fontFamily: 'var(--font-mono)' }}>omniroute</code> en OpenClaw.</li>
            <li>Conectas tus proveedores (OpenAI, Anthropic, Ollama…) en el panel de OmniRoute.</li>
            <li>Descubres y añades modelos como con cualquier proveedor.</li>
          </ol>
          <ButtonRow
            cancelLabel="Cancelar"
            confirmLabel="Instalar OmniRoute"
            confirmIcon={<Download size={13} />}
            onCancel={onClose}
            onConfirm={handleInstall}
          />
        </>
      )}

      {/* ── Paso 2: instalando (logs en vivo) ── */}
      {installing && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: '0.8125rem', color: 'var(--text)' }}>
            <Loader2 size={14} className="spin" />
            <span>Instalando OmniRoute… {status?.image_present === false ? '(descargando imagen)' : ''}</span>
          </div>
          <div
            ref={logsRef}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 10,
              height: 200,
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              color: 'var(--text-dim)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}
          >
            {logs.length === 0 ? 'Preparando…' : logs.join('\n')}
          </div>
        </>
      )}

      {/* ── Paso 3: corriendo → configurar upstreams + descubrir ── */}
      {running && !installing && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.8125rem', color: 'var(--text)' }}>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            <span>
              OmniRoute está corriendo{status?.provider_registered ? ' y conectado a OpenClaw' : ''}
              {ready ? '' : ' (comprobando…)'}
            </span>
          </div>

          <div style={{
            fontSize: '0.75rem', color: 'var(--text-dim)',
            background: 'var(--surface)', padding: '10px 12px',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            marginBottom: 12, lineHeight: 1.5,
          }}>
            <strong style={{ color: 'var(--text)' }}>Conecta al menos un proveedor</strong> en el panel de OmniRoute
            (OpenAI, Anthropic, Ollama del host…). Es su propio dashboard; se abre en una pestaña nueva.
            <div style={{ marginTop: 10 }}>
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: '0.75rem', color: 'var(--amber)', textDecoration: 'none',
                  padding: '6px 10px', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)',
                }}
              >
                Abrir OmniRoute <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {discovered !== null && (
            <p style={{ fontSize: '0.75rem', color: discovered > 0 ? '#10b981' : 'var(--text-dim)', marginBottom: 12 }}>
              {discovered > 0
                ? `${discovered} modelo${discovered !== 1 ? 's' : ''} disponible${discovered !== 1 ? 's' : ''}. Ciérralo para añadirlos desde la tarjeta de OmniRoute.`
                : 'Aún sin modelos. Conecta un proveedor upstream y vuelve a descubrir.'}
            </p>
          )}

          <ButtonRow
            cancelLabel="Descubrir modelos"
            cancelIcon={discovering ? <Loader2 size={12} className="spin" /> : undefined}
            onCancel={() => { if (!discovering) void handleDiscover(); }}
            confirmLabel="Hecho"
            onConfirm={handleFinish}
          />
        </>
      )}
    </ModalShell>
  );
}

// ─── Local modal shell (autocontenido, sin dependencia de ModelSetupWizard) ──

function ModalShell({ title, titleIcon, onClose, children }: { title: string; titleIcon?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)', padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{
            margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)',
            fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {titleIcon}
            <span>{title}</span>
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ButtonRow({
  cancelLabel, confirmLabel, onCancel, onConfirm, confirmDisabled, confirmIcon, cancelIcon,
}: {
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  confirmIcon?: React.ReactNode;
  cancelIcon?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
      <button
        onClick={onCancel}
        style={{
          background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          padding: '8px 16px', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {cancelIcon}
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        disabled={confirmDisabled}
        style={{
          background: confirmDisabled ? 'var(--surface-hover)' : 'var(--amber)',
          color: confirmDisabled ? 'var(--text-dim)' : '#000',
          border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 18px',
          fontSize: '0.75rem', fontWeight: 600, cursor: confirmDisabled ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {confirmIcon}
        {confirmLabel}
      </button>
    </div>
  );
}
