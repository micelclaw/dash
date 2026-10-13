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
 * Per-platform privacy metadata for the Channel Observers list. Keyed by
 * `messages.platform` (the canonical key), so it lines up with capabilities.
 * Privacy is OPTIONAL — a platform without an entry simply omits the bar.
 */

export type TagType = 'excellent' | 'good' | 'mild' | 'neutral' | 'warning' | 'bad' | 'critical';

export interface PrivacyTag {
  label: string;
  type: TagType;
}

export interface PlatformPrivacy {
  subtitle: string;
  score: number;
  tags: PrivacyTag[];
}

export const TAG_COLORS: Record<TagType, { bg: string; text: string; border: string }> = {
  excellent: { bg: 'rgba(16, 185, 129, 0.14)', text: '#34d399', border: 'rgba(16, 185, 129, 0.30)' },
  good: { bg: 'rgba(34, 197, 94, 0.12)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.25)' },
  mild: { bg: 'rgba(132, 204, 22, 0.12)', text: '#a3e635', border: 'rgba(132, 204, 22, 0.25)' },
  neutral: { bg: 'rgba(212, 160, 23, 0.12)', text: '#d4a017', border: 'rgba(212, 160, 23, 0.25)' },
  warning: { bg: 'rgba(234, 138, 30, 0.12)', text: '#f59e0b', border: 'rgba(234, 138, 30, 0.25)' },
  bad: { bg: 'rgba(220, 38, 38, 0.12)', text: '#f87171', border: 'rgba(220, 38, 38, 0.25)' },
  critical: { bg: 'rgba(159, 18, 57, 0.15)', text: '#fb7185', border: 'rgba(159, 18, 57, 0.30)' },
};

export function scoreBarColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#22c55e';
  if (score >= 40) return '#d4a017';
  if (score >= 25) return '#ea8a1e';
  return '#dc2626';
}

