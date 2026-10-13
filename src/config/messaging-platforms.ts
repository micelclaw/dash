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

/**
 * Single source of truth for messaging-platform branding + name mapping.
 *
 * The stuff that DOESN'T come from the backend (label, brand color, monogram,
 * connector_type ↔ platform mapping) lives here. Live capability (can_send,
 * connector status, pairing) comes from `GET /messages/capabilities` via the
 * `platform-capabilities` store. Together they replace the old hardcoded
 * `PLATFORMS` table in `modules/messages/types.ts` and the five other places
 * that redefined labels/colors/icons.
 */

export type PairingKind = 'qr' | 'code' | 'token' | 'oauth' | 'webhook' | 'cookies' | 'none';
export type MessagingTransport = 'native' | 'gateway' | 'matrix-bridge' | 'none';

export interface MessagingPlatformDef {
  /** `messages.platform` key — the canonical id. */
  platform: string;
  label: string;
  /** Brand color (hex). Used for pills, icon badges, accents. */
  color: string;
  /** 1–3 char monogram — fallback textual (aria/labels), no el icono. */
  short: string;
  /**
   * TRANSPORTE interno, no un canal que el usuario elija → no se lista como
   * fila propia en Channel Observers. Matrix es la tubería del hub que lleva
   * Telegram/Messenger/Google Messages: enseñar una fila "Matrix" que abre un
   * wizard de Telegram es incoherente. Cuando exista Matrix-directo (chats
   * Matrix nativos con su propio wizard), se le quita este flag.
   */
  internalTransport?: boolean;
  /** Backend connector_type; gateway/matrix share `gateway-observer`. */
  connectorType: string | null;
  /** OpenClaw Gateway channel name (gateway/matrix transports only). */
  channelType?: string;
  transport: MessagingTransport;
  /** Fallback pairing shape if `/capabilities` is unavailable. */
  defaultPairingKind: PairingKind;
  cliService?: 'signal-cli' | 'simplex-chat' | 'simplex-xrcp' | 'session-sidecar';
}

export const MESSAGING_PLATFORMS: MessagingPlatformDef[] = [
  { platform: 'signal', label: 'Signal', color: '#3A76F0', short: 'Si', connectorType: 'signal-observer', transport: 'native', defaultPairingKind: 'qr', cliService: 'signal-cli' },
  { platform: 'simplex', label: 'SimpleX · identidad propia', color: '#0053D6', short: 'Sx', connectorType: 'simplex-observer', transport: 'native', defaultPairingKind: 'none', cliService: 'simplex-chat' },
  // "SimpleX · tu móvil (XRCP)": usa la identidad del teléfono (chats REALES). Es
  // OTRA plataforma/connector que el perfil dedicado de arriba → dos tarjetas.
  { platform: 'simplex_xrcp', label: 'SimpleX · tu móvil', color: '#0053D6', short: 'Sx', connectorType: 'simplex-remote-observer', transport: 'native', defaultPairingKind: 'qr', cliService: 'simplex-xrcp' },
  { platform: 'session', label: 'Session · identidad propia', color: '#00F782', short: 'Se', connectorType: 'session-observer', transport: 'native', defaultPairingKind: 'token', cliService: 'session-sidecar' },
  { platform: 'session_link', label: 'Session · tu móvil', color: '#00F782', short: 'Se', connectorType: 'session-link-observer', transport: 'native', defaultPairingKind: 'token', cliService: 'session-sidecar' },
  // Telegram = TU CUENTA REAL (tus chats y grupos con gente real) vía el hub
  // Matrix + mautrix-telegram. NO hay fila de "bot": era una identidad aparte
  // que solo veía lo que la mencionaba, y mautrix ya cubre los grupos.
  { platform: 'telegram', label: 'Telegram', color: '#0088CC', short: 'Tg', connectorType: 'gateway-observer', channelType: 'matrix', transport: 'matrix-bridge', defaultPairingKind: 'code' },
  { platform: 'discord', label: 'Discord', color: '#5865F2', short: 'Dc', connectorType: 'discord-observer', transport: 'native', defaultPairingKind: 'token' },
  { platform: 'slack', label: 'Slack', color: '#4A154B', short: 'Sl', connectorType: 'slack-observer', transport: 'native', defaultPairingKind: 'oauth' },
  { platform: 'teams', label: 'Teams', color: '#6264A7', short: 'Tm', connectorType: 'teams-observer', transport: 'native', defaultPairingKind: 'oauth' },
  { platform: 'viber', label: 'Viber', color: '#7360F2', short: 'Vb', connectorType: 'viber-observer', transport: 'native', defaultPairingKind: 'token' },
  // WhatsApp = TU CUENTA REAL vía el hub Matrix (mautrix-whatsapp, flip
  // 2026-07-17 — el canal whatsapp del Gateway quedó descartado por A.0).
  { platform: 'whatsapp', label: 'WhatsApp', color: '#25D366', short: 'Wa', connectorType: 'gateway-observer', channelType: 'matrix', transport: 'matrix-bridge', defaultPairingKind: 'code' },
  { platform: 'wechat', label: 'WeChat', color: '#07C160', short: 'Wc', connectorType: null, transport: 'none', defaultPairingKind: 'none' },
  { platform: 'line', label: 'LINE', color: '#06C755', short: 'Ln', connectorType: null, transport: 'none', defaultPairingKind: 'none' },
  { platform: 'googlechat', label: 'Google Chat', color: '#1A73E8', short: 'GC', connectorType: 'gateway-observer', channelType: 'matrix', transport: 'matrix-bridge', defaultPairingKind: 'cookies' },
  { platform: 'qq', label: 'QQ', color: '#12B7F5', short: 'QQ', connectorType: 'gateway-observer', channelType: 'matrix', transport: 'matrix-bridge', defaultPairingKind: 'qr' },
  { platform: 'irc', label: 'IRC', color: '#7A7A7A', short: 'IRC', connectorType: 'gateway-observer', channelType: 'matrix', transport: 'matrix-bridge', defaultPairingKind: 'token' },
  { platform: 'matrix', label: 'Matrix', color: '#0DBD8B', short: 'Mx', connectorType: 'gateway-observer', channelType: 'matrix', transport: 'matrix-bridge', defaultPairingKind: 'token', internalTransport: true },
  // `connectorType: null` mientras su bridge no exista (espejo del backend): los
  // 3 bridges del hub comparten UN connector, así que declarar `gateway-observer`
  // les hacía matchear el de Telegram → la fila salía "Connected" y con el nombre
  // "Telegram". Sin connector → "Coming soon", que es la verdad.
  { platform: 'fb_messenger', label: 'Messenger', color: '#0084FF', short: 'Ms', connectorType: 'gateway-observer', channelType: 'matrix', transport: 'matrix-bridge', defaultPairingKind: 'cookies' },
  { platform: 'google_messages', label: 'Google Messages', color: '#1B72E8', short: 'GM', connectorType: 'gateway-observer', channelType: 'matrix', transport: 'matrix-bridge', defaultPairingKind: 'qr' },
  { platform: 'threema', label: 'Threema', color: '#3F4550', short: 'Th', connectorType: null, transport: 'none', defaultPairingKind: 'none' },
  { platform: 'kakaotalk', label: 'KakaoTalk', color: '#3C1E1E', short: 'Kk', connectorType: null, transport: 'none', defaultPairingKind: 'none' },
];

