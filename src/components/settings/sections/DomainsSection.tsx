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
  Download, AlertTriangle, Check, Power,
} from 'lucide-react';
import { SettingSection } from '../SettingSection';
import { InlineLoading } from '../shared/InlineLoading';
import {
  getDomains, addDomain, patchDomain, deleteDomain, setServiceExposure,
  type SystemDomain,
} from '@/services/domains.service';
import { useServiceUrlsStore } from '@/stores/service-urls.store';

const CA_CERT_URL = '/api/v1/hal/network/proxy/ca-certificate';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activo', color: 'var(--success, #34d399)' },
  pending_dns: { label: 'DNS pendiente', color: 'var(--warning, #fb923c)' },
  pending_cert: { label: 'Certificado pendiente', color: 'var(--warning, #fb923c)' },
  error: { label: 'Error', color: 'var(--error, #f87171)' },
};

export function DomainsSection() {
  const [domains, setDomains] = useState<SystemDomain[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDomains(await getDomains());
      setLoadState('ok');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

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
    await patchDomain(id, { is_primary: true });
    await refresh();
    reloadResolver();
  });

  const handleToggleEnabled = (d: SystemDomain) => withBusy(d.id, async () => {
    await patchDomain(d.id, { enabled: !d.enabled });
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

  const handleToggleExposure = (slug: string, exposed: boolean) => withBusy(`svc:${slug}`, async () => {
    await setServiceExposure(slug, !exposed);
    await refresh();
    reloadResolver();
  });

  if (loadState === 'loading') return <InlineLoading />;

  const primary = domains.find(d => d.is_primary) ?? domains[0] ?? null;

  return (
    <div>
      <SettingSection
        title="Dominio principal del sistema"
        description="Accede a la web del sistema y a todos los servicios por un nombre (stirling.tudominio.claw) en vez de IP:puerto. Fase 1: dominios locales .claw, dentro de tu red, con certificado por la CA interna."
      >
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
                  <Globe2 size={16} style={{ color: d.is_primary ? 'var(--accent, #22d3ee)' : 'var(--text-muted)' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{d.domain}</span>
                  <span style={badgeStyle}>{d.kind}</span>
                  {d.is_primary && <span style={{ ...badgeStyle, color: 'var(--accent, #22d3ee)', borderColor: 'var(--accent, #22d3ee)' }}>principal</span>}
                  <span style={{ ...badgeStyle, color: STATUS_LABELS[d.status]?.color, borderColor: STATUS_LABELS[d.status]?.color }}>
                    {STATUS_LABELS[d.status]?.label ?? d.status}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
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
          <button style={primaryBtn} disabled={creating || !newLabel.trim()} onClick={() => void handleCreate()}>
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
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer',
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--accent, #22d3ee)', background: 'color-mix(in srgb, var(--accent, #22d3ee) 14%, transparent)',
  color: 'var(--accent, #22d3ee)', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
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
