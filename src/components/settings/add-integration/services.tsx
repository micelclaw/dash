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

import { Mail, Calendar, Users } from 'lucide-react';

// ─── Service definitions ─────────────────────────────────

export type FlowType = 'oauth' | 'imap' | 'caldav' | 'carddav' | 'bot_token';

export interface ServiceDef {
  id: string;
  category: 'Email' | 'Calendar' | 'Contacts' | 'Messaging';
  name: string;
  icon: string;
  color: string;
  flow: FlowType;
  provider?: string;
  scopes?: string;
  preset?: Record<string, any>;
}

export const SERVICES: ServiceDef[] = [
  // Email
  { id: 'gmail', category: 'Email', name: 'Gmail', icon: 'google', color: '#4285f4',
    flow: 'oauth', provider: 'google', scopes: 'https://mail.google.com/' },
  { id: 'synology-mail', category: 'Email', name: 'Synology Mail', icon: 'synology', color: '#e87e04',
    flow: 'imap', preset: { imap_port: 993, smtp_port: 587, imap_encryption: 'ssl', smtp_encryption: 'tls' } },
  { id: 'imap', category: 'Email', name: 'IMAP', icon: 'mail', color: 'var(--text-dim)',
    flow: 'imap' },

  // Calendar
  { id: 'google-calendar', category: 'Calendar', name: 'Google Calendar', icon: 'google', color: '#4285f4',
    flow: 'oauth', provider: 'google', scopes: 'https://www.googleapis.com/auth/calendar' },
  { id: 'synology-calendar', category: 'Calendar', name: 'Synology Calendar', icon: 'synology', color: '#e87e04',
    flow: 'caldav', preset: { path_hint: '/caldav/' } },
  { id: 'caldav', category: 'Calendar', name: 'CalDAV', icon: 'calendar', color: 'var(--text-dim)',
    flow: 'caldav' },

  // Contacts
  { id: 'google-contacts', category: 'Contacts', name: 'Google Contacts', icon: 'google', color: '#4285f4',
    flow: 'oauth', provider: 'google', scopes: 'https://www.googleapis.com/auth/contacts.readonly' },
  { id: 'synology-contacts', category: 'Contacts', name: 'Synology Contacts', icon: 'synology', color: '#e87e04',
    flow: 'carddav', preset: { path_hint: '/carddav/' } },
  { id: 'carddav', category: 'Contacts', name: 'CardDAV', icon: 'contacts', color: 'var(--text-dim)',
    flow: 'carddav' },

  // Messaging
  { id: 'slack-observer', category: 'Messaging', name: 'Slack', icon: 'slack', color: '#4A154B',
    flow: 'oauth', provider: 'slack',
    // Scopes DERIVADOS de las APIs que se usan de verdad (auditoría P0 2026-07-27),
    // no copiados de un ejemplo. `conversations.list` pide types
    // `public_channel,private_channel,mpim,im` (slack-observer.ts) y Slack exige el
    // scope :read de CADA tipo o falla la llamada entera; `conversations.history`
    // pide el :history de cada uno; y `chat.postMessage` (sendSlack) exige chat:write.
    // Faltaban groups:read, im:read, mpim:read, mpim:history y chat:write → el canal
    // habría fallado en el discovery (P2) y en el envío (P4) tras conectar bien.
    scopes: [
      'channels:read', 'groups:read', 'im:read', 'mpim:read',            // conversations.list
      'channels:history', 'groups:history', 'im:history', 'mpim:history', // conversations.history
      'chat:write',                                                       // chat.postMessage
      'users:read',                                                       // nombres de remitente
    ].join(','),
  },
  { id: 'discord-observer', category: 'Messaging', name: 'Discord', icon: 'discord', color: '#5865F2',
    flow: 'bot_token' },
  // Telegram = TU CUENTA REAL (tus chats y grupos con gente real), vía el hub
  // Matrix + mautrix-telegram. Una sola entrada: el bot (identidad separada que
  // solo veía lo que la involucraba) se retiró — mautrix ya cubre los grupos.
  { id: 'telegram-matrix', category: 'Messaging', name: 'Telegram', icon: 'telegram', color: '#0088cc',
    flow: 'bot_token' },
  // WhatsApp = TU CUENTA REAL (dispositivo vinculado) vía el hub Matrix +
  // mautrix-whatsapp. Sin credenciales: código de emparejamiento o QR.
  { id: 'whatsapp-matrix', category: 'Messaging', name: 'WhatsApp', icon: 'whatsapp', color: '#25D366',
    flow: 'bot_token' },
  { id: 'teams-observer', category: 'Messaging', name: 'Teams', icon: 'teams', color: '#6264a7',
    flow: 'oauth', provider: 'microsoft', scopes: 'Chat.Read,ChannelMessage.Read.All' },
  { id: 'signal-observer', category: 'Messaging', name: 'Signal', icon: 'signal', color: '#3a76f0',
    flow: 'bot_token' },
  { id: 'simplex-observer', category: 'Messaging', name: 'SimpleX · identidad propia', icon: 'simplex', color: '#3DB548',
    flow: 'bot_token' },
  // SimpleX · tu móvil (XRCP) = identidad del teléfono (chats REALES). Wizard
  // propio; el connector es `simplex-remote-observer` (distinto del perfil dedicado).
  { id: 'simplex-xrcp', category: 'Messaging', name: 'SimpleX · tu móvil', icon: 'simplex', color: '#3DB548',
    flow: 'bot_token' },
  { id: 'session-observer', category: 'Messaging', name: 'Session · identidad propia', icon: 'session', color: '#00F782',
    flow: 'bot_token' },
  { id: 'session-link-observer', category: 'Messaging', name: 'Session · tu móvil', icon: 'session', color: '#00F782',
    flow: 'bot_token' },
];

