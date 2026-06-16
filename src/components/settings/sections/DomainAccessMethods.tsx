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

// ─── Domain Access Methods (hub anti-fricción) ──────────────────────────
// Cuatro formas de alcanzar los `.claw` SIN cambiar el DNS de cada dispositivo
// (que es lo "drástico" para un usuario novato). WireGuard es la funcional de
// la Fase 1: genera un acceso por dispositivo (peer + QR) y el peer recibe el
// recursor local como DNS automáticamente → resuelve `.claw` por el túnel Y
// navega normal, estés donde estés, sin tocar nada en el dispositivo.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Podcast, ShieldCheck, Cable, Globe, ChevronDown, ChevronRight,
  Plus, Loader2, Download, QrCode, ExternalLink, Smartphone,
  MonitorCheck, Check, RefreshCw, Copy, AlertTriangle,
} from 'lucide-react';
import { useWgClients } from '@/modules/vpn/hooks/use-wg-clients';
import { getClientOS } from '@/services/platform';
import {
  getHostSyncStatus, installHostSyncLocal, getHostsBlock,
  type HostSyncStatus,
} from '@/services/domains.service';

type MethodKey = 'thisdevice' | 'mdns' | 'wireguard' | 'tailscale' | 'public';

export function DomainAccessMethods({ primaryDomain }: { primaryDomain: string }) {
  // "Este equipo" lidera y arranca expandida (es el caso más común).
  const [open, setOpen] = useState<MethodKey | null>('thisdevice');
  const toggle = (k: MethodKey) => setOpen(v => (v === k ? null : k));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ThisDeviceCard open={open === 'thisdevice'} onToggle={() => toggle('thisdevice')} domain={primaryDomain} />
      <WireguardCard open={open === 'wireguard'} onToggle={() => toggle('wireguard')} domain={primaryDomain} />
      <MdnsCard open={open === 'mdns'} onToggle={() => toggle('mdns')} domain={primaryDomain} />
      <TailscaleCard open={open === 'tailscale'} onToggle={() => toggle('tailscale')} />
      <PublicCard open={open === 'public'} onToggle={() => toggle('public')} />
    </div>
  );
}

// ─── 0. Este equipo (hosts-sync automático) ─────────────────────────────

function ThisDeviceCard({ open, onToggle, domain }: { open: boolean; onToggle: () => void; domain: string }) {
  const [status, setStatus] = useState<HostSyncStatus | null>(null);
  const [installing, setInstalling] = useState(false);
  const [block, setBlock] = useState<string | null>(null);
  const clientOS = getClientOS();

  const refresh = useCallback(async () => {
    try { setStatus(await getHostSyncStatus()); } catch { /* silent */ }
  }, []);
  useEffect(() => { if (open) void refresh(); }, [open, refresh]);

  const handleInstall = async () => {
    setInstalling(true);
    toast.info('Acepta el permiso de administrador en la ventana de Windows que aparecerá.');
    try {
      const res = await installHostSyncLocal();
      setStatus(res);
      if (res.installed) toast.success('Listo. Este equipo resolverá tus .claw automáticamente.');
      else toast.error(res.message ?? 'No se pudo montar el agente.');
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo montar el agente en este equipo.');
    } finally {
      setInstalling(false);
    }
  };

  const showManualBlock = async () => {
    try {
      const b = await getHostsBlock();
      setBlock(b.block);
    } catch { toast.error('No se pudo obtener el bloque'); }
  };
  const copyManual = () => {
    if (block) { void navigator.clipboard?.writeText(block); toast.success('Bloque copiado'); }
  };

  const installed = status?.installed === true;
  const supported = status?.supported === true;

  return (
    <MethodCard
      icon={<MonitorCheck size={17} />} title="Este equipo (automático)"
      tagline="Mantiene el archivo del sistema al día — sin tocar nada"
      badge={installed ? 'Activo' : 'Recomendado'}
      badgeColor={installed ? 'var(--success, #34d399)' : 'var(--amber)'}
      open={open} onToggle={onToggle}
    >
      <p style={bodyP}>
        MicelclawOS mantiene el archivo del sistema de este equipo al día con tus
        <code> {domain}</code> y sus servicios. Se configura <strong>al instalar
        MicelclawOS</strong>; después, cualquier servicio que actives aparece solo en tu
        navegador. No edita nada más del archivo (respeta lo que ya tengas).
      </p>

      {!status ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: '0.75rem' }}>
          <Loader2 size={13} className="animate-spin" /> Comprobando este equipo…
        </div>
      ) : installed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--success, #34d399)', fontWeight: 600 }}>
            <Check size={14} /> Sincronizando este equipo
          </span>
          {status.last_run && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>· última: {status.last_run}</span>
          )}
          <button style={hubGhostBtn} disabled={installing} onClick={() => void handleInstall()}>
            {installing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reinstalar
          </button>
        </div>
      ) : supported ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            style={{ ...hubPrimaryBtn, opacity: installing ? 0.5 : 1, cursor: installing ? 'wait' : 'pointer', alignSelf: 'flex-start' }}
            disabled={installing} onClick={() => void handleInstall()}
          >
            {installing ? <Loader2 size={14} className="animate-spin" /> : <MonitorCheck size={14} />}
            Configurar este equipo
          </button>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            Pedirá permiso de administrador una vez (es necesario para tocar el archivo del sistema). Luego, automático.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.73rem', color: 'var(--text-dim)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--warning, #fb923c)', flexShrink: 0, marginTop: 1 }} />
          <span>
            {status.reason ?? 'Este equipo no admite el agente automático.'}{' '}
            {clientOS === 'mac' || clientOS === 'linux'
              ? 'De momento, usa el bloque manual o WireGuard.'
              : 'Usa WireGuard (móvil/fuera) o el bloque manual.'}
          </span>
        </div>
      )}

      {/* Fallback manual */}
      <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        {!block ? (
          <button onClick={() => void showManualBlock()} style={inlineLink}>
            Ver/copiar el bloque manual
          </button>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                Pégalo en el archivo hosts (Windows: <code>C:\Windows\System32\drivers\etc\hosts</code>, como admin):
              </span>
              <button onClick={copyManual} style={hubGhostBtn}><Copy size={12} /> Copiar</button>
            </div>
            <pre style={manualPre}>{block}</pre>
          </div>
        )}
      </div>
    </MethodCard>
  );
}

