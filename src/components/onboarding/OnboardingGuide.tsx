/**
 * Copyright (c) 2026 Micelclaw (Victor Garcia Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import {
  ExternalLink, Terminal, Shield, Zap, Cpu, Key,
  MessageCircle, Search, Package, Settings, Lock,
  CheckCircle, Bot,
} from 'lucide-react';

interface OnboardingGuideProps {
  open: boolean;
}

export function OnboardingGuide({ open }: OnboardingGuideProps) {
  if (!open) return null;

  return (
    <div style={{
      width: 340,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          Configuracion de OpenClaw
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        <p style={introStyle}>
          Sigue estos pasos en la terminal de la izquierda para configurar tu asistente IA.
        </p>

        <Step
          number={1}
          icon={<Terminal size={14} />}
          title="Ejecuta el wizard"
          command="openclaw onboard --install-daemon"
          description="Inicia el asistente de configuracion interactivo. La flag --install-daemon registra el servicio systemd automaticamente al final."
        />

        <Step
          number={2}
          icon={<Shield size={14} />}
          title="Aviso de seguridad"
          description='Lee el aviso de seguridad y escribe "accept" para continuar.'
        />

        <Step
          number={3}
          icon={<Zap size={14} />}
          title="Modo de configuracion"
          description="Selecciona QuickStart (recomendado). Configura lo esencial: proveedor, modelo, canal y skills."
        />

        <Step
          number={4}
          icon={<Cpu size={14} />}
          title="Proveedor de modelos"
        >
          <p style={descStyle}>Elige tu proveedor de IA:</p>
          <ul style={listStyle}>
            <li><strong>Anthropic</strong> — recomendado (Claude Sonnet 4.6)</li>
            <li><strong>DeepSeek</strong> — alternativa economica</li>
            <li>OpenAI, Google Gemini, Ollama (local)...</li>
          </ul>
          <p style={descStyle}>Introduce la API key del proveedor elegido. Se almacena localmente en ~/.openclaw/</p>
        </Step>

        <Step
          number={5}
          icon={<Key size={14} />}
          title="Modelo por defecto"
        >
          <p style={descStyle}>Elige el modelo principal para el agente:</p>
          <ul style={listStyle}>
            <li><strong>claude-sonnet-4-6</strong> — mejor calidad (recomendado)</li>
            <li><strong>deepseek-chat</strong> — mas barato</li>
          </ul>
        </Step>

        <Step
          number={6}
          icon={<MessageCircle size={14} />}
          title="Canal de comunicacion"
        >
          <p style={descStyle}>Selecciona <strong>Telegram</strong> (recomendado). Para crear el bot:</p>
          <ol style={{ ...listStyle, listStyleType: 'decimal' }}>
            <li>Abre Telegram y busca <strong>@BotFather</strong></li>
            <li>Envia <code style={codeInline}>/newbot</code></li>
            <li>Ponle un nombre (ej: "Francis")</li>
            <li>Ponle un username (ej: "micelclaw_francis_bot")</li>
            <li>Copia el token que te da BotFather</li>
            <li>Pegalo en el wizard</li>
          </ol>
        </Step>

        <Step
          number={7}
          icon={<Search size={14} />}
          title="Proveedor de busqueda"
        >
          <p style={descStyle}>
            Recomendado: <strong>Skip</strong> por ahora. Tavily es de pago.
            Proximamente habra una opcion gratuita integrada.
          </p>
        </Step>

        <Step
          number={8}
          icon={<Package size={14} />}
          title="Skills"
        >
          <p style={descStyle}>Selecciona las skills a instalar:</p>
          <ul style={listStyle}>
            <li><strong>ClawHub</strong> — obligatorio (skills oficiales de Micelclaw)</li>
            <li><strong>MCporter</strong> — solo si tienes Home Assistant</li>
          </ul>
        </Step>

        <Step
          number={9}
          icon={<Settings size={14} />}
          title="Node manager"
          description="Selecciona pnpm (recomendado). Es el gestor de paquetes que usa Micelclaw."
        />

        <Step
          number={10}
          icon={<CheckCircle size={14} />}
          title="Hooks"
          description="Activa todos los hooks disponibles: boot-md, bootstrap-extra-files, command-logger y session-memory. Todos son utiles."
        />

        <Step
          number={11}
          icon={<Lock size={14} />}
          title="Contrasena sudo"
          description="Introduce la contrasena de administrador del sistema. Se necesita para instalar el daemon (servicio systemd) que mantiene al agente activo."
        />

        {/* Post-onboarding note */}
        <div style={{
          marginTop: 8,
          padding: '10px 12px',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Bot size={14} style={{ color: 'var(--amber)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>
              Despues del wizard
            </span>
          </div>
          <p style={{ ...descStyle, margin: 0 }}>
            Ve a Telegram y habla con tu bot para configurar su personalidad.
            Tambien puedes hacerlo desde el Chat de Micelclaw.
          </p>
        </div>

        <div style={{
          marginTop: 12,
          padding: '10px 12px',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
        }}>
          <a
            href="https://docs.openclaw.ai/start/wizard"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--amber)',
              fontSize: '0.75rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={12} />
            Guia completa en docs.openclaw.ai
          </a>
        </div>

        <p style={{
          ...introStyle,
          marginTop: 14,
          color: 'var(--text-muted)',
          fontSize: '0.6875rem',
        }}>
          Una vez completado, recarga la pagina. El banner rojo desaparecera automaticamente.
        </p>
      </div>
    </div>
  );
}

function Step({ number, icon, title, command, description, children }: {
  number: number;
  icon: React.ReactNode;
  title: string;
  command?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      marginBottom: 12,
      padding: '10px 12px',
      background: 'var(--bg)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
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
        }}>
          {number}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
          {title}
        </span>
      </div>
      {command && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          padding: '5px 8px',
          background: '#06060a',
          borderRadius: 3,
          color: 'var(--amber)',
          marginBottom: 6,
          userSelect: 'all',
        }}>
          $ {command}
        </div>
      )}
      {description && (
        <p style={descStyle}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

const introStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text)',
  lineHeight: 1.5,
  margin: '0 0 14px',
};

const descStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
  margin: '0 0 4px',
};

const listStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-muted)',
  lineHeight: 1.6,
  margin: '2px 0 6px',
  paddingLeft: 16,
};

const codeInline: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6875rem',
  padding: '1px 4px',
  background: '#06060a',
  borderRadius: 2,
  color: 'var(--amber)',
};
