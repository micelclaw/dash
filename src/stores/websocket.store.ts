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

import { create } from 'zustand';
import type { WsEvent, WsStatus } from '@/types/websocket';
import { ClawWebSocket } from '@/services/websocket';

interface WebSocketStore {
  status: WsStatus;
  lastEvent: WsEvent | null;
  client: ClawWebSocket | null;
  connect: (token: string) => void;
  disconnect: () => void;
  send: (action: string, data?: Record<string, unknown>) => void;
  setStatus: (status: WsStatus) => void;
  setLastEvent: (event: WsEvent) => void;
}

export const useWebSocketStore = create<WebSocketStore>()((set, get) => ({
  status: 'offline',
  lastEvent: null,
  client: null,

  connect: (token: string) => {
    const existing = get().client;
    if (existing) existing.disconnect();

    const client = new ClawWebSocket({
      onStatusChange: (status) => set({ status }),
      onEvent: (event) => set({ lastEvent: event }),
    });
    set({ client });
    client.connect(token);
  },

  disconnect: () => {
    get().client?.disconnect();
    set({ client: null, status: 'offline' });
  },

  send: (action: string, data?: Record<string, unknown>) => {
    get().client?.send(action, data);
  },

  setStatus: (status: WsStatus) => set({ status }),
  setLastEvent: (event: WsEvent) => set({ lastEvent: event }),
}));