// ─── Card chrome ────────────────────────────────────────────────────────

function MethodCard({
  icon, title, tagline, badge, badgeColor, open, onToggle, children,
}: {
  icon: React.ReactNode; title: string; tagline: string;
  badge: string; badgeColor: string; open: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={methodCard}>
      <button style={methodHeader} onClick={onToggle}>
        <span style={{ color: badgeColor, display: 'inline-flex' }}>{icon}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left', flex: 1 }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>{title}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{tagline}</span>
        </span>
        <span style={{ ...methodBadge, color: badgeColor, borderColor: badgeColor, background: `color-mix(in srgb, ${badgeColor} 16%, transparent)` }}>{badge}</span>
        {open ? <ChevronDown size={15} style={{ color: 'var(--text-dim)' }} /> : <ChevronRight size={15} style={{ color: 'var(--text-dim)' }} />}
      </button>
      {open && <div style={methodBody}>{children}</div>}
    </div>
  );
}

// ─── 1. mDNS ────────────────────────────────────────────────────────────

function MdnsCard({ open, onToggle, domain }: { open: boolean; onToggle: () => void; domain: string }) {
  return (
    <MethodCard
      icon={<Podcast size={17} />} title="mDNS / Bonjour"
      tagline="Sin configurar nada — misma red"
      badge="Local" badgeColor="var(--success, #34d399)"
      open={open} onToggle={onToggle}
    >
      <p style={bodyP}>
        En dispositivos Apple (y muchos Linux/Windows recientes) tu servidor es
        alcanzable por su <strong>nombre <code>.local</code></strong> en la misma
        red, sin tocar ninguna config. Es un atajo para llegar al equipo.
      </p>
      <p style={bodyP}>
        Para entrar a los nombres con candado (<code>pdf.{domain}</code>,
        <code> music.{domain}</code>…) el dispositivo necesita resolver <code>.claw</code>:
        usa <strong>WireGuard</strong> (desde cualquier lugar, recomendado) o, en la misma
        red, apunta su DNS al servidor (arriba). mDNS por sí solo no sirve los
        subdominios <code>.claw</code>.
      </p>
    </MethodCard>
  );
}

// ─── 2. WireGuard (funcional) ───────────────────────────────────────────

