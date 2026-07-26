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
  RefreshCw, Wifi, Copy, Smartphone,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { SettingSection } from '../SettingSection';
import { InlineLoading } from '../shared/InlineLoading';
import {
  getDomains, addDomain, updateDomain, deleteDomain, setServiceExposure,
  resyncDomain, getLocalDomainSetup,
  getMdnsAgentStatus, installMdnsAgent,
  type SystemDomain, type MdnsAgentStatus,
} from '@/services/domains.service';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import { DomainAccessMethods } from './DomainAccessMethods';
import {
  hasNativeCaBridge, nativeCaStatus, nativeDownloadCa, nativeInstallCa, nativeOpenSecuritySettings,
} from '@/lib/native-ca';

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
  const [mdns, setMdns] = useState<MdnsAgentStatus | null>(null);
  const [installingMdns, setInstallingMdns] = useState(false);

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
  const refreshMdns = useCallback(() => {
    // Silencioso: en bare-metal Linux o si no eres admin, este bloque simplemente
    // no se muestra. No es un error que haya que gritar.
    void getMdnsAgentStatus().then(setMdns).catch(() => setMdns(null));
  }, []);
  useEffect(() => { refreshMdns(); }, [refreshMdns]);

  const handleInstallMdns = async () => {
    setInstallingMdns(true);
    try {
      const res = await installMdnsAgent();
      setMdns(res);
      toast.success(res.message ?? 'Agente instalado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo instalar el agente.');
    } finally {
      setInstallingMdns(false);
      // El agente tarda unos segundos en anunciar: se re-consulta poco después.
      setTimeout(refreshMdns, 6000);
    }
  };

  const reloadResolver = () => void useServiceUrlsStore.getState().load(true);

  const handleCreate = async (tld: 'claw' | 'local') => {
    const label = newLabel.trim().toLowerCase();
    if (!label) return;
    setCreating(true);
    try {
      const d = await addDomain(`${label}.${tld}`, 'local');
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
  // Dominios locales cuyo registro DNS quedó apuntando a una IP que ya no es la del box.
  // Se detecta comparando la IP VIVA (getLocalDomainSetup) con la persistida al aprovisionar.
  const drifted = lanIp
    ? domains.filter(d => d.kind === 'local' && d.wildcard_ip && d.wildcard_ip !== lanIp)
    : [];

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

        {/* Deriva de IP: el router cambió la dirección del servidor y los registros DNS de
            los dominios locales siguen apuntando a la vieja → todo lo que resuelva por
            nombre (móvil, otros equipos) deja de conectar, en silencio. */}
        {drifted.length > 0 && (
          <div style={driftBox} data-testid="ip-drift-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--amber)' }}>
              <AlertTriangle size={16} /> La dirección de tu servidor cambió
            </div>
            <div style={{ fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
              Ahora es <code>{lanIp}</code>, pero {drifted.length === 1 ? 'el dominio' : 'los dominios'}{' '}
              {drifted.map(d => <code key={d.id} style={{ marginRight: 4 }}>{d.domain}</code>)}
              {drifted.length === 1 ? ' apunta' : ' apuntan'} todavía a{' '}
              <code>{drifted[0]?.wildcard_ip}</code>.{' '}
              <strong>Se está corrigiendo solo</strong> — el servidor lo comprueba cada pocos minutos
              y se re-apunta sin que tengas que hacer nada. Si tienes prisa, puedes forzarlo aquí.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {drifted.map(d => (
                <button key={d.id} style={driftBtn} disabled={busy === d.id} onClick={() => handleResync(d)}>
                  {busy === d.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Corregir {d.domain} ahora
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Tu router asigna la dirección por DHCP y puede cambiarla al reiniciarse. Para que no
              vuelva a pasar, <strong>resérvale esta IP</strong> en la configuración del router
              (busca «DHCP» → reserva o asignación estática).
            </div>
          </div>
        )}

        {/* Cómo te encuentra el móvil: agente mDNS + la verdad sobre el caso sin internet.
            Solo se muestra donde aplica (WSL2 sobre Windows y siendo admin). */}
        {mdns?.supported && (
          <div style={mdnsBox} data-testid="mdns-agent-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <Smartphone size={16} style={{ color: 'var(--amber)' }} />
              Cómo te encuentra el móvil
            </div>

            <div style={{ fontSize: '0.8125rem', lineHeight: 1.55, color: 'var(--text-muted)' }}>
              {mdns.running === true ? (
                <>
                  Tu servidor se anuncia en la red como{' '}
                  <code>{mdns.announced_name ?? 'micelclaw.local'}</code>, así que un móvil
                  puede entrar <strong>sin saber ninguna dirección IP</strong> y sin que le
                  afecte que el router se la cambie.
                </>
              ) : (
                <>
                  Ahora mismo tu móvil solo puede entrar por la dirección IP, y esa{' '}
                  <strong>cambia cuando el router se reinicia</strong>. Si instalas el
                  anunciador, el servidor se presenta en la red con un nombre fijo
                  (<code>{mdns.announced_name ?? 'micelclaw.local'}</code>) y el teléfono lo
                  encuentra solo.
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                ...badgeStyle,
                color: mdns.running === true ? 'var(--success, #34d399)' : 'var(--text-muted)',
                borderColor: mdns.running === true ? 'var(--success, #34d399)' : 'var(--border)',
              }}>
                {mdns.running === true ? 'Publicando' : mdns.task_installed ? 'Instalado, arrancando' : 'No instalado'}
              </span>
              {mdns.running !== true && (
                <button style={primaryBtn} disabled={installingMdns} onClick={handleInstallMdns}
                        data-testid="install-mdns-agent">
                  {installingMdns ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Instalar el anunciador
                </button>
              )}
              <button style={iconBtn} onClick={refreshMdns} title="Volver a comprobar">
                <RefreshCw size={13} />
              </button>
            </div>

            {mdns.running !== true && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Pedirá permiso de administrador <strong>una vez</strong>: se instala en Windows
                (fuera de Micelclaw) porque el descubrimiento por nombre no funciona desde
                dentro del servidor.
              </div>
            )}

            {/* Lo que hay que decir aunque no apetezca: el caso SIN internet. */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <strong style={{ color: 'var(--text)' }}>Si algún día tu red se queda sin internet</strong>{' '}
              y usas un nombre público para entrar desde fuera, ese nombre deja de resolver
              (necesita internet para traducirse). En ese caso la app <strong>vuelve sola</strong> a
              buscar el servidor dentro de tu red: por eso el descubrimiento local nunca se
              retira, y por eso conviene <strong>mantener instalado el certificado del
              servidor</strong> en tus dispositivos.
            </div>
          </div>
        )}

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
                    {/* Siempre visible para dominios locales: la deriva de IP deja el estado en
                        'active' (el DNS se creó bien, solo apunta a una IP muerta) y con la
                        condición vieja (`status !== 'active'`) el botón se ocultaba precisamente
                        en el caso que hay que arreglar → no había forma de resincronizar desde la UI. */}
                    {d.kind === 'local' && (
                      <button
                        title={d.status === 'active' ? 'Resincronizar DNS con la IP actual' : 'Reintentar DNS'}
                        style={iconBtn} disabled={busy === d.id} onClick={() => handleResync(d)}
                        data-testid={`resync-${d.domain}`}
                      >
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

        {/* Crear dominio local — elige TLD (.claw o .local). Solo uno a la vez. */}
        {(() => {
          const hasLocal = domains.some(d => d.kind === 'local');
          const disabled = creating || !newLabel.trim() || hasLocal;
          const btn = (tld: 'claw' | 'local') => (
            <button
              style={{ ...primaryBtn, opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
              disabled={disabled}
              onClick={() => void handleCreate(tld)}
              title={hasLocal ? 'Ya tienes un dominio local. Bórralo para cambiar de TLD.' : `Crear ${newLabel.trim() || 'nombre'}.${tld}`}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Crear .{tld}
            </button>
          );
          return (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
                  placeholder="victor"
                  style={inputStyle}
                  disabled={hasLocal}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>.claw / .local</span>
                {btn('claw')}
                {btn('local')}
              </div>
              <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {hasLocal ? (
                  <>Ya tienes un dominio local (<code>{domains.find(d => d.kind === 'local')?.domain}</code>). Solo se permite uno: bórralo arriba para crear otro con distinto TLD.</>
                ) : (
                  <>Elige <b>uno</b> de los dos (no ambos). <code>.claw</code> es el recomendado. <code>.local</code> resuelve por el mismo DNS, pero <b>macOS y Linux</b> (systemd) suelen interceptarlo como mDNS y puede no resolver; en <b>Windows y Android</b> funciona.</>
                )}
              </div>
            </>
          );
        })()}
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

      {/* Conexión segura en la app móvil (solo en el envoltorio APK): estado + instalación NATIVA de la CA */}
      {hasNativeCaBridge() && <NativeSecureConnection />}

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

// ─── Conexión segura (app móvil) ────────────────────────────────────
// Solo se monta si `hasNativeCaBridge()`. Muestra el estado de confianza del
// certificado del box para ESTE dispositivo y, si falta, lo instala con el flujo
// NATIVO de Android (instalador directo) + sondeo hasta que sea de confianza.
function NativeSecureConnection() {
  // Sondeamos SIEMPRE la URL https del box (no el origen http actual), porque una
  // URL http siempre daría "trusted" (el almacén de CA no aplica sin https).
  const httpsUrl = `https://${window.location.hostname}`;
  const [state, setState] = useState<'checking' | 'secure' | 'insecure'>('checking');
  const [installing, setInstalling] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [sha, setSha] = useState('');

  const probe = useCallback(async () => {
    const { trusted } = await nativeCaStatus(httpsUrl);
    setState(trusted ? 'secure' : 'insecure');
  }, [httpsUrl]);

  useEffect(() => { void probe(); }, [probe]);

  const install = async () => {
    setInstalling(true); setSha('');
    // La descarga usa el ORIGEN actual (sirve /api/v1 pre-CA: http://ip:7100 o https tras CA).
    const res = await nativeDownloadCa(window.location.origin);
    setInstalling(false);
    if (!res.ok) { toast.error('No se pudo descargar el certificado. Revisa que el servidor está accesible.'); return; }
    if (res.sha256) setSha(res.sha256);
    nativeInstallCa();
    setWaiting(true);
    const start = Date.now();
    const tick = async () => {
      const { trusted } = await nativeCaStatus(httpsUrl);
      if (trusted) { setState('secure'); setWaiting(false); toast.success('Conexión segura activada'); return; }
      if (Date.now() - start > 90000) { setWaiting(false); return; }
      setTimeout(() => void tick(), 2000);
    };
    void tick();
  };

  const box: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '12px 14px', borderRadius: 'var(--radius-md)',
  };
  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content',
    padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    background: 'var(--bg-elevated, rgba(255,255,255,0.05))', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82rem',
  };

  return (
    <SettingSection
      title="Conexión segura (esta app)"
      description="Estado del certificado de tu servidor en este dispositivo. Con él, la app va cifrada (HTTPS) y el micrófono, Office y el chat en vivo funcionan."
    >
      {state === 'checking' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <Loader2 size={14} className="animate-spin" /> Comprobando el certificado…
        </div>
      )}

      {state === 'secure' && (
        <div style={{ ...box, border: '1px solid color-mix(in srgb, var(--success, #34d399) 45%, transparent)', background: 'color-mix(in srgb, var(--success, #34d399) 8%, transparent)' }} data-testid="secure-ok">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--success, #34d399)' }}>
            <ShieldCheck size={16} /> Conexión segura activada
          </div>
          <div style={{ fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--text-muted)' }}>
            Este dispositivo confía en el certificado de tu servidor. Todo va cifrado (HTTPS).
          </div>
        </div>
      )}

      {state === 'insecure' && (
        <div style={{ ...box, border: '1px solid color-mix(in srgb, var(--warning, #fb923c) 45%, transparent)', background: 'color-mix(in srgb, var(--warning, #fb923c) 8%, transparent)' }} data-testid="secure-insecure">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: 'var(--warning, #fb923c)' }}>
            <AlertTriangle size={16} /> Certificado no instalado
          </div>
          <div style={{ fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--text-muted)' }}>
            Vas por conexión sin cifrar. Instala el certificado de tu servidor una vez para activar HTTPS.
          </div>
          {sha && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              Huella (SHA-256): <code>{sha}</code>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <button style={btn} onClick={() => void install()} disabled={installing || waiting} data-testid="secure-install">
              <ShieldCheck size={14} /> {installing ? 'Preparando…' : waiting ? 'Esperando…' : 'Instalar certificado'}
            </button>
            {waiting && (
              <button style={btn} onClick={() => nativeOpenSecuritySettings()} data-testid="secure-settings">
                ¿No se abrió? Abrir Ajustes
              </button>
            )}
          </div>
          {waiting && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Confirma la instalación de <b>micelclaw-ca.crt</b> como certificado de <b>CA</b>. Volvemos solos al terminar.
            </div>
          )}
        </div>
      )}
    </SettingSection>
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
const mdnsBox: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  background: 'var(--surface)',
};

const driftBox: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', marginBottom: 14,
  borderRadius: 'var(--radius-md)', border: '1px solid color-mix(in srgb, var(--amber) 45%, transparent)',
  background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
};
const driftBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', cursor: 'pointer',
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--amber)', background: 'transparent',
  color: 'var(--amber)', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
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
