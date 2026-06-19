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
import { Button } from '@/components/ui/button';
import { getFileServices, setFileServices, type FileServicesStatus } from '@/services/file-services.service';

function PrereqRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok
        ? <Check className="h-3.5 w-3.5 text-[var(--green,#22c55e)]" />
        : <X className="h-3.5 w-3.5 text-[var(--error)]" />}
      <span className={ok ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}>{label}</span>
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

  const mono = 'rounded-md border border-[var(--border)] bg-[var(--bg-input,var(--bg))] px-2 py-1 font-mono text-xs text-[var(--text)]';
  const heading = 'text-[0.7rem] font-semibold uppercase text-[var(--text-dim)] mb-2';

  return (
    <SettingSection
      title="Servicios de archivos (SMB)"
      description="Acceso a las carpetas compartidas como unidad de red (Windows/Mac/Linux). Requiere instalar los prerequisitos del sistema una vez (root); la activación se hace aquí, en caliente."
      action={<Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}><RefreshCw className="h-3.5 w-3.5" /> Recargar</Button>}
    >
      {loading && <div className="text-sm text-[var(--text-dim)]">Cargando…</div>}
      {!loading && status && (
        <div className="flex flex-col gap-4">
          {/* Toggle principal */}
          <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">SMB {status.enabled ? 'activado' : 'desactivado'}</div>
              <div className="mt-0.5 text-xs text-[var(--text-dim)]">
                {status.ready
                  ? 'Prerequisitos OK. Al activar se publican las carpetas compartidas según sus permisos.'
                  : 'Faltan prerequisitos del sistema (abajo). Actívalo cuando estén listos.'}
              </div>
            </div>
            <Button
              variant={status.enabled ? 'outline' : 'default'}
              onClick={toggle}
              disabled={saving || (!status.enabled && !status.ready)}
            >
              {saving ? '…' : status.enabled ? 'Desactivar' : 'Activar'}
            </Button>
          </div>

          {/* Prerequisitos del sistema */}
          <div>
            <div className={heading}>Prerequisitos del sistema</div>
            <div className="flex flex-col gap-1.5">
              <PrereqRow ok={status.prereqs.samba_installed} label="Samba instalado" />
              <PrereqRow ok={status.prereqs.helper_installed} label="Helper de privilegio (claw-priv-helper)" />
              <PrereqRow ok={status.prereqs.nsswitch_ok} label="NSS (libnss-extrausers en nsswitch.conf)" />
              <PrereqRow ok={status.prereqs.smbd_running} label="smbd en ejecución" />
            </div>
            {!status.ready && (
              <div className="mt-2.5 text-xs text-[var(--text-dim)]">
                Instala los prerequisitos una vez (como root):
                <div className="mt-1.5 flex items-center gap-2">
                  <code className={mono}>{status.setup_command}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(status.setup_command)}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}
          </div>

          {/* Última reconciliación (NAS1c) */}
          {status.enabled && status.last_reconcile && (
            <div className="flex items-center gap-2 text-xs">
              {status.last_reconcile.ok
                ? <Check className="h-3.5 w-3.5 text-[var(--green,#22c55e)]" />
                : <X className="h-3.5 w-3.5 text-[var(--error)]" />}
              <span className="text-[var(--text-dim)]">
                Última sincronización: <strong className={status.last_reconcile.ok ? 'text-[var(--text)]' : 'text-[var(--error)]'}>
                  {status.last_reconcile.ok ? 'OK' : `fallo — ${status.last_reconcile.detail}`}
                </strong>{' · '}{new Date(status.last_reconcile.at).toLocaleString()}
              </span>
            </div>
          )}

          {/* Rutas de red */}
          {status.enabled && (
            <div>
              <div className={heading}>Rutas de red ({status.shares.length})</div>
              {status.shares.length === 0 && (
                <div className="text-sm text-[var(--text-dim)]">No hay carpetas compartidas. Crea una en "Carpetas compartidas".</div>
              )}
              <div className="flex flex-col gap-1.5">
                {status.shares.map((s) => (
                  <div key={s.slug} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="whitespace-nowrap text-sm text-[var(--text)]">{s.name}</span>
                      <code className={`${mono} truncate`}>{s.network_path}</code>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(s.network_path)}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
              {status.smb_port !== 445 && (
                <div className="mt-2 text-[0.7rem] text-[var(--text-dim)]">
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
