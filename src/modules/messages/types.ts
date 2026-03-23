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

export interface Channel {
  platform: string;
  platform_channel_id: string;
  channel_name: string | null;
  channel_type: string | null;
  message_count: number;
  last_message_at: string;
  last_message_content: string | null;
  last_message_sender: string | null;
}

export interface Message {
  id: string;
  platform: string;
  platform_channel_id: string | null;
  channel_name: string | null;
  direction: string;
  sender_name: string | null;
  content: string | null;
  content_type: string;
  sent_at: string;
  thread_id: string | null;
}

export interface PlatformConfig {
  label: string;
  color: string;
  canSend: boolean;
}

export const PLATFORMS: Record<string, PlatformConfig> = {
  signal:   { label: 'Signal',   color: '#3A76F0', canSend: true },
  slack:    { label: 'Slack',    color: '#4A154B', canSend: true },
  discord:  { label: 'Discord',  color: '#5865F2', canSend: true },
  telegram: { label: 'Telegram', color: '#0088CC', canSend: false },
  teams:    { label: 'Teams',    color: '#6264A7', canSend: false },
  simplex:  { label: 'SimpleX',  color: '#3DB548', canSend: true },
  session:  { label: 'Session',  color: '#00F782', canSend: false },
};
