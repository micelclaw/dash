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

import { useState, useEffect } from 'react';
import { Globe, Shield, Cloud, Wifi, WifiOff, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import type { AddZoneInput } from '../hooks/use-dns-zones';
import type { DnsProviderAccount } from '../hooks/use-dns-providers';
import { InfoTooltip } from '../components/InfoTooltip';

interface AddZoneWizardProps {
  providers: DnsProviderAccount[];
  onAdd: (input: AddZoneInput) => Promise<void>;
  onGetPublicIp: () => Promise<string | null>;
  onCheckPort53: () => Promise<{ accessible: boolean; udp: boolean; tcp: boolean; recommendation: string | null } | null>;
}

export function AddZoneWizard({ providers, onAdd, onGetPublicIp, onCheckPort53 }: AddZoneWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [domain, setDomain] = useState('');
  const [mode, setMode] = useState<'authoritative' | 'proxy'>('proxy');
  const [providerId, setProviderId] = useState<string>(providers[0]?.id ?? '');
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [port53, setPort53] = useState<{ accessible: boolean; recommendation: string | null } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [adding, setAdding] = useState(false);

  const isValidDomain = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain);

  const runDetection = async () => {
    setDetecting(true);
    const [ip, p53] = await Promise.all([onGetPublicIp(), onCheckPort53()]);
    setPublicIp(ip);
    setPort53(p53);
    setDetecting(false);
  };

  useEffect(() => {
    if (step === 2) runDetection();
  }, [step]);

  const handleSubmit = async () => {
    if (!isValidDomain) return;
    setAdding(true);
    await onAdd({
      zone: domain,
      mode,
      ...(mode === 'proxy' && providerId ? { provider_account_id: providerId } : {}),
    });
    setAdding(false);
  };

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: 24,
    }}>
      <h2 style={{
        fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
        margin: '0 0 20px', fontFamily: 'var(--font-sans)',
      }}>
        Añadir zona DNS
      </h2>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1, 2].map(s => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: s <= step ? '#3b82f6' : 'var(--border)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      {step === 1 ? (
        <>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 16px' }}>
            Escribe el dominio que quieres gestionar. Debe ser un dominio que ya hayas comprado
            en un registrador (Cloudflare, Porkbun, Namecheap, etc.).
          </p>

          {/* Domain input */}
          <FieldGroup label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Dominio <InfoTooltip>El dominio completo sin www. Ejemplo: miempresa.com, blog.ejemplo.org</InfoTooltip></span>}>
            <input
              type="text"
              placeholder="ejemplo.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
              style={inputStyle}
            />
            {domain && !isValidDomain && (
              <p style={{ fontSize: '0.6875rem', color: '#f43f5e', margin: '4px 0 0' }}>
                Introduce un nombre de dominio válido (ej. ejemplo.com)
              </p>
            )}
          </FieldGroup>

          <button
            onClick={() => setStep(2)}
            disabled={!isValidDomain}
            style={{
              width: '100%', marginTop: 20,
              padding: '10px 20px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: !isValidDomain ? 'not-allowed' : 'pointer',
              opacity: !isValidDomain ? 0.5 : 1,
            }}
          >
            Siguiente
          </button>
        </>
      ) : (
        <>
          {/* Detection results */}
          <div style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            padding: 16, marginBottom: 20,
          }}>
            <div style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>
              Detección de tu red
            </div>
            {detecting ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Detectando...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wifi size={14} style={{ color: publicIp ? '#22c55e' : 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-dim)' }}>IP pública:</span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text)' }}>
                    {publicIp ?? 'No detectada'}
                  </span>
                </div>
                {!publicIp && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    fontSize: '0.75rem', color: '#f59e0b', lineHeight: 1.5,
                  }}>
                    No se pudo detectar tu IP pública. Asegúrate de que tu servidor tiene acceso a internet.
                    Esto no impide añadir la zona, pero algunas funciones podrían no funcionar correctamente.
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {port53?.accessible
                    ? <CheckCircle size={14} style={{ color: '#22c55e' }} />
                    : <WifiOff size={14} style={{ color: '#f59e0b' }} />}
                  <span style={{ color: 'var(--text-dim)' }}>Puerto 53:</span>
                  <span style={{ color: port53?.accessible ? '#22c55e' : '#f59e0b' }}>
                    {port53?.accessible ? 'Accesible' : 'No accesible'}
                  </span>
                </div>
                {port53 && !port53.accessible && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    fontSize: '0.75rem', color: '#f59e0b', lineHeight: 1.5,
                  }}>
                    {port53.recommendation ?? 'El puerto 53 (DNS) no está abierto. Esto es normal si estás detrás de un router doméstico. Solo necesitas este puerto si quieres ser tu propio servidor DNS (modo autoritativo).'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mode selection */}
          <FieldGroup label="¿Cómo quieres gestionar este dominio?">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ModeOption
                icon={Cloud}
                label="Proxy (recomendado)"
                description="Los registros DNS se gestionan a través de tu proveedor (Cloudflare, Porkbun...). Es la opción recomendada para la mayoría de usuarios."
                selected={mode === 'proxy'}
                onClick={() => setMode('proxy')}
                color="#f59e0b"
              />
              <ModeOption
                icon={Shield}
                label="Autoritativo"
                description="Tu servidor actúa como servidor DNS propio usando PowerDNS. Solo para usuarios avanzados."
                selected={mode === 'authoritative'}
                onClick={() => setMode('authoritative')}
                color="#3b82f6"
                warning={port53 && !port53.accessible ? 'El puerto 53 no está accesible — el modo autoritativo podría no funcionar.' : undefined}
              />
            </div>
          </FieldGroup>

          {/* Provider selection (proxy mode) */}
          {mode === 'proxy' && (
            <div style={{ marginTop: 16 }}>
              <FieldGroup label="Cuenta de proveedor">
                {providers.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: '#f59e0b', margin: 0, lineHeight: 1.5 }}>
                    No tienes ningún proveedor conectado. Ve a la pestaña Proveedores para conectar tu cuenta de Cloudflare, Porkbun, etc.
                  </p>
                ) : (
                  <select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.label} ({p.provider})</option>
                    ))}
                  </select>
                )}
              </FieldGroup>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={() => setStep(1)} style={cancelBtn}>Atrás</button>
            <button
              onClick={handleSubmit}
              disabled={adding || (mode === 'proxy' && !providerId)}
              style={{
                flex: 1, padding: '10px 20px',
                background: '#3b82f6', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
                cursor: (adding || (mode === 'proxy' && !providerId)) ? 'not-allowed' : 'pointer',
                opacity: (adding || (mode === 'proxy' && !providerId)) ? 0.5 : 1,
              }}
            >
              {adding ? 'Añadiendo...' : `Añadir zona (${mode === 'proxy' ? 'proxy' : 'autoritativo'})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function ModeOption({ icon: Icon, label, description, selected, onClick, color, warning }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  color: string;
  warning?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px', textAlign: 'left',
        border: `1px solid ${selected ? color + '66' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        background: selected ? color + '08' : 'transparent',
        cursor: 'pointer', transition: 'all var(--transition-fast)',
        width: '100%',
      }}
    >
      <Icon size={18} style={{ color, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{description}</div>
        {warning && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 6, fontSize: '0.6875rem', color: '#f59e0b',
          }}>
            <AlertTriangle size={11} />
            {warning}
          </div>
        )}
      </div>
    </button>
  );
}

function FieldGroup({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: '0.625rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'var(--text-muted)', marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text)', fontSize: '0.9375rem',
  fontFamily: 'var(--font-mono, monospace)', outline: 'none',
};

const cancelBtn: React.CSSProperties = {
  padding: '10px 20px', background: 'transparent',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)', fontSize: '0.875rem',
  fontFamily: 'var(--font-sans)', cursor: 'pointer',
};