function WireguardCard({ open, onToggle, domain }: { open: boolean; onToggle: () => void; domain: string }) {
  const navigate = useNavigate();
  const { clients, create, getConfig, getQrCode } = useWgClients();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; name: string; qr: string; config: string } | null>(null);

  const handleGenerate = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      const client = await create(n);
      if (!client) return;
      const [qr, config] = await Promise.all([getQrCode(client.id), getConfig(client.id)]);
      setResult({ id: client.id, name: client.name, qr: qr ?? '', config: config ?? '' });
      setName('');
    } finally {
      setBusy(false);
    }
  };

  const downloadConfig = () => {
    if (!result?.config) return;
    const blob = new Blob([result.config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.name.replace(/\s+/g, '-')}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MethodCard
      icon={<ShieldCheck size={17} />} title="WireGuard (VPN propia)"
      tagline="Desde cualquier lugar — el dispositivo no configura nada"
      badge="Recomendado" badgeColor="var(--amber)"
      open={open} onToggle={onToggle}
    >
      <p style={bodyP}>
        Generas un acceso por dispositivo. Al conectar el túnel, el dispositivo
        recibe <strong>automáticamente</strong> el DNS del sistema, así que
        <code> {domain}</code> y todos sus subdominios resuelven sin que toques
        nada en el equipo — y funciona también fuera de casa.
      </p>

      {!result ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <Smartphone size={15} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleGenerate(); }}
            placeholder="Nombre del dispositivo (iPhone, Portátil…)"
            style={hubInput}
          />
          <button
            style={{ ...hubPrimaryBtn, opacity: busy || !name.trim() ? 0.45 : 1, cursor: busy || !name.trim() ? 'not-allowed' : 'pointer' }}
            disabled={busy || !name.trim()}
            onClick={() => void handleGenerate()}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Generar acceso
          </button>
        </div>
      ) : (
        <div style={wgResult}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {result.qr && (
              <div style={qrBox} dangerouslySetInnerHTML={{ __html: result.qr }} />
            )}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                Acceso «{result.name}» listo
              </div>
              <ol style={stepsList}>
                <li>Instala la app <strong>WireGuard</strong> en el dispositivo (App Store / Play Store / wireguard.com).</li>
                <li>Pulsa “+” → <strong>escanea este QR</strong> (o importa el archivo <code>.conf</code>).</li>
                <li>Activa el túnel. Ya entras a <code>{domain}</code> y a todo lo demás por nombre.</li>
              </ol>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button style={hubGhostBtn} onClick={downloadConfig}>
                  <Download size={13} /> Descargar .conf
                </button>
                <button style={hubGhostBtn} onClick={() => setResult(null)}>
                  <Plus size={13} /> Generar otro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
        <QrCode size={12} />
        {clients.length > 0
          ? `${clients.length} dispositivo${clients.length === 1 ? '' : 's'} con acceso.`
          : 'Aún no hay dispositivos con acceso.'}
        <button onClick={() => navigate('/vpn')} style={{ ...inlineLink, marginLeft: 4 }}>
          Gestionar dispositivos <ExternalLink size={11} />
        </button>
      </div>
    </MethodCard>
  );
}

// ─── 3. Tailscale ───────────────────────────────────────────────────────

function TailscaleCard({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  return (
    <MethodCard
      icon={<Cable size={17} />} title="Tailscale (VPN gestionada)"
      tagline="Conecta aunque no puedas abrir puertos en el router"
      badge="Sin puertos" badgeColor="var(--warning, #fb923c)"
      open={open} onToggle={onToggle}
    >
      <p style={bodyP}>
        Alternativa a WireGuard cuando el router no deja abrir puertos (CG-NAT,
        operador restrictivo…). Tailscale atraviesa la red por ti con una cuenta
        gratuita. Mismo resultado: alcanzas tus <code>.claw</code> desde fuera.
      </p>
      <button style={hubGhostBtn} onClick={() => navigate('/vpn')}>
        <Cable size={13} /> Configurar Tailscale
      </button>
    </MethodCard>
  );
}

// ─── 4. Público (Fase 2) ────────────────────────────────────────────────

function PublicCard({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <MethodCard
      icon={<Globe size={17} />} title="Subdominio público"
      tagline="Un nombre de internet, sin VPN ni app"
      badge="Fase 2" badgeColor="var(--text-dim)"
      open={open} onToggle={onToggle}
    >
      <p style={{ ...bodyP, marginBottom: 0 }}>
        Próximamente: un subdominio de tu licencia (<code>tunombre.micelclaw.com</code>)
        o tu propio dominio (Cloudflare, Porkbun…), con certificado de internet, para
        entrar desde cualquier navegador sin instalar nada. Convivirá con el dominio
        local. Disponible en la Fase 2.
      </p>
    </MethodCard>
  );
}

// ─── estilos ────────────────────────────────────────────────────────────

const methodCard: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  background: 'var(--bg-elevated, rgba(255,255,255,0.02))', overflow: 'hidden',
};
const methodHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
const methodBadge: React.CSSProperties = {
  fontSize: '0.6rem', fontWeight: 600, padding: '1px 6px', borderRadius: 'var(--radius-sm)',
  border: '1px solid', whiteSpace: 'nowrap',
};
const methodBody: React.CSSProperties = {
  padding: '4px 14px 14px 14px', borderTop: '1px solid var(--border)',
};
const bodyP: React.CSSProperties = {
  fontSize: '0.75rem', color: 'var(--text-dim)', margin: '10px 0 9px 0', lineHeight: 1.6,
};
const hubInput: React.CSSProperties = {
  flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)', outline: 'none',
};
const hubPrimaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius-sm)',
  border: 'none', background: 'var(--amber)', color: '#06222a', fontSize: '0.78rem', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
};
const hubGhostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', background: 'var(--bg-elevated, rgba(255,255,255,0.05))', color: 'var(--text)',
  fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const inlineLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: 0,
  cursor: 'pointer', color: 'var(--amber)', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
};
const wgResult: React.CSSProperties = {
  marginTop: 6, padding: 12, border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)',
  background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
};
const qrBox: React.CSSProperties = {
  width: 132, height: 132, padding: 8, background: '#fff', borderRadius: 'var(--radius-sm)', flexShrink: 0,
};
const stepsList: React.CSSProperties = {
  margin: '0 0 10px 0', paddingLeft: 18, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.7,
};
const manualPre: React.CSSProperties = {
  margin: 0, padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: '0.7rem', lineHeight: 1.5,
  fontFamily: 'var(--font-mono, monospace)', overflow: 'auto', maxHeight: 180, whiteSpace: 'pre',
};
