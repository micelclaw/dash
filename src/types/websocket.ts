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

export interface WsEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface WsAction {
  action: string;
  data?: Record<string, unknown>;
  events?: string[];
}

export type WsStatus = 'connected' | 'reconnecting' | 'offline' | 'auth_failed';

/** Local browser transport acceptance; never a Core/agent delivery ACK. */
export type WsSendResult =
  | { accepted: true }
  | { accepted: false; reason: 'not_connected' | 'send_failed' };
