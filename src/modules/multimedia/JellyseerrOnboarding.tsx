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
import {
  X, ChevronLeft, ChevronRight,
  Server, LogIn, Library, Settings,
} from 'lucide-react';

interface JellyseerrOnboardingProps {
  open: boolean;
  onClose: () => void;
}

const descStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
  margin: '0 0 6px',
};

const listStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-muted)',
  lineHeight: 1.6,
  margin: '2px 0 6px',
  paddingLeft: 16,
};

const fieldGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  marginBottom: 8,
  padding: '6px 8px',
  background: 'var(--bg)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
};

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        padding: '3px 6px',
        background: '#06060a',
        borderRadius: 3,
        color: 'var(--amber)',
        userSelect: 'all',
      }}>
        {value}
        {hint && <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginLeft: 4 }}>({hint})</span>}
      </div>
    </div>
  );
}

const STEPS = [
  {
    number: 1,
    icon: <Server size={14} />,
    title: 'Tipo de Servidor',
    content: (
      <>
        <p style={descStyle}>
          Selecciona <strong>Jellyfin</strong> como tipo de servidor.
          Es el servidor multimedia que tienes instalado en tu sistema.
        </p>
        <p style={descStyle}>Haz clic en el logo de Jellyfin para continuar.</p>
      </>
    ),
  },
  {
    number: 2,
    icon: <LogIn size={14} />,
    title: 'Iniciar Sesion',
    content: (
      <>
        <p style={{ ...descStyle, color: 'var(--amber)' }}>
          Asegurate de que Jellyfin esta activo antes de continuar.
        </p>
        <p style={descStyle}>Introduce los datos de conexion a Jellyfin:</p>
        <div style={fieldGroupStyle}>
          <Field label="Jellyfin URL" value="claw-jellyfin" />
          <Field label="Puerto" value="8096" />
          <Field label="URL Base" value="(dejar vacio)" />
          <Field label="Email Address" value="(tu email, el que quieras)" />
          <Field label="Username" value="servarr" hint="usuario de Jellyfin" />
          <Field label="Password" value="12345" />
        </div>
        <p style={descStyle}>Deja "Use SSL" desactivado. Pulsa <strong>Sign In</strong>.</p>
      </>
    ),
  },
  {
    number: 3,
    icon: <Library size={14} />,
    title: 'Servidor Multimedia',
    content: (
      <>
        <p style={descStyle}>
          Selecciona las bibliotecas que quieres sincronizar con Jellyseerr:
        </p>
        <ul style={listStyle}>
          <li><strong>Peliculas</strong> — para peticiones de peliculas</li>
          <li><strong>Series</strong> — para peticiones de series</li>
        </ul>
        <p style={descStyle}>
          Pulsa <strong>Sync Libraries</strong> y espera a que termine.
          Luego pulsa <strong>Continue</strong>.
        </p>
      </>
    ),
  },
  {
    number: 4,
    icon: <Settings size={14} />,
    title: 'Configurar Servicios',
    content: (
      <>
        <p style={{ ...descStyle, color: 'var(--amber)' }}>
          Asegurate de que Radarr y Sonarr estan activos antes de continuar.
        </p>
        <p style={descStyle}>
          Pulsa <strong>+ Add Radarr Server</strong> e introduce:
        </p>
        <div style={fieldGroupStyle}>
          <Field label="Default Server" value="activado" />
          <Field label="Server Name" value="Radarr" />
          <Field label="Hostname or IP" value="claw-radarr" />
          <Field label="Port" value="7878" />
          <Field label="API Key" value="1d61997ecf5342f283df61d53142a816" />
          <Field label="Quality Profile" value="Any" />
          <Field label="Root Folder" value="/data/peliculas" />
        </div>
        <p style={descStyle}>
          Pulsa <strong>Test</strong> para verificar. Si sale OK, dale a <strong>Add Server</strong>.
        </p>
        <p style={descStyle}>
          Repite con <strong>+ Add Sonarr Server</strong>:
        </p>
        <div style={fieldGroupStyle}>
          <Field label="Default Server" value="activado" />
          <Field label="Server Name" value="Sonarr" />
          <Field label="Hostname or IP" value="claw-sonarr" />
          <Field label="Port" value="8989" />
          <Field label="API Key" value="784d27f8c1c34c15bbc438ce6e37ce48" />
          <Field label="Quality Profile" value="Any" />
          <Field label="Root Folder" value="/data/series" />
        </div>
        <p style={descStyle}>
          Pulsa <strong>Test</strong>, luego <strong>Add Server</strong>.
          Cuando ambos aparezcan, pulsa <strong>Finish Setup</strong>.
        </p>
      </>
    ),
  },
];

export function JellyseerrOnboarding({ open, onClose }: JellyseerrOnboardingProps) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = STEPS[step]!;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      position: 'absolute',
      top: 48,
      left: 16,
      zIndex: 10,
      width: 320,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          Configuracion de Jellyseerr
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', padding: 2,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Step indicators */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        {STEPS.map((s, i) => (
          <div key={s.number} style={{
            flex: 1, height: 3,
            borderRadius: 2,
            background: i <= step ? 'var(--amber)' : 'var(--border)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '14px 12px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={badgeStyle}>{current.number}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', flexShrink: 0 }}>
            {current.icon}
          </span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
            {current.title}
          </span>
        </div>
        {current.content}
      </div>

      {/* Footer nav */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={isFirst}
          style={navBtnStyle(isFirst)}
        >
          <ChevronLeft size={13} />
          Anterior
        </button>
        {isLast ? (
          <button onClick={onClose} style={navBtnStyle(false, true)}>
            Cerrar
          </button>
        ) : (
          <button
            onClick={() => setStep((s) => s + 1)}
            style={navBtnStyle(false)}
          >
            Siguiente
            <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: 'var(--amber)',
  color: '#06060a',
  fontSize: '0.6875rem',
  fontWeight: 700,
  flexShrink: 0,
};

function navBtnStyle(disabled: boolean, accent = false): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    fontSize: '0.6875rem',
    fontWeight: 500,
    border: accent ? 'none' : '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: accent ? 'var(--amber)' : 'var(--bg)',
    color: accent ? '#06060a' : disabled ? 'var(--text-muted)' : 'var(--text)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  };
}
