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
import {
  Check, X, Copy, RefreshCw, Play, AlertTriangle, ShieldCheck, Network,
  Server, Globe, TerminalSquare, FolderSync, HardDriveDownload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SettingSection } from '../SettingSection';
import { Button } from '@/components/ui/button';
import {
  getFileServices, setFileServices, startSmbd,
  type FileServicesStatus, type NetworkProtocolInfo, type ProtocolKey,
} from '@/services/file-services.service';

const PROTO_ICON: Record<ProtocolKey, LucideIcon> = {
  smb: Server, webdav: Globe, sftp: TerminalSquare, rsync: FolderSync, nfs: HardDriveDownload,
};

function StatusBadge({ p }: { p: NetworkProtocolInfo }) {
  const [label, cls] = !p.available
    ? ['No instalado', 'text-[var(--text-muted)] border-[var(--border)]']
    : p.running
      ? ['En marcha', 'text-[var(--success,#10b981)] border-[var(--success,#10b981)]/40']
      : ['Disponible', 'text-[var(--warning,#f97316)] border-[var(--warning,#f97316)]/40'];
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${cls}`}>{label}</span>
  );
}

function Chip({ children, tone = 'dim' }: { children: React.ReactNode; tone?: 'dim' | 'warn' }) {
  const cls = tone === 'warn'
    ? 'text-[var(--warning,#f97316)] border-[var(--warning,#f97316)]/40 bg-[var(--warning,#f97316)]/10'
    : 'text-[var(--text-dim)] border-[var(--border)] bg-[var(--surface-hover,transparent)]';
  return <span className={`rounded-full border px-1.5 py-0.5 text-[0.62rem] ${cls}`}>{children}</span>;
}

export function FileServicesSection() {
  const [status, setStatus] = useState<FileServicesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    getFileServices()
      .then(setStatus)
      .catch((e: unknown) => toast.error((e as Error).message || 'No se pudo cargar el estado'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleSmb = async () => {
    if (!status) return;
    const next = !status.enabled;
    setBusy(true);
    try {
      const updated = await setFileServices(next);
      setStatus(updated);
      toast.success(next ? 'SMB activado' : 'SMB desactivado');
    } catch (err: unknown) { toast.error((err as Error).message || 'No se pudo cambiar el estado'); }
    finally { setBusy(false); }
  };

  const doStartSmbd = async () => {
    setBusy(true);
    try {
      setStatus(await startSmbd());
      toast.success('smbd iniciado');
    } catch (err: unknown) { toast.error((err as Error).message || 'No se pudo iniciar smbd'); }
    finally { setBusy(false); }
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
      title="Servicios de archivos (red)"
      description="Comparte tus carpetas por red con varios protocolos (SMB, WebDAV, SFTP, rsync, NFS). Los prerequisitos del sistema se instalan una vez como root; la activación de SMB se hace aquí y el resto de protocolos se activan por carpeta en «Carpetas compartidas»."
      action={<Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}><RefreshCw className="h-3.5 w-3.5" /> Recargar</Button>}
    >
      {loading && <div className="text-sm text-[var(--text-dim)]">Cargando…</div>}
      {!loading && status && (
        <div className="flex flex-col gap-4">

          {/* Guía por dispositivo (lo primero: evita la trampa del puerto 4450) */}
          <div className="flex items-start gap-2 rounded-md border border-[var(--info,#38bdf8)]/30 bg-[var(--info,#38bdf8)]/10 p-3 text-xs text-[var(--text-dim)]">
            <Network className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info,#38bdf8)]" />
            <div className="space-y-1">
              <div className="text-[var(--text)]"><strong>¿Cómo conecto desde cada equipo?</strong></div>
              <div><strong>Windows:</strong> usa <strong>WebDAV</strong> (montar unidad con la URL de abajo){status.smb_port !== 445 && <> — el Explorador de Windows <strong>no</strong> puede usar SMB aquí porque smbd escucha en el puerto {status.smb_port} y el Explorador solo habla 445 (en un servidor dedicado sería 445)</>}.</div>
              <div><strong>Linux / Mac:</strong> SMB, SFTP o NFS. <strong>Móvil:</strong> WebDAV.</div>
            </div>
          </div>

          {/* Tarjetas por protocolo */}
          <div>
            <div className={heading}>Protocolos</div>
            <div className="flex flex-col gap-2">
              {status.protocols.map((p) => {
                const Icon = PROTO_ICON[p.key];
                return (
                  <div key={p.key} className="rounded-md border border-[var(--border)] p-3">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[var(--text)]">{p.label}</span>
                          {p.scope === 'per_folder' && <Chip>por carpeta</Chip>}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--text-dim)]">{p.detail}</div>
                      </div>
                      <StatusBadge p={p} />
                    </div>

                    {/* chips de propiedades */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-7">
                      {p.windows_native
                        ? <Chip>Windows nativo</Chip>
                        : <Chip tone="warn">No en el Explorador de Windows</Chip>}
                      {p.respects_acl
                        ? <Chip>Permisos por usuario</Chip>
                        : <Chip tone="warn">Por IP, no por usuario</Chip>}
                    </div>

                    {/* controles / conexión */}
                    <div className="mt-2 flex flex-col gap-2 border-t border-[var(--border)] pt-2 pl-7">
                      {/* SMB: toggle global + iniciar smbd */}
                      {p.key === 'smb' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant={status.enabled ? 'outline' : 'default'} size="sm"
                            onClick={toggleSmb}
                            disabled={busy || (!status.enabled && !status.ready)}
                          >
                            {busy ? '…' : status.enabled ? 'Desactivar SMB' : 'Activar SMB'}
                          </Button>
                          {status.can_start_smbd && (
                            <Button variant="default" size="sm" className="gap-1.5" onClick={doStartSmbd} disabled={busy}>
                              <Play className="h-3.5 w-3.5" /> Iniciar smbd
                            </Button>
                          )}
                        </div>
                      )}
                      {/* per-folder: dónde se activa */}
                      {p.scope === 'per_folder' && (
                        <div className="text-xs text-[var(--text-muted)]">
                          Se activa por carpeta en <strong className="text-[var(--text-dim)]">Carpetas compartidas → «Compartir por red»</strong>.
                          {(p.key === 'sftp' || p.key === 'rsync') && ' Requiere subir tu clave SSH pública allí mismo.'}
                        </div>
                      )}
                      {/* ejemplo de conexión (si disponible) */}
                      {p.available && (
                        <div className="flex items-center gap-2">
                          <span className="w-16 shrink-0 text-xs text-[var(--text-muted)]">Conectar</span>
                          <code className={`${mono} min-w-0 flex-1 truncate`}>{p.connect_hint}</code>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(p.connect_hint)}><Copy className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prerequisitos SMB (solo relevantes para SMB; el resto se ve en el detalle de su tarjeta) */}
          <div>
            <div className={heading}>Prerequisitos de SMB</div>
            <div className="flex flex-col gap-1.5">
              {[
                ['Samba instalado', status.prereqs.samba_installed],
                ['Helper de privilegio (claw-priv-helper)', status.prereqs.helper_installed],
                ['NSS (libnss-extrausers en nsswitch.conf)', status.prereqs.nsswitch_ok],
                ['smbd en ejecución', status.prereqs.smbd_running],
              ].map(([label, ok]) => (
                <div key={label as string} className="flex items-center gap-2 text-sm">
                  {ok ? <Check className="h-3.5 w-3.5 text-[var(--success,#10b981)]" /> : <X className="h-3.5 w-3.5 text-[var(--error)]" />}
                  <span className={ok ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}>{label as string}</span>
                </div>
              ))}
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
            {status.ready && status.enabled && !status.prereqs.smbd_running && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--warning,#f97316)]/40 bg-[var(--warning,#f97316)]/10 p-2 text-xs text-[var(--text-dim)]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--warning,#f97316)]" />
                SMB está activado pero el daemon smbd no está en marcha → nadie puede conectar. Pulsa «Iniciar smbd» arriba.
              </div>
            )}
            {status.enabled && status.last_reconcile && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {status.last_reconcile.ok
                  ? <Check className="h-3.5 w-3.5 text-[var(--success,#10b981)]" />
                  : <X className="h-3.5 w-3.5 text-[var(--error)]" />}
                <span className="text-[var(--text-dim)]">
                  Última sincronización: <strong className={status.last_reconcile.ok ? 'text-[var(--text)]' : 'text-[var(--error)]'}>
                    {status.last_reconcile.ok ? 'OK' : `fallo — ${status.last_reconcile.detail}`}
                  </strong>{' · '}{new Date(status.last_reconcile.at).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Rutas de red SMB + aviso de carpetas sin ACL */}
          {status.enabled && (
            <div>
              <div className={heading}>Rutas de red SMB ({status.shares.length})</div>
              {status.shares.length === 0 && (
                <div className="text-sm text-[var(--text-dim)]">No hay carpetas compartidas. Crea una en «Carpetas compartidas».</div>
              )}
              <div className="flex flex-col gap-1.5">
                {status.shares.map((s) => (
                  <div key={s.slug} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`whitespace-nowrap text-sm ${s.smb_served ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>{s.name}</span>
                        <code className={`${mono} truncate ${s.smb_served ? '' : 'opacity-50 line-through'}`}>{s.network_path}</code>
                      </div>
                      {/* Copiar solo tiene sentido si Samba la sirve de verdad */}
                      {s.smb_served && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(s.network_path)}><Copy className="h-3.5 w-3.5" /></Button>
                      )}
                    </div>
                    {!s.smb_served && s.not_served_reason && (
                      <div className="flex items-center gap-1.5 text-[0.7rem] text-[var(--warning,#f97316)]">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        No se comparte por SMB: {s.not_served_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nota de seguridad transversal */}
          <div className="flex items-start gap-2 text-[0.7rem] text-[var(--text-muted)]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>SMB, WebDAV, SFTP y rsync respetan los permisos por usuario (Sin acceso / Solo lectura / Lectura-escritura). NFS autoriza por IP/red, no por usuario. Tras cambiar la contraseña de un usuario, su acceso SMB se re-sincroniza en su próximo inicio de sesión.</span>
          </div>
        </div>
      )}
    </SettingSection>
  );
}
