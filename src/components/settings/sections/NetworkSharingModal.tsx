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
import { X, Server, Globe, TerminalSquare, HardDriveDownload, FolderSync, Copy, Check, KeyRound, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  updateSharedFolderProtocols, getProtocolStatus, createFileAccessCredential,
  type SharedFolder, type ProtocolStatus,
} from '@/services/shared-folders.service';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import { useAuthStore } from '@/stores/auth.store';

/** Deriva el nombre de usuario de sistema (SMB/WebDAV) del email, con la MISMA
 *  normalización que `unixUsername` del backend (local-part → [a-z0-9-], prefijo de
 *  letra si empieza por dígito, ≤31). Coincide con el usuario real salvo colisión. */
function deriveUsername(email: string | undefined): string {
  let u = (email?.split('@')[0] || 'user').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  if (!/^[a-z]/.test(u)) u = 'u' + u;
  return u.slice(0, 31) || 'user';
}

type ProtoKey = 'webdav' | 'smb' | 'sftp' | 'rsync' | 'nfs';
interface ProtoDef {
  key: ProtoKey; label: string; icon: LucideIcon;
  desc: string; prereq?: keyof ProtocolStatus;
}
// WebDAV PRIMERO: es el método universal (funciona en Windows/Mac/WSL2/VM/bare-metal
// porque va por HTTPS/443, el mismo canal que el dash). SMB es óptimo en LAN/bare-metal.
const PROTOCOLS: ProtoDef[] = [
  { key: 'webdav', label: 'WebDAV (HTTPS)', icon: Globe, desc: 'Unidad de red universal: Windows, Mac, móvil y Linux. Va por HTTPS, sin depender de puertos.' },
  { key: 'smb', label: 'SMB (Windows / red local)', icon: Server, desc: 'Óptimo en red local (bare-metal). Permisos por usuario.' },
  { key: 'sftp', label: 'SFTP (SSH)', icon: TerminalSquare, desc: 'Cifrado, con tu clave SSH. Requiere sshd.', prereq: 'sshd' },
  { key: 'rsync', label: 'rsync (sobre SSH)', icon: FolderSync, desc: 'Copias/backup por clave SSH. Requiere rsync/rrsync.', prereq: 'rrsync' },
  { key: 'nfs', label: 'NFS (red Unix)', icon: HardDriveDownload, desc: 'Por IP/red, NO por usuario. Requiere nfs-kernel-server.', prereq: 'exportfs' },
];

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-20 shrink-0 text-xs text-[var(--text-muted)]">{label}</span>
      <code className="flex-1 truncate text-xs text-[var(--text-dim)]">{value}</code>
      <button
        className="shrink-0 text-[var(--text-dim)] hover:text-[var(--text)]"
        onClick={() => { void navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }}
        title="Copiar"
      >{done ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}</button>
    </div>
  );
}

/** Contenido reutilizable de "Compartir por red". `draft`: modo CREAR (la carpeta
 *  aún no existe) → los toggles no llaman a la API, se acumulan y se reportan por
 *  `onDraftChange` para aplicarlos al crear. */
