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

// ─── Domains Section ─────────────────────────────────────────────────
// El "dominio principal del sistema": crea un dominio local (.claw) y, al
// fijarlo, auto-aprovisiona el acceso por subdominio a cada servicio
// (stirling.victor.claw…). Las entradas reales se ven/editan en los módulos
// Reverse Proxy y DNS. Fase 1 = local; público (micelclaw/propio) = Fase 2.

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Globe2, Plus, Trash2, Star, ExternalLink, Loader2, ShieldCheck,
  Download, AlertTriangle, Check, Power, ChevronDown, ChevronRight,
  RefreshCw, Wifi, Copy,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { SettingSection } from '../SettingSection';
import { InlineLoading } from '../shared/InlineLoading';
import {
  getDomains, addDomain, updateDomain, deleteDomain, setServiceExposure,
  resyncDomain, getLocalDomainSetup,
  type SystemDomain,
} from '@/services/domains.service';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import { DomainAccessMethods } from './DomainAccessMethods';

const CA_CERT_URL = '/api/v1/hal/network/proxy/ca-certificate';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activo', color: 'var(--success, #34d399)' },
  pending_dns: { label: 'DNS pendiente', color: 'var(--warning, #fb923c)' },
  pending_cert: { label: 'Certificado pendiente', color: 'var(--warning, #fb923c)' },
  error: { label: 'Error', color: 'var(--error, #f87171)' },
};