export const PLATFORM_PRIVACY: Record<string, PlatformPrivacy> = {
  simplex: {
    subtitle: 'Open source project',
    score: 96,
    tags: [
      { label: 'Open source', type: 'good' },
      { label: 'End-to-end encrypted', type: 'good' },
      { label: 'No phone number', type: 'good' },
      { label: 'No user identifiers', type: 'excellent' },
      { label: 'Zero-knowledge', type: 'excellent' },
      { label: 'Decentralized', type: 'good' },
      { label: 'Self-hostable', type: 'good' },
    ],
  },
  simplex_xrcp: {
    subtitle: 'Tu móvil, desde el escritorio',
    score: 96,
    tags: [
      { label: 'Open source', type: 'good' },
      { label: 'End-to-end encrypted', type: 'good' },
      { label: 'Tus chats reales', type: 'excellent' },
      { label: 'Solo misma red local', type: 'neutral' },
      { label: 'Uno a la vez (móvil o PC)', type: 'warning' },
    ],
  },
  matrix: {
    subtitle: 'Open federated protocol',
    score: 88,
    tags: [
      { label: 'Open source', type: 'good' },
      { label: 'End-to-end encrypted', type: 'good' },
      { label: 'Federated', type: 'good' },
      { label: 'Self-hostable', type: 'excellent' },
      { label: 'Bridges to other apps', type: 'good' },
    ],
  },
  session: {
    subtitle: 'Decentralized',
    score: 85,
    tags: [
      { label: 'Open source', type: 'good' },
      { label: 'End-to-end encrypted', type: 'good' },
      { label: 'No phone number', type: 'good' },
      { label: 'Onion-routed', type: 'excellent' },
      { label: 'Hides your IP', type: 'excellent' },
    ],
  },
  session_link: {
    subtitle: 'Decentralized · tu cuenta',
    score: 85,
    tags: [
      { label: 'Open source', type: 'good' },
      { label: 'End-to-end encrypted', type: 'good' },
      { label: 'No phone number', type: 'good' },
      { label: 'Onion-routed', type: 'excellent' },
      { label: 'Hides your IP', type: 'excellent' },
    ],
  },
  signal: {
    subtitle: 'US · non-profit',
    score: 78,
    tags: [
      { label: 'Open source', type: 'good' },
      { label: 'End-to-end encrypted', type: 'good' },
      { label: 'Requires phone number', type: 'mild' },
      { label: 'No ads or tracking', type: 'good' },
      { label: 'Centralized servers', type: 'neutral' },
    ],
  },
  irc: {
    subtitle: 'Open protocol · via ZNC bouncer',
    score: 45,
    tags: [
      { label: 'Open protocol', type: 'good' },
      { label: 'Plaintext by default', type: 'warning' },
      { label: 'Self-hostable', type: 'good' },
    ],
  },
  google_messages: {
    subtitle: 'US · Google (RCS)',
    score: 40,
    tags: [
      { label: 'RCS E2E (1:1)', type: 'good' },
      { label: 'Ties to your phone', type: 'mild' },
      { label: 'Google-operated', type: 'warning' },
    ],
  },
  telegram: {
    subtitle: 'Dubai · private company',
    score: 35,
    tags: [
      { label: 'Open client only', type: 'neutral' },
      { label: 'E2E in secret chats only', type: 'warning' },
      { label: 'Requires phone number', type: 'bad' },
      { label: 'Cloud-stored messages', type: 'bad' },
    ],
  },
  whatsapp: {
    subtitle: 'US · owned by Meta',
    score: 30,
    tags: [
      { label: 'Closed source', type: 'bad' },
      { label: 'End-to-end encrypted', type: 'good' },
      { label: 'Requires phone number', type: 'warning' },
      { label: 'Shares data with Meta', type: 'critical' },
    ],
  },
  line: {
    subtitle: 'Japan · LINE Corp',
    score: 30,
    tags: [
      { label: 'Closed source', type: 'bad' },
      { label: 'Optional E2E', type: 'neutral' },
      { label: 'Data collection', type: 'bad' },
    ],
  },
  viber: {
    subtitle: 'Japan · Rakuten',
    score: 28,
    tags: [
      { label: 'Closed source', type: 'bad' },
      { label: 'E2E for 1:1', type: 'neutral' },
      { label: 'Data collection', type: 'bad' },
    ],
  },
  fb_messenger: {
    subtitle: 'US · owned by Meta',
    score: 22,
    tags: [
      { label: 'Closed source', type: 'bad' },
      { label: 'E2E not always on', type: 'warning' },
      { label: 'Shares data with Meta', type: 'critical' },
    ],
  },
  teams: {
    subtitle: 'US · Microsoft',
    score: 20,
    tags: [
      { label: 'Closed source', type: 'bad' },
      { label: 'No real encryption', type: 'critical' },
      { label: 'Extensive data collection', type: 'critical' },
      { label: 'Enterprise-oriented', type: 'neutral' },
    ],
  },
  slack: {
    subtitle: 'US · Salesforce',
    score: 18,
    tags: [
      { label: 'Closed source', type: 'bad' },
      { label: 'No real encryption', type: 'critical' },
      { label: 'Extensive data collection', type: 'critical' },
      { label: 'Enterprise-oriented', type: 'neutral' },
    ],
  },
  discord: {
    subtitle: 'US · private company',
    score: 15,
    tags: [
      { label: 'Closed source', type: 'bad' },
      { label: 'No real encryption', type: 'critical' },
      { label: 'Extensive data collection', type: 'critical' },
    ],
  },
  wechat: {
    subtitle: 'China · Tencent',
    score: 8,
    tags: [
      { label: 'Closed source', type: 'bad' },
      { label: 'No encryption', type: 'critical' },
      { label: 'Government-monitored', type: 'critical' },
    ],
  },
  qq: {
    subtitle: 'China · Tencent',
    score: 8,
    tags: [
      { label: 'Closed source', type: 'bad' },
      { label: 'No encryption', type: 'critical' },
      { label: 'Government-monitored', type: 'critical' },
    ],
  },
  threema: {
    subtitle: 'Switzerland · paid',
    score: 90,
    tags: [
      { label: 'Open source', type: 'good' },
      { label: 'End-to-end encrypted', type: 'good' },
      { label: 'No phone number', type: 'good' },
      { label: 'Zero-knowledge', type: 'excellent' },
    ],
  },
  kakaotalk: {
    subtitle: 'South Korea · Kakao',
    score: 18,
    tags: [
      { label: 'Closed source', type: 'bad' },
      { label: 'Optional E2E', type: 'neutral' },
      { label: 'Data collection', type: 'bad' },
    ],
  },
};