export function NetworkSharingPanel({ folder, onSaved, draft = false, onDraftChange }: {
  folder: SharedFolder; onSaved?: () => void;
  draft?: boolean; onDraftChange?: (protocols: SharedFolder['protocols']) => void;
}) {
  const [protocols, setProtocols] = useState(folder.protocols ?? {});
  const [status, setStatus] = useState<ProtocolStatus | null>(null);
  const [nfsHosts, setNfsHosts] = useState<string>(
    ((folder.protocols?.nfs?.settings as { hosts?: string[] } | undefined)?.hosts ?? []).join(', '),
  );
  const [busy, setBusy] = useState<ProtoKey | null>(null);
  const storeDomain = useServiceUrlsStore((s) => s.primaryDomain);
  const email = useAuthStore((s) => s.user?.email);
  const username = deriveUsername(email);

  useEffect(() => { getProtocolStatus().then(setStatus).catch(() => setStatus(null)); }, []);

  const isHostBind = folder.backend === 'host_bind';
  const host = status?.primary_domain || storeDomain || 'tu-servidor';
  const smbPort = status?.smb_port ?? 445;
  const windowsNative = status?.windows_native ?? (smbPort === 445);
  const webdavBase = status?.webdav_base_url || `https://${host}/webdav`;
  const environment = status?.environment;

  const enabled = (k: ProtoKey) => protocols[k]?.enabled === true;

  const toggle = async (k: ProtoKey, val: boolean) => {
    if (draft) {
      const next = { ...protocols, [k]: { enabled: val, ...(k === 'nfs' && val ? { settings: { hosts: parseHosts(nfsHosts) } } : {}) } };
      setProtocols(next); onDraftChange?.(next);
      return;
    }
    setBusy(k);
    try {
      const patch: Record<string, { enabled: boolean; settings?: Record<string, unknown> }> = { [k]: { enabled: val } };
      if (k === 'nfs' && val) patch.nfs = { enabled: true, settings: { hosts: parseHosts(nfsHosts) } };
      const next = await updateSharedFolderProtocols(folder.id, patch);
      setProtocols(next);
      onSaved?.();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };

  const saveNfsHosts = async () => {
    if (draft) {
      const next = { ...protocols, nfs: { enabled: enabled('nfs'), settings: { hosts: parseHosts(nfsHosts) } } };
      setProtocols(next); onDraftChange?.(next);
      return;
    }
    setBusy('nfs');
    try {
      const next = await updateSharedFolderProtocols(folder.id, { nfs: { enabled: enabled('nfs'), settings: { hosts: parseHosts(nfsHosts) } } });
      setProtocols(next);
      toast.success('IPs autorizadas de NFS guardadas');
    } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };

  // Instrucciones de montaje por SO, por protocolo (solo cuando hay slug).
  const webdavUrl = `${webdavBase}/shared/${folder.slug}`;
  const instructions = (k: ProtoKey): { label: string; value: string }[] => {
    switch (k) {
      case 'webdav': return [
        { label: 'Windows', value: `net use M: ${webdavUrl} /persistent:yes` },
        { label: 'Mac (Finder)', value: webdavUrl },
        { label: 'Linux', value: `sudo mount -t davfs ${webdavUrl} /mnt/${folder.slug}` },
      ];
      case 'smb': {
        const win = windowsNative ? `\\\\${host}\\${folder.slug}` : '(no disponible — usa WebDAV)';
        return [
          { label: 'Windows', value: win },
          { label: 'Mac (Finder)', value: `smb://${host}${smbPort === 445 ? '' : ':' + smbPort}/${folder.slug}` },
          { label: 'Linux', value: `sudo mount -t cifs //${host}/${folder.slug} /mnt/${folder.slug} -o user=${username}${smbPort === 445 ? '' : ',port=' + smbPort}` },
        ];
      }
      case 'sftp': return [{ label: 'Comando', value: `sftp -P 22 ${username}@${host}:/${folder.slug}` }];
      case 'rsync': return [{ label: 'Comando', value: `rsync -avz ./ ${username}@${host}:${folder.slug}/` }];
      default: return [];
    }
  };

  return (
    <div className="space-y-3">
      {isHostBind && (
        <div className="rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-2 text-xs text-[var(--text-dim)]">
          Carpeta enlazada del servidor: por seguridad, en v1 solo se comparte por WebDAV (SMB/NFS/SFTP quedan fuera).
        </div>
      )}

      <CredentialsBlock username={username} windowsNative={windowsNative} environment={environment} smbPort={smbPort} folderName={folder.name} />

      {PROTOCOLS.map((p) => {
        const prereqMissing = p.prereq && status && !status.unavailable && !status[p.prereq];
        const disabled = busy !== null || (isHostBind && p.key !== 'webdav') || !!prereqMissing;
        const Icon = p.icon;
        const recommended = p.key === 'webdav';
        const smbUnreachable = p.key === 'smb' && !windowsNative;
        return (
          <div key={p.key} className={`rounded-md border p-3 ${recommended ? 'border-[var(--amber)]/50' : 'border-[var(--border)]'}`}>
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text)]">{p.label}</span>
                  {recommended && <span className="rounded-full bg-[var(--amber)]/15 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-[var(--amber)]">Universal</span>}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{p.desc}</div>
                {prereqMissing && <div className="mt-0.5 text-xs text-[var(--warning)]">No disponible: falta instalar el servicio en el servidor.</div>}
              </div>
              <Switch checked={enabled(p.key)} disabled={disabled} onCheckedChange={(v) => void toggle(p.key, v)} />
            </div>

            {/* Aviso de entorno para SMB (puerto no estándar → Windows no lo alcanza). */}
            {smbUnreachable && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-2 text-xs text-[var(--text-dim)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
                <span>
                  El Explorador de Windows no puede montar SMB aquí (smbd escucha en el puerto {smbPort}, y Windows/Mac solo usan el 445).
                  {environment === 'wsl2' ? ' En WSL2 el 445 lo ocupa el propio Windows.' : ''} Para Windows usa <strong className="text-[var(--text)]">WebDAV</strong>. SMB sí funciona en Linux/Mac (aceptan puerto).
                </span>
              </div>
            )}

            {enabled(p.key) && !folder.slug && (
              <div className="mt-2 border-t border-[var(--border)] pt-2 text-xs text-[var(--text-muted)]">
                Las instrucciones de conexión aparecerán aquí tras crear la carpeta.
              </div>
            )}
            {enabled(p.key) && folder.slug && (
              <div className="mt-2 border-t border-[var(--border)] pt-2">
                {instructions(p.key).map((r) => <CopyRow key={r.label} label={r.label} value={r.value} />)}
                {p.key === 'nfs' && (
                  <div className="space-y-1.5">
                    <div className="text-xs text-[var(--text-muted)]">IPs / redes autorizadas (obligatorio; una por coma). Ej: 192.168.1.0/24, 10.0.0.5</div>
                    <div className="flex gap-2">
                      <Input value={nfsHosts} onChange={(e) => setNfsHosts(e.target.value)} placeholder="192.168.1.0/24" className="h-8" />
                      <button onClick={() => void saveNfsHosts()} disabled={busy !== null} className="rounded-md border border-[var(--border)] px-3 text-xs text-[var(--text-dim)]">Guardar</button>
                    </div>
                    <CopyRow label="Montar" value={`sudo mount -t nfs ${host}:/${folder.slug} /mnt/${folder.slug}`} />
                  </div>
                )}
                {(p.key === 'sftp' || p.key === 'rsync') && (
                  <div className="mt-1 text-xs text-[var(--text-muted)]">Sube tu clave pública SSH en «Carpetas compartidas → Claves SSH» para poder conectar (SFTP/rsync no usan contraseña).</div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="text-xs text-[var(--text-muted)]">
        WebDAV · SMB · SFTP · rsync respetan los permisos por usuario. NFS es por-red, no por-usuario.
      </div>
    </div>
  );
}

/** Bloque "Cómo conectar": credenciales CORRECTAS por protocolo + generador de
 *  credencial de archivos (device token) para 2FA / quien prefiera token. */
function CredentialsBlock({ username, windowsNative, environment, smbPort, folderName }: {
  username: string; windowsNative: boolean; environment?: string; smbPort: number; folderName: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [gen, setGen] = useState(false);
  const generate = async () => {
    setGen(true);
    try {
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      setToken(await createFileAccessCredential(`Archivos ${folderName} · ${stamp}`));
    } catch (e) { toast.error((e as Error).message || 'No se pudo generar la credencial'); }
    setGen(false);
  };
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--text-dim)]">
        <KeyRound className="h-3.5 w-3.5" /> Cómo conectar
      </div>
      <p className="mb-2 text-xs text-[var(--text-muted)]">
        Para montar la carpeta como unidad de red (WebDAV o SMB) usa tus credenciales de Micelclaw:
      </p>
      <CopyRow label="Usuario" value={username} />
      <div className="flex items-center gap-2 py-0.5">
        <span className="w-20 shrink-0 text-xs text-[var(--text-muted)]">Contraseña</span>
        <span className="flex-1 text-xs text-[var(--text-dim)]">la misma con la que inicias sesión en Micelclaw</span>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        {windowsNative
          ? <>En Windows: <code className="text-[var(--text-dim)]">Este equipo → Conectar a unidad de red</code>. SFTP/rsync no usan contraseña: van con tu <strong className="text-[var(--text)]">clave SSH</strong>.</>
          : <>En Windows monta por <strong className="text-[var(--text)]">WebDAV</strong> (SMB no llega{environment === 'wsl2' ? ' en WSL2' : `, puerto ${smbPort}`}). SFTP/rsync van con tu <strong className="text-[var(--text)]">clave SSH</strong>.</>}
      </p>

      {/* Credencial de archivos (device token) — para 2FA o quien prefiera token. */}
      <div className="mt-2 border-t border-[var(--border)] pt-2">
        {token ? (
          <>
            <CopyRow label="Credencial" value={token} />
            <p className="text-[0.6875rem] text-[var(--warning)]">Guárdala ahora: no se vuelve a mostrar. Úsala como usuario O contraseña al montar. Revocable en Settings → Dispositivos.</p>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--text-muted)]">¿Tienes 2FA o prefieres un token revocable en vez de tu contraseña?</span>
            <Button size="sm" variant="outline" onClick={() => void generate()} disabled={gen}>{gen ? 'Generando…' : 'Generar credencial'}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Modal suelto (compat). El diálogo de edición usa NetworkSharingPanel directamente. */
export function NetworkSharingModal({ folder, onClose, onSaved }: {
  folder: SharedFolder; onClose: () => void; onSaved: () => void;
}) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-[540px] max-w-[94vw] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h3 className="m-0 flex items-center gap-2 text-[0.9375rem] font-semibold text-[var(--text)]">
            <Server className="h-4 w-4 text-[var(--amber)]" /> Compartir «{folder.name}» por red
          </h3>
          <button onClick={onClose} className="text-[var(--text-dim)]"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">
          <NetworkSharingPanel folder={folder} onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}

function parseHosts(raw: string): string[] {
  return raw.split(',').map((h) => h.trim()).filter(Boolean);
}