export function DomainsSection() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<SystemDomain[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [lanIp, setLanIp] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDomains(await getDomains());
      setLoadState('ok');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    void getLocalDomainSetup().then(s => setLanIp(s.lan_ip)).catch(() => {});
  }, []);

  const reloadResolver = () => void useServiceUrlsStore.getState().load(true);

  const handleCreate = async () => {
    const label = newLabel.trim().toLowerCase();
    if (!label) return;
    setCreating(true);
    try {
      const d = await addDomain(`${label}.claw`, 'local');
      toast.success(`Dominio ${d.domain} creado`);
      if (d.status === 'error') {
        toast.warning(`Rutas creadas, pero el DNS no se provisionó: ${d.error_message ?? 'PowerDNS no disponible'}`);
      }
      setNewLabel('');
      await refresh();
      reloadResolver();
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al crear el dominio');
    } finally {
      setCreating(false);
    }
  };

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try { await fn(); } finally { setBusy(null); }
  };

  const handleSetPrimary = (id: string) => withBusy(id, async () => {
    await updateDomain(id, { is_primary: true });
    await refresh();
    reloadResolver();
  });

  const handleToggleEnabled = (d: SystemDomain) => withBusy(d.id, async () => {
    await updateDomain(d.id, { enabled: !d.enabled });
    await refresh();
    reloadResolver();
  });

  const handleDelete = (d: SystemDomain) => withBusy(d.id, async () => {
    if (!confirm(`¿Eliminar el dominio ${d.domain}? Se quitarán sus accesos por subdominio.`)) return;
    await deleteDomain(d.id);
    toast.success(`Dominio ${d.domain} eliminado`);
    await refresh();
    reloadResolver();
  });

  const handleResync = (d: SystemDomain) => withBusy(d.id, async () => {
    const updated = await resyncDomain(d.id);
    if (updated.status === 'active') toast.success(`DNS de ${d.domain} sincronizado`);
    else toast.warning(`No se pudo: ${updated.error_message ?? 'PowerDNS no disponible'}`);
    await refresh();
    reloadResolver();
  });

  const handleToggleExposure = (slug: string, exposed: boolean) => withBusy(`svc:${slug}`, async () => {
    await setServiceExposure(slug, !exposed);
    await refresh();
    reloadResolver();
  });

  const copyIp = () => {
    if (lanIp) { void navigator.clipboard?.writeText(lanIp); toast.success('IP copiada'); }
  };

  if (loadState === 'loading') return <InlineLoading />;

  const primary = domains.find(d => d.is_primary) ?? domains[0] ?? null;

  return (
    <div>
      <SettingSection title="Dominio principal del sistema">
        {/* Intro corta + Leer más */}
        <div style={{ marginBottom: 14 }}>
          <p style={introText}>
            Accede a la web del sistema y a todos los servicios por un nombre
            (<code>stirling.tudominio.claw</code>) en vez de IP:puerto. Fase 1:
            dominios locales <code>.claw</code>, dentro de tu red, con certificado por la CA interna.
          </p>
          <button onClick={() => setShowHelp(v => !v)} style={readMoreLink}>
            {showHelp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {showHelp ? 'Leer menos' : 'Leer más…'}
          </button>
          {showHelp && (
            <div style={helpBox}>
              <p style={helpP}>
                <strong style={helpQ}>¿Para qué sirve?</strong> Normalmente, para entrar a cada
                servicio tienes que recordar una dirección de números y un puerto
                (por ejemplo <code>127.0.0.1:8081</code> para el editor de PDF). Es incómodo. Con un
                <em> dominio principal</em> le pones un nombre a tu servidor (p. ej. <code>victor.claw</code>)
                y entras a todo por nombre: la web del sistema en <code>victor.claw</code>, el editor de
                PDF en <code>pdf.victor.claw</code>, la música en <code>music.victor.claw</code>… Tú eliges
                el nombre; el sistema crea solo todas las direcciones.
              </p>
              <p style={helpP}>
                <strong style={helpQ}>¿Qué es “.claw”?</strong> Es la terminación del dominio local,
                como “.com” pero solo dentro de tu red (no existe en internet abierto). Funciona sin
                conexión y sin pagar nada.
              </p>
              <p style={helpP}>
                <strong style={helpQ}>¿Y el candado (HTTPS)?</strong> El navegador avisa de “sitio no
                seguro” si una web no tiene certificado. Como tu <code>.claw</code> solo existe en tu
                casa, el propio sistema hace de “autoridad” y emite el certificado. Instala su sello
                (el botón “Descargar certificado CA” de más abajo) una vez en cada dispositivo y todos
                los <code>.claw</code> saldrán con candado verde.
              </p>
              <p style={helpP}>
                <strong style={helpQ}>¿Dónde se ven las direcciones creadas?</strong> Cada acceso es
                una entrada real y editable en los módulos <em>Reverse Proxy</em> (marcada “system”) y
                <em> DNS</em>. Nada queda oculto: puedes usarlas de ejemplo para exponer tus propios servicios.
              </p>
              <p style={{ ...helpP, marginBottom: 0 }}>
                <strong style={helpQ}>¿Y desde fuera de casa?</strong> En la Fase 2 podrás añadir un
                dominio público (el de tu licencia o uno tuyo de Cloudflare) y tener el local y el
                público funcionando a la vez.
              </p>
            </div>
          )}
        </div>

        {/* Lista de dominios */}
        {domains.length === 0 ? (
          <div style={emptyStyle}>
            <Globe2 size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Aún no tienes un dominio del sistema.
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Crea uno local abajo (ej. <code>victor.claw</code>) y se configurarán solos los accesos a tus apps.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {domains.map(d => (
              <div key={d.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Globe2 size={16} style={{ color: d.is_primary ? 'var(--amber)' : 'var(--text-muted)' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{d.domain}</span>
                  <span style={badgeStyle}>{d.kind}</span>
                  {d.is_primary && <span style={{ ...badgeStyle, color: 'var(--amber)', borderColor: 'var(--amber)' }}>principal</span>}
                  <span style={{ ...badgeStyle, color: STATUS_LABELS[d.status]?.color, borderColor: STATUS_LABELS[d.status]?.color }}>
                    {STATUS_LABELS[d.status]?.label ?? d.status}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {d.status !== 'active' && d.kind === 'local' && (
                      <button title="Reintentar DNS" style={iconBtn} disabled={busy === d.id} onClick={() => handleResync(d)}>
                        {busy === d.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      </button>
                    )}
                    {!d.is_primary && (
                      <button title="Marcar como principal" style={iconBtn} disabled={busy === d.id} onClick={() => handleSetPrimary(d.id)}>
                        <Star size={14} />
                      </button>
                    )}
                    <button title={d.enabled ? 'Desactivar' : 'Activar'} style={iconBtn} disabled={busy === d.id} onClick={() => handleToggleEnabled(d)}>
                      <Power size={14} style={{ color: d.enabled ? 'var(--success, #34d399)' : 'var(--text-muted)' }} />
                    </button>
                    <button title="Eliminar" style={iconBtn} disabled={busy === d.id} onClick={() => handleDelete(d)}>
                      {busy === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
                {d.error_message && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '0.7rem', color: 'var(--error, #f87171)' }}>
                    <AlertTriangle size={12} /> {d.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Crear dominio local */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
            placeholder="victor"
            style={inputStyle}
            onKeyDown={e => { if (e.key === 'Enter') void handleCreate(); }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>.claw</span>
          <button
            style={{
              ...primaryBtn,
              opacity: creating || !newLabel.trim() ? 0.45 : 1,
              cursor: creating || !newLabel.trim() ? 'not-allowed' : 'pointer',
            }}
            disabled={creating || !newLabel.trim()}
            onClick={() => void handleCreate()}
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Crear dominio local
          </button>
        </div>
      </SettingSection>

      {/* Servicios expuestos */}
      {primary && (
        <SettingSection
          title="Servicios expuestos"
          description={`Cada app accesible bajo ${primary.domain}. Activa/desactiva la exposición; las entradas se ven y editan en los módulos Reverse Proxy y DNS.`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {primary.services.map(svc => {
              const url = `https://${svc.subdomain}.${primary.domain}`;
              return (
                <div key={svc.slug} style={svcRow}>
                  <button
                    title={svc.exposed ? 'Exponer: ON' : 'Exponer: OFF'}
                    style={{ ...togglePill, ...(svc.exposed ? togglePillOn : {}) }}
                    disabled={busy === `svc:${svc.slug}`}
                    onClick={() => handleToggleExposure(svc.slug, svc.exposed)}
                  >
                    {busy === `svc:${svc.slug}` ? <Loader2 size={11} className="animate-spin" /> : (svc.exposed ? <Check size={11} /> : null)}
                  </button>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text)', minWidth: 120 }}>{svc.display_name}</span>
                  <code style={{ fontSize: '0.72rem', color: svc.exposed ? 'var(--text-muted)' : 'var(--text-disabled, #64748b)' }}>{url}</code>
                  <a
                    href={url} target="_blank" rel="noopener noreferrer"
                    style={{ marginLeft: 'auto', ...iconBtn, opacity: svc.exposed ? 1 : 0.4, pointerEvents: svc.exposed ? 'auto' : 'none' }}
                    title="Abrir en nueva pestaña"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              );
            })}
          </div>
        </SettingSection>
      )}

      {/* Acceso desde tus dispositivos (DNS de cliente) */}
      {primary && (
        <SettingSection
          title="Acceso desde tus dispositivos"
          description="Varias formas de alcanzar tus .claw — elige la que menos fricción te dé. La directa es apuntar el DNS al servidor; abajo tienes opciones que NO requieren tocar la config de red de cada dispositivo."
        >
          {/* Método directo: DNS al servidor (misma red) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wifi size={15} style={{ color: 'var(--amber)' }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Método directo · DNS del servidor:</span>
              <code style={{
                fontSize: '0.8125rem', color: 'var(--text)', padding: '3px 8px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)',
              }}>{lanIp ?? 'detectando…'}</code>
              {lanIp && (
                <button title="Copiar" style={iconBtn} onClick={copyIp}><Copy size={13} /></button>
              )}
            </div>
            <button onClick={() => setShowAccess(v => !v)} style={readMoreLink}>
              {showAccess ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {showAccess ? 'Ocultar pasos' : 'Cómo configurarlo'}
            </button>
          </div>

          {showAccess && (
            <div style={helpBox}>
              <p style={helpP}>
                <strong style={helpQ}>Opción A — en el router (una sola vez para toda la red):</strong>{' '}
                entra en la config de tu router (normalmente <code>192.168.1.1</code>), busca DHCP/DNS y pon el
                <em> DNS primario</em> en <code>{lanIp ?? 'la IP de arriba'}</code>. Reinicia el Wi-Fi del dispositivo.
              </p>
              <p style={helpP}>
                <strong style={helpQ}>Opción B — solo en este dispositivo:</strong>{' '}
                <em>Windows:</em> Configuración de red → Propiedades del adaptador → IPv4 → DNS preferido ={' '}
                <code>{lanIp ?? '…'}</code>. <em>macOS/iOS/Android/Linux:</em> en los ajustes de DNS de la red, añade esa IP.
              </p>
              <p style={{ ...helpP, marginBottom: 0 }}>
                ¿Guía completa por plataforma? Está en el módulo{' '}
                <button onClick={() => navigate('/dns')} style={{ ...readMoreLink, display: 'inline' }}>DNS → Dominios locales</button>.
                Recuerda instalar también el certificado CA (abajo) para el candado HTTPS.
              </p>
            </div>
          )}

          {/* Hub anti-fricción: 4 métodos sin tocar el DNS del dispositivo */}
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              O sin tocar la config de red de cada dispositivo
            </div>
            <DomainAccessMethods primaryDomain={primary.domain} />
          </div>
        </SettingSection>
      )}

      {/* Certificado CA */}
      <SettingSection
        title="Certificado (HTTPS local)"
        description="Los dominios .claw usan la CA interna de Caddy. Instala su certificado una vez en tus dispositivos para que todos los .claw salgan con candado y sin avisos de “sitio no seguro”."
      >
        <a href={CA_CERT_URL} download="micelclaw-ca.crt" style={{ ...primaryBtn, textDecoration: 'none', width: 'fit-content' }}>
          <Download size={14} /> Descargar certificado CA
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <ShieldCheck size={12} /> Tras instalarlo, reinicia el navegador para que tome el certificado.
        </div>
      </SettingSection>

      {/* Fase 2: público */}
      <SettingSection
        title="Dominios públicos (próximamente)"
        description="Subdominio de la licencia (victor.micelclaw.com) y tu propio dominio (Cloudflare, Porkbun…), con certificado de internet. Podrán coexistir con el dominio local."
      >
        <div style={{ ...cardStyle, opacity: 0.55, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Disponible en la Fase 2. El dominio local de arriba ya te da acceso por nombre dentro de tu red.
        </div>
      </SettingSection>
    </div>
  );
}

// ─── estilos inline (consistentes con el resto de Settings) ─────────

const emptyStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
  padding: '20px 12px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', marginBottom: 16,
};
const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', background: 'var(--bg-elevated, rgba(255,255,255,0.02))',
};
const badgeStyle: React.CSSProperties = {
  fontSize: '0.625rem', padding: '1px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', color: 'var(--text-muted)', textTransform: 'capitalize',
};
const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
  background: 'var(--bg-elevated, rgba(255,255,255,0.05))', color: 'var(--text)', cursor: 'pointer',
};
// Botón principal: relleno sólido con texto oscuro → alto contraste y claramente "clicable".
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)',
  border: 'none', background: 'var(--amber)',
  color: '#06222a', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const introText: React.CSSProperties = {
  fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 6px 0', lineHeight: 1.55,
};
const readMoreLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: 0,
  cursor: 'pointer', color: 'var(--warning, #fbbf24)', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
};
const helpBox: React.CSSProperties = {
  marginTop: 8, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  background: 'var(--bg-elevated, rgba(255,255,255,0.025))',
};
const helpP: React.CSSProperties = {
  fontSize: '0.75rem', color: 'var(--text-dim)', margin: '0 0 9px 0', lineHeight: 1.6,
};
const helpQ: React.CSSProperties = { color: 'var(--text)' };
const inputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: '0.8125rem', width: 140, fontFamily: 'var(--font-sans)',
};
const svcRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', borderRadius: 'var(--radius-sm)',
};
const togglePill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0,
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
};
const togglePillOn: React.CSSProperties = {
  borderColor: 'var(--success, #34d399)', background: 'color-mix(in srgb, var(--success, #34d399) 16%, transparent)', color: 'var(--success, #34d399)',
};
