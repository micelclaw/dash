/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// Apps acompañantes: emparejar (código de 6 díg) + listar + revocar.
// Contra Core `/api/v1/devices/*` (ADR-14). NO confundir con la sección "Devices"
// (nodos del Gateway de OpenClaw, `/gateway/devices/*`).
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Puzzle, Monitor, Smartphone, Copy, RefreshCw, Trash2, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { SettingSection } from '../SettingSection';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import * as companions from '@/services/companions.service';

const PLATFORM_META: Record<string, { label: string; icon: LucideIcon }> = {
  extension: { label: 'Extensión de navegador (CrawlMicel)', icon: Puzzle },
  desktop: { label: 'Escritorio (MiniMicel)', icon: Monitor },
  android: { label: 'Android', icon: Smartphone },
  ios: { label: 'iOS', icon: Smartphone },
};

function fmt(ts?: string | null): string {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

export function CompanionsSection() {
  const [devices, setDevices] = useState<companions.CompanionDevice[] | null>(null);
  const [code, setCode] = useState<companions.PairCodeResult | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [confirm, setConfirm] = useState<companions.CompanionDevice | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setDevices(await companions.listCompanionDevices());
    } catch {
      toast.error('No se pudieron cargar los dispositivos');
      setDevices([]);
    }
  }, []);

  useEffect(() => { void fetchDevices(); }, [fetchDevices]);

  // Cuenta atrás del código.
  useEffect(() => {
    if (!code || remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [code, remaining]);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await companions.generatePairingCode();
      setCode(r);
      setRemaining(r.expires_in);
      // QR para la app móvil (CG-M1): micelclaw://pair?v=1&code=<6díg>&base=<origen>.
      // El código ES la credencial (claim anónimo); el base ahorra el discovery.
      const payload = `micelclaw://pair?v=1&code=${r.code}&base=${encodeURIComponent(window.location.origin)}`;
      QRCode.toDataURL(payload, { margin: 1, width: 180, color: { dark: '#000000', light: '#ffffff' } })
        .then(setQr)
        .catch(() => setQr(null));
    } catch {
      toast.error('No se pudo generar el código');
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code.code); toast.success('Código copiado'); } catch { /* noop */ }
  };

  const doRevoke = async () => {
    const dev = confirm;
    setConfirm(null);
    if (!dev) return;
    setRevoking(dev.id);
    try {
      await companions.revokeCompanionDevice(dev.id);
      toast.success('Dispositivo desemparejado');
      await fetchDevices();
    } catch {
      toast.error('No se pudo desemparejar');
    } finally {
      setRevoking(null);
    }
  };

  const expired = code && remaining <= 0;

  return (
    <>
      <SettingSection
        title="Emparejar una app"
        description="Conecta la extensión CrawlMicel, el escritorio MiniMicel o la app móvil con tu Micelclaw."
      >
        {!code ? (
          <button onClick={generate} disabled={generating} style={btn} data-testid="gen-code">
            <Plus size={15} /> {generating ? 'Generando…' : 'Generar código de emparejamiento'}
          </button>
        ) : (
          <div style={codeBox}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              En la app: <strong>Buscar mi Micelclaw</strong> → introduce este código:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...codeDigits, opacity: expired ? 0.4 : 1 }} data-testid="pair-code">{code.code}</span>
              <button onClick={copy} disabled={!!expired} style={iconBtn} title="Copiar"><Copy size={16} /></button>
              <button onClick={generate} disabled={generating} style={iconBtn} title="Regenerar"><RefreshCw size={16} /></button>
            </div>
            {qr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: expired ? 0.4 : 1 }}>
                <img src={qr} alt="QR de emparejamiento" width={140} height={140}
                  style={{ borderRadius: 8, background: '#fff', padding: 4 }} data-testid="pair-qr" />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 220 }}>
                  Con la <strong>app móvil</strong>: «Escanear QR del dash» — empareja en un paso
                  (lleva el código y la dirección del servidor).
                </div>
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: expired ? 'var(--error, #f43f5e)' : 'var(--text-muted)' }}>
              {expired ? 'Código caducado — genera otro.' : `Caduca en ${remaining}s`}
            </div>
          </div>
        )}
      </SettingSection>

      <SettingSection
        title="Dispositivos emparejados"
        description="Apps que tienen acceso a tu cuenta. Revoca cualquiera cuando quieras."
        action={
          <button onClick={() => void fetchDevices()} style={iconBtn} title="Actualizar"><RefreshCw size={15} /></button>
        }
      >
        {devices === null ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>Cargando…</div>
        ) : devices.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>Aún no hay dispositivos emparejados.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {devices.map((d) => {
              const meta = PLATFORM_META[d.platform] ?? { label: d.platform, icon: Smartphone };
              const Icon = meta.icon;
              return (
                <div key={d.id} style={row} data-testid="device-row">
                  <Icon size={18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{d.device_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {meta.label}{d.app_version ? ` · v${d.app_version}` : ''} · {d.last_seen_at ? `visto ${fmt(d.last_seen_at)}` : `emparejado ${fmt(d.created_at)}`}
                    </div>
                  </div>
                  <button onClick={() => setConfirm(d)} disabled={revoking === d.id} style={dangerBtn} title="Revocar" data-testid="device-revoke">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SettingSection>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doRevoke}
        title="¿Desemparejar dispositivo?"
        description={confirm ? `"${confirm.device_name}" perderá el acceso y tendrá que volver a emparejarse.` : ''}
        confirmLabel="Desemparejar"
        variant="danger"
      />
    </>
  );
}

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-md, 8px)',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem', cursor: 'pointer',
};
const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 'var(--radius-sm, 6px)',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-dim)', cursor: 'pointer',
};
const dangerBtn: React.CSSProperties = { ...iconBtn, color: 'var(--error, #f43f5e)' };
const codeBox: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 'var(--radius-md, 8px)',
  border: '1px solid var(--border)', background: 'var(--surface)',
};
const codeDigits: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)', fontSize: '2rem', fontWeight: 700, letterSpacing: '0.4rem', color: 'var(--text)',
};
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius-md, 8px)',
  border: '1px solid var(--border)', background: 'var(--surface)',
};
