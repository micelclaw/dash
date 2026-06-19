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
import { toast } from 'sonner';
import { Check, X, Copy, RefreshCw } from 'lucide-react';
import { SettingSection } from '../SettingSection';
import { getFileServices, setFileServices, type FileServicesStatus } from '@/services/file-services.service';

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem', background: 'var(--bg-input, var(--bg))',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', color: 'var(--text)',
};
const btnGhost: React.CSSProperties = {
  padding: '6px 10px', fontSize: '0.8125rem', background: 'none', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

function PrereqRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
      {ok
        ? <Check size={15} style={{ color: 'var(--green, #22c55e)' }} />
        : <X size={15} style={{ color: 'var(--red, #ef4444)' }} />}
      <span style={{ color: ok ? 'var(--text)' : 'var(--text-dim)' }}>{label}</span>
    </div>
  );
}

export function FileServicesSection() {
  const [status, setStatus] = useState<FileServicesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getFileServices()
      .then(setStatus)
      .catch((e: unknown) => toast.error((e as Error).message || 'No se pudo cargar el estado de SMB'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggle = async () => {
    if (!status) return;
    const next = !status.enabled;
    setSaving(true);
    try {
      const updated = await setFileServices(next);
      setStatus(updated);
      toast.success(next ? 'SMB activado' : 'SMB desactivado');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'No se pudo cambiar el estado');
    } finally { setSaving(false); }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success('Copiado'),
      () => toast.error('No se pudo copiar'),
    );
  };

  return (
    <SettingSection
      title="Servicios de archivos (SMB)"
      description="Acceso a las carpetas compartidas como unidad de red (Windows/Mac/Linux). Requiere instalar los prerequisitos del sistema una vez (root); la activación se hace aquí, en caliente."
      action={
        <button style={btnGhost} onClick={load} disabled={loading}>
          <RefreshCw size={14} /> Recargar
        </button>
      }
    >
      {loading && <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Cargando…</div>}
      {!loading && status && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Toggle principal */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                SMB {status.enabled ? 'activado' : 'desactivado'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                {status.ready
                  ? 'Prerequisitos OK. Al activar se publican las carpetas compartidas según sus permisos.'
                  : 'Faltan prerequisitos del sistema (abajo). Actívalo cuando estén listos.'}
              </div>
            </div>
            <button
              onClick={toggle}
              disabled={saving || (!status.enabled && !status.ready)}
              style={{
                padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                border: 'none', borderRadius: 'var(--radius-sm)',
                background: status.enabled ? 'var(--bg-input, var(--bg))' : 'var(--amber)',
                color: status.enabled ? 'var(--text)' : '#000',
                opacity: saving || (!status.enabled && !status.ready) ? 0.6 : 1,
                ...(status.enabled ? { border: '1px solid var(--border)' } : {}),
              }}
            >
              {saving ? '…' : status.enabled ? 'Desactivar' : 'Activar'}
            </button>
          </div>

          {/* Prerequisitos del sistema */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
              Prerequisitos del sistema
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <PrereqRow ok={status.prereqs.samba_installed} label="Samba instalado" />
              <PrereqRow ok={status.prereqs.helper_installed} label="Helper de privilegio (claw-priv-helper)" />
              <PrereqRow ok={status.prereqs.nsswitch_ok} label="NSS (libnss-extrausers en nsswitch.conf)" />
              <PrereqRow ok={status.prereqs.smbd_running} label="smbd en ejecución" />
            </div>
            {!status.ready && (
              <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Instala los prerequisitos una vez (como root):
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <code style={mono}>{status.setup_command}</code>
                  <button style={btnGhost} onClick={() => copy(status.setup_command)}><Copy size={13} /></button>
                </div>
              </div>
            )}
          </div>

          {/* Última reconciliación (NAS1c) */}
          {status.enabled && status.last_reconcile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
              {status.last_reconcile.ok
                ? <Check size={14} style={{ color: 'var(--green, #22c55e)' }} />
                : <X size={14} style={{ color: 'var(--red, #ef4444)' }} />}
              <span style={{ color: 'var(--text-dim)' }}>
                Última sincronización: <strong style={{ color: status.last_reconcile.ok ? 'var(--text)' : 'var(--red, #ef4444)' }}>
                  {status.last_reconcile.ok ? 'OK' : `fallo — ${status.last_reconcile.detail}`}
                </strong>
                {' · '}{new Date(status.last_reconcile.at).toLocaleString()}
              </span>
            </div>
          )}

          {/* Rutas de red */}
          {status.enabled && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
                Rutas de red ({status.shares.length})
              </div>
              {status.shares.length === 0 && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                  No hay carpetas compartidas. Crea una en “Carpetas compartidas”.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {status.shares.map((s) => (
                  <div key={s.slug} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>{s.name}</span>
                      <code style={{ ...mono, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.network_path}</code>
                    </div>
                    <button style={btnGhost} onClick={() => copy(s.network_path)}><Copy size={13} /></button>
                  </div>
                ))}
              </div>
              {status.smb_port !== 445 && (
                <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  Nota: smbd escucha en el puerto {status.smb_port} (no el estándar 445). Algunos clientes
                  (p.ej. el Explorador de Windows) no permiten puerto no estándar; en producción se usa 445.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </SettingSection>
  );
}