export const CATEGORIES = ['Email', 'Calendar', 'Contacts'] as const;

export const CATEGORY_ICONS: Record<string, typeof Mail> = {
  Email: Mail,
  Calendar: Calendar,
  Contacts: Users,
};

// ─── Service Icon (SVG inline) ───────────────────────────

export function ServiceIcon({ type, size = 24 }: { type: string; size?: number }) {
  switch (type) {
    case 'google':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      );
    case 'synology':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="#e87e04" strokeWidth="2"/>
          <text x="12" y="16" textAnchor="middle" fill="#e87e04" fontSize="10" fontWeight="bold">S</text>
        </svg>
      );
    case 'mail':
      return <Mail size={size} style={{ color: 'var(--text-dim)' }} />;
    case 'calendar':
      return <Calendar size={size} style={{ color: 'var(--text-dim)' }} />;
    case 'contacts':
      return <Users size={size} style={{ color: 'var(--text-dim)' }} />;
    case 'slack':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313z" fill="#E01E5A"/>
          <path d="M8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312z" fill="#36C5F0"/>
          <path d="M18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312z" fill="#2EB67D"/>
          <path d="M15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" fill="#ECB22E"/>
        </svg>
      );
    case 'discord':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#5865F2">
          <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      );
    case 'telegram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#0088cc"/>
          <path d="M5.4 11.6l10.1-4.3c.5-.2.9.1.7.7L14.5 16c-.2.5-.6.6-1 .4l-2.8-2.1-1.3 1.3c-.1.1-.3.2-.5.2l.2-2.8 5.1-4.6c.2-.2 0-.3-.3-.1L7.6 13.2l-2.7-.8c-.6-.2-.6-.6.1-.8z" fill="white"/>
        </svg>
      );
    case 'teams':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="1" y="4" width="14" height="16" rx="2" fill="#6264a7"/>
          <text x="8" y="15" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">T</text>
          <circle cx="19" cy="7" r="3.5" fill="#6264a7"/>
          <rect x="15.5" y="11" width="7" height="7" rx="1.5" fill="#6264a7" opacity="0.8"/>
        </svg>
      );
    case 'signal':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#3a76f0"/>
          <path d="M12 6.5c-3.04 0-5.5 2.46-5.5 5.5 0 .97.25 1.88.7 2.67L6.5 17.5l2.83-.7c.79.45 1.7.7 2.67.7 3.04 0 5.5-2.46 5.5-5.5S15.04 6.5 12 6.5z" fill="white"/>
        </svg>
      );
    case 'simplex':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#3DB548"/>
          <path d="M7 8.5L12 6l5 2.5v3L12 14 7 11.5v-3z" fill="white" opacity="0.9"/>
          <path d="M7 12.5L12 15l5-2.5v3L12 18l-5-2.5v-3z" fill="white" opacity="0.7"/>
        </svg>
      );
    case 'session':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#00F782"/>
          <circle cx="9" cy="10" r="2.5" fill="#000" opacity="0.8"/>
          <circle cx="15" cy="10" r="2.5" fill="#000" opacity="0.8"/>
          <path d="M8 15c0 0 1.5 2 4 2s4-2 4-2" stroke="#000" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
        </svg>
      );
    default:
      return <Mail size={size} style={{ color: 'var(--text-dim)' }} />;
  }
}