/**
 * Account model — sets correct expectations in the UI.
 * - `account`: the client is a device/login of YOUR account → you see your real
 *   conversations with third parties (like the chat with María in Signal).
 * - `bot`: a separate identity → you only see DMs sent to the bot + groups the
 *   bot is in, NOT your real 1:1 chats.
 * - `none`: no viable path.
 * (Telegram is `bot` today; it flips to `account` once it moves to the Matrix
 * bridge / mautrix-telegram.)
 */
export type AccountModel = 'account' | 'bot' | 'none';

const ACCOUNT_MODEL: Record<string, AccountModel> = {
  // `telegram` es 'account' (no 'bot') desde que la fila ES tu cuenta real vía
  // mautrix-telegram: ves tus chats y grupos con gente real, no lo que menciona
  // a un bot.
  signal: 'account', simplex: 'account', simplex_xrcp: 'account', session: 'account', session_link: 'account', irc: 'account', telegram: 'account',
  whatsapp: 'account', wechat: 'account', matrix: 'account', fb_messenger: 'account', google_messages: 'account',
  discord: 'bot', slack: 'bot', teams: 'bot', viber: 'bot', line: 'bot', googlechat: 'bot', qq: 'bot',
  threema: 'none', kakaotalk: 'none',
};

export function accountModelOf(platform: string): AccountModel {
  return ACCOUNT_MODEL[platform] ?? 'bot';
}

const BY_PLATFORM = new Map(MESSAGING_PLATFORMS.map((m) => [m.platform, m]));

/** Deterministic fallback color for an unknown platform (stable per key). */
function fallbackColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffffff;
  return `hsl(${hash % 360}, 45%, 45%)`;
}

/** Always returns a def — synthesizes one (capitalized label, monogram) for unknown platforms. */
export function platformMeta(platform: string): MessagingPlatformDef {
  const known = BY_PLATFORM.get(platform);
  if (known) return known;
  const label = platform.charAt(0).toUpperCase() + platform.slice(1);
  return {
    platform,
    label,
    color: fallbackColor(platform),
    short: label.slice(0, 2),
    connectorType: null,
    transport: 'none',
    defaultPairingKind: 'none',
  };
}

export function platformByConnectorType(connectorType: string, channelType?: string): MessagingPlatformDef | undefined {
  if (connectorType !== 'gateway-observer') {
    return MESSAGING_PLATFORMS.find((m) => m.connectorType === connectorType);
  }
  return MESSAGING_PLATFORMS.find((m) => m.connectorType === 'gateway-observer' && m.channelType === channelType);
}
