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

import { useState } from 'react';
import { Home, Plus, Trash2, Wifi, Info, CheckCircle, AlertTriangle, Lock, Download, Shield } from 'lucide-react';
import { DnsCallout } from '../components/DnsCallout';
import { InfoTooltip } from '../components/InfoTooltip';
import { CopyBlock } from '../components/CopyBlock';
import { PlatformTabs } from '../components/PlatformTabs';
import type { LocalDomain, LocalDomainSetup, LocalDomainInput } from '../hooks/use-local-domains';

interface LocalDomainsSectionProps {
  domains: LocalDomain[];
  setup: LocalDomainSetup | null;
  loading: boolean;
  onAdd: (input: LocalDomainInput) => Promise<LocalDomain | null>;
  onRemove: (id: string) => Promise<void>;
  onDownloadCa: () => Promise<void>;
}

export function LocalDomainsSection({ domains, setup, loading, onAdd, onRemove, onDownloadCa }: LocalDomainsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showCaGuide, setShowCaGuide] = useState(false);
  const [hostname, setHostname] = useState('');
  const [ip, setIp] = useState('');
  const [enableHttps, setEnableHttps] = useState(false);
  const [port, setPort] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const lanIp = setup?.lan_ip ?? '192.168.1.x';

  const handleSubmit = async () => {
    if (!hostname.trim() || !ip.trim()) return;
    setSubmitting(true);
    const input: LocalDomainInput = { hostname: hostname.trim().toLowerCase(), ip: ip.trim() };
    if (enableHttps && port) input.port = parseInt(port, 10);
    const result = await onAdd(input);
    setSubmitting(false);
    if (result) {
      setHostname('');
      setIp('');
      setPort('');
      setEnableHttps(false);
      setShowForm(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '0.875rem',
      }}>
        Cargando dominios locales...
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{
          fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
          margin: 0, fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Home size={20} style={{ color: '#d4a017' }} />
          Dominios Locales
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            background: '#3b82f6', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={14} />
          Nuevo dominio
        </button>
      </div>

      {/* Educational callout */}
      <DnsCallout icon={Info} collapsible defaultCollapsed={domains.length > 0} title="¿Qué son los dominios locales?">
        <p style={{ margin: '0 0 8px' }}>
          Los dominios locales te permiten acceder a tus servicios con nombres fáciles de recordar en vez de IPs.
          Por ejemplo, escribe <strong style={{ color: 'var(--text)' }}>nas.claw</strong> en tu navegador en vez de <code style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>192.168.1.50:5000</code>.
        </p>
        <p style={{ margin: 0 }}>
          Tu servidor Micelclaw actúa como DNS de tu red local. Cuando escribes <strong style={{ color: 'var(--text)' }}>nas.claw</strong>,
          tu dispositivo pregunta al servidor y éste responde con la IP correcta. Solo funciona dentro de tu red.
        </p>
      </DnsCallout>

      {/* Setup guide */}
      <div style={{ marginTop: 16, marginBottom: 20 }}>
        <button
          onClick={() => setShowSetup(!showSetup)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '12px 16px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            textAlign: 'left',
          }}
        >
          <Wifi size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
              Configurar tu red
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Para que los dominios .claw funcionen, tus dispositivos deben usar este servidor como DNS
            </div>
          </div>
          <span style={{
            fontSize: '0.6875rem', color: 'var(--text-muted)',
            padding: '2px 8px', background: 'var(--surface-hover)',
            borderRadius: 'var(--radius-sm)',
          }}>
            {showSetup ? 'Ocultar' : 'Ver guía'}
          </span>
        </button>

        {showSetup && (
          <div style={{
            marginTop: 8, padding: 20,
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            background: 'var(--card)',
          }}>
            {/* Server IP */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
                  IP de tu servidor Micelclaw:
                </span>
                {setup?.lan_ip ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '0.8125rem', color: '#22c55e',
                  }}>
                    <CheckCircle size={12} />
                    detectada
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '0.8125rem', color: '#f59e0b',
                  }}>
                    <AlertTriangle size={12} />
                    no detectada
                  </span>
                )}
              </div>
              <CopyBlock code={lanIp} />
            </div>

            {/* Method tabs */}
            <div style={{
              fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8,
            }}>
              Elige un método
            </div>

            <SetupMethodTabs lanIp={lanIp} />
          </div>
        )}
      </div>

      {/* Add domain form */}
      {showForm && (
        <div style={{
          marginBottom: 20, padding: 20,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          background: 'var(--card)',
        }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
            Nuevo dominio local
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {/* Hostname */}
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
                marginBottom: 4,
              }}>
                Nombre
                <InfoTooltip>
                  El nombre que usarás para acceder al servicio. Por ejemplo, &quot;nas&quot; creará el dominio nas.claw
                </InfoTooltip>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', background: 'var(--surface)',
              }}>
                <input
                  type="text"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="nas"
                  style={{
                    flex: 1, padding: '8px 12px',
                    background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--text)', fontSize: '0.8125rem',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                />
                <span style={{
                  padding: '8px 12px',
                  fontSize: '0.8125rem', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono, monospace)',
                  background: 'var(--surface-hover)', borderLeft: '1px solid var(--border)',
                  flexShrink: 0,
                }}>
                  .claw
                </span>
              </div>
            </div>

            {/* IP */}
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
                marginBottom: 4,
              }}>
                Dirección IP
                <InfoTooltip>
                  La IP del dispositivo o servicio en tu red local. Suele empezar por 192.168.x.x o 10.x.x.x
                </InfoTooltip>
              </div>
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.50"
                style={{
                  width: '100%', padding: '8px 12px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', outline: 'none',
                  color: 'var(--text)', fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              />
            </div>
          </div>

          {/* HTTPS toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
            padding: '10px 12px',
            background: enableHttps ? 'rgba(34, 197, 94, 0.06)' : 'var(--surface)',
            border: enableHttps ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <button
              type="button"
              onClick={() => setEnableHttps(!enableHttps)}
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: enableHttps ? '#22c55e' : 'var(--surface-hover)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: enableHttps ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Lock size={12} style={{ color: enableHttps ? '#22c55e' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
                  Activar HTTPS
                </span>
                <InfoTooltip>
                  Introduce el puerto donde tu servicio escucha (ej: 8096 para Jellyfin). Se creará automáticamente un proxy HTTPS con certificado de confianza.
                </InfoTooltip>
              </div>
            </div>
            {enableHttps && (
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="Puerto (ej: 8096)"
                style={{
                  width: 140, padding: '6px 10px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', outline: 'none',
                  color: 'var(--text)', fontSize: '0.8125rem',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              />
            )}
          </div>

          {/* Preview */}
          {hostname && ip && (
            <div style={{
              padding: '8px 12px', marginBottom: 14,
              background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', color: 'var(--text-muted)',
            }}>
              <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)' }}>
                {enableHttps ? 'https://' : ''}{hostname}.claw
              </strong>
              {' → '}
              <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{ip}{enableHttps && port ? `:${port}` : ''}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setShowForm(false); setHostname(''); setIp(''); }}
              style={{
                padding: '7px 14px', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                color: 'var(--text)', fontSize: '0.8125rem', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hostname.trim() || !ip.trim() || submitting}
              style={{
                padding: '7px 14px',
                background: !hostname.trim() || !ip.trim() || submitting ? 'var(--surface-hover)' : '#3b82f6',
                color: !hostname.trim() || !ip.trim() || submitting ? 'var(--text-muted)' : '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {submitting ? 'Creando...' : 'Crear dominio'}
            </button>
          </div>
        </div>
      )}

      {/* Domain list */}
      {domains.length === 0 ? (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '40px 24px',
          textAlign: 'center',
        }}>
          <Home size={32} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Sin dominios locales
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Crea tu primer dominio .claw para acceder a tus servicios por nombre
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={14} />
            Crear dominio
          </button>
        </div>
      ) : (
        <div style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 70px auto',
            padding: '8px 16px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.6875rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--text-muted)',
          }}>
            <span>Dominio</span>
            <span>IP</span>
            <span style={{ textAlign: 'center' }}>HTTPS</span>
            <span style={{ width: 60, textAlign: 'center' }}>Acciones</span>
          </div>

          {/* Rows */}
          {domains.map((domain, i) => (
            <div
              key={domain.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 70px auto',
                padding: '12px 16px',
                background: 'var(--card)',
                borderBottom: i < domains.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
              }}
            >
              <div style={{
                fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                {domain.fqdn}
              </div>
              <div style={{
                fontSize: '0.8125rem', color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono, monospace)',
              }}>
                {domain.ip}{domain.port ? `:${domain.port}` : ''}
              </div>
              <div style={{ textAlign: 'center' }}>
                {domain.proxy_host_id ? (
                  <span style={{
                    fontSize: '0.625rem', fontWeight: 600, padding: '2px 6px',
                    borderRadius: 3, background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                  }}>
                    HTTPS
                  </span>
                ) : (
                  <span style={{
                    fontSize: '0.625rem', fontWeight: 600, padding: '2px 6px',
                    borderRadius: 3, background: 'var(--surface-hover)', color: 'var(--text-muted)',
                  }}>
                    HTTP
                  </span>
                )}
              </div>
              <div style={{ width: 60, textAlign: 'center' }}>
                {confirmDelete === domain.id ? (
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button
                      onClick={() => { onRemove(domain.id); setConfirmDelete(null); }}
                      style={{
                        padding: '3px 8px', fontSize: '0.6875rem', fontWeight: 600,
                        background: '#ef4444', color: '#fff',
                        border: 'none', borderRadius: 3, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      Sí
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{
                        padding: '3px 8px', fontSize: '0.6875rem',
                        background: 'var(--surface)', color: 'var(--text-muted)',
                        border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(domain.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28,
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--text-muted)',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CA Certificate section — shown when any domain has HTTPS */}
      {domains.some(d => d.proxy_host_id) && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowCaGuide(!showCaGuide)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '12px 16px',
              background: 'rgba(34, 197, 94, 0.06)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              textAlign: 'left',
            }}
          >
            <Shield size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
                Certificado HTTPS para .claw
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Instala el certificado raíz para que tu navegador confíe en los dominios .claw
              </div>
            </div>
            <span style={{
              fontSize: '0.6875rem', color: 'var(--text-muted)',
              padding: '2px 8px', background: 'var(--surface-hover)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {showCaGuide ? 'Ocultar' : 'Ver guía'}
            </span>
          </button>

          {showCaGuide && (
            <div style={{
              marginTop: 8, padding: 20,
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              background: 'var(--card)',
            }}>
              <DnsCallout icon={Info} collapsible defaultCollapsed title="¿Por qué necesito instalar un certificado?">
                <p style={{ margin: 0 }}>
                  Para que HTTPS funcione en dominios locales, Caddy genera certificados con su propia autoridad certificadora (CA) interna.
                  Tu navegador no confía en ella por defecto, así que verás un aviso de seguridad.
                  Al instalar el certificado raíz una sola vez, tu navegador confiará en todos los dominios .claw con HTTPS.
                </p>
              </DnsCallout>

              <div style={{ margin: '16px 0' }}>
                <button
                  onClick={onDownloadCa}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 18px',
                    background: '#22c55e', color: '#fff',
                    border: 'none', borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  <Download size={16} />
                  Descargar certificado raíz (.pem)
                </button>
              </div>

              <div style={{
                fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8,
              }}>
                Instrucciones de instalación
              </div>

              <PlatformTabs platforms={['windows', 'macos', 'linux', 'ios', 'android']}>
                {(platform) => {
                  switch (platform) {
                    case 'windows':
                      return (
                        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                          <li>Haz doble clic en el archivo <code style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>micelclaw-ca.pem</code> descargado</li>
                          <li>Selecciona <strong style={{ color: 'var(--text)' }}>Instalar certificado</strong></li>
                          <li>Elige <strong style={{ color: 'var(--text)' }}>Equipo local</strong></li>
                          <li>Selecciona "Colocar todos los certificados en el siguiente almacén"</li>
                          <li>Clic en Examinar → <strong style={{ color: 'var(--text)' }}>Entidades de certificación raíz de confianza</strong></li>
                          <li>Siguiente → Finalizar</li>
                        </ol>
                      );
                    case 'macos':
                      return (
                        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                          <li>Abre <strong style={{ color: 'var(--text)' }}>Acceso a Llaveros</strong> (Keychain Access)</li>
                          <li>Arrastra <code style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>micelclaw-ca.pem</code> al llavero <strong style={{ color: 'var(--text)' }}>Sistema</strong></li>
                          <li>Haz doble clic en el certificado instalado</li>
                          <li>Expande <strong style={{ color: 'var(--text)' }}>Confianza</strong> y selecciona "Confiar siempre"</li>
                        </ol>
                      );
                    case 'linux':
                      return (
                        <div>
                          <CopyBlock code={`sudo cp micelclaw-ca.pem /usr/local/share/ca-certificates/micelclaw-ca.crt && sudo update-ca-certificates`} />
                          <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Nota: Chrome y Firefox pueden requerir importación manual desde sus ajustes de certificados.
                          </p>
                        </div>
                      );
                    case 'ios':
                      return (
                        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                          <li>Descarga el archivo desde Safari en tu iPhone/iPad</li>
                          <li>Ve a <strong style={{ color: 'var(--text)' }}>Ajustes → General → VPN y gestión de dispositivos</strong></li>
                          <li>Toca el perfil descargado → <strong style={{ color: 'var(--text)' }}>Instalar</strong></li>
                          <li>Ve a <strong style={{ color: 'var(--text)' }}>Ajustes → General → Información → Ajustes de confianza de certificados</strong></li>
                          <li>Activa la confianza total para el certificado de Micelclaw</li>
                        </ol>
                      );
                    case 'android':
                      return (
                        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                          <li>Copia el archivo al dispositivo</li>
                          <li>Ve a <strong style={{ color: 'var(--text)' }}>Ajustes → Seguridad → Cifrado y credenciales</strong></li>
                          <li>Toca <strong style={{ color: 'var(--text)' }}>Instalar desde almacenamiento</strong></li>
                          <li>Selecciona el archivo <code style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>micelclaw-ca.pem</code></li>
                          <li>Ponle un nombre descriptivo y confirma</li>
                        </ol>
                      );
                  }
                }}
              </PlatformTabs>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Setup Method Tabs ──────────────────────────────────────────────

function SetupMethodTabs({ lanIp }: { lanIp: string }) {
  const [method, setMethod] = useState<'router' | 'device'>('router');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <MethodButton
          active={method === 'router'}
          onClick={() => setMethod('router')}
          label="En el router"
          hint="Recomendado"
        />
        <MethodButton
          active={method === 'device'}
          onClick={() => setMethod('device')}
          label="Por dispositivo"
          hint="Manual"
        />
      </div>

      {method === 'router' ? (
        <RouterSetup lanIp={lanIp} />
      ) : (
        <DeviceSetup lanIp={lanIp} />
      )}
    </div>
  );
}

function MethodButton({ active, onClick, label, hint }: {
  active: boolean; onClick: () => void; label: string; hint: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 14px',
        background: active ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface)',
        border: active ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: active ? '#3b82f6' : 'var(--text)' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
        {hint}
      </div>
    </button>
  );
}

function RouterSetup({ lanIp }: { lanIp: string }) {
  return (
    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        <li>Entra en la configuración de tu router (normalmente <code style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>192.168.1.1</code>)</li>
        <li>Busca la sección <strong style={{ color: 'var(--text)' }}>DHCP</strong> o <strong style={{ color: 'var(--text)' }}>DNS</strong></li>
        <li>Cambia el <strong style={{ color: 'var(--text)' }}>DNS primario</strong> a:</li>
      </ol>
      <div style={{ margin: '8px 0 8px 20px' }}>
        <CopyBlock code={lanIp} />
      </div>
      <p style={{ margin: '8px 0 0 20px' }}>
        Todos los dispositivos de tu red usarán automáticamente los dominios <code style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>.claw</code>.
        Puede tardar unos minutos en aplicarse.
      </p>
    </div>
  );
}

function DeviceSetup({ lanIp }: { lanIp: string }) {
  return (
    <PlatformTabs platforms={['windows', 'macos', 'linux', 'ios', 'android']}>
      {(platform) => {
        switch (platform) {
          case 'windows':
            return (
              <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                <li>Abre <strong style={{ color: 'var(--text)' }}>Panel de control → Red e Internet → Centro de redes</strong></li>
                <li>Clic en tu conexión activa → <strong style={{ color: 'var(--text)' }}>Propiedades</strong></li>
                <li>Selecciona <strong style={{ color: 'var(--text)' }}>Protocolo de Internet versión 4 (TCP/IPv4)</strong> → Propiedades</li>
                <li>Selecciona "Usar las siguientes direcciones de servidor DNS"</li>
                <li>Servidor DNS preferido:</li>
                <div style={{ margin: '4px 0 4px' }}><CopyBlock code={lanIp} /></div>
                <li>Aceptar y cerrar todo</li>
              </ol>
            );
          case 'macos':
            return (
              <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                <li>Abre <strong style={{ color: 'var(--text)' }}>Ajustes del Sistema → Red</strong></li>
                <li>Selecciona tu conexión (Wi-Fi o Ethernet) → <strong style={{ color: 'var(--text)' }}>Detalles</strong></li>
                <li>Ve a la pestaña <strong style={{ color: 'var(--text)' }}>DNS</strong></li>
                <li>Pulsa <strong style={{ color: 'var(--text)' }}>+</strong> y añade:</li>
                <div style={{ margin: '4px 0 4px' }}><CopyBlock code={lanIp} /></div>
                <li>Pulsa OK y Aplicar</li>
              </ol>
            );
          case 'linux':
            return (
              <div>
                <p style={{ margin: '0 0 8px' }}>Añade el servidor DNS a tu configuración de red:</p>
                <CopyBlock label="systemd-resolved" code={`sudo resolvectl dns $(ip route show default | awk '{print $5}') ${lanIp}`} />
                <div style={{ marginTop: 10 }}>
                  <CopyBlock label="O edita /etc/resolv.conf" code={`echo "nameserver ${lanIp}" | sudo tee /etc/resolv.conf`} />
                </div>
              </div>
            );
          case 'ios':
            return (
              <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                <li>Abre <strong style={{ color: 'var(--text)' }}>Ajustes → Wi-Fi</strong></li>
                <li>Pulsa la <strong style={{ color: 'var(--text)' }}>ⓘ</strong> junto a tu red</li>
                <li>Baja hasta <strong style={{ color: 'var(--text)' }}>Configurar DNS → Manual</strong></li>
                <li>Elimina los servidores existentes y añade:</li>
                <div style={{ margin: '4px 0 4px' }}><CopyBlock code={lanIp} /></div>
                <li>Pulsa Guardar</li>
              </ol>
            );
          case 'android':
            return (
              <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                <li>Abre <strong style={{ color: 'var(--text)' }}>Ajustes → Red e Internet → Wi-Fi</strong></li>
                <li>Mantén pulsada tu red → <strong style={{ color: 'var(--text)' }}>Modificar red</strong></li>
                <li>Opciones avanzadas → <strong style={{ color: 'var(--text)' }}>Configuración IP: Estática</strong></li>
                <li>En DNS 1, introduce:</li>
                <div style={{ margin: '4px 0 4px' }}><CopyBlock code={lanIp} /></div>
                <li>Guardar</li>
              </ol>
            );
        }
      }}
    </PlatformTabs>
  );
}
