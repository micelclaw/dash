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

// ─── Terminal WebSocket Client ──────────────────────────────────────
// Dedicated WS connection for /ws/terminal. Separate from the main
// ClawWebSocket because terminal needs raw pty throughput, not the
// general-purpose event bus pattern.

export interface TermWsServerMsg {
  event: 'output' | 'opened' | 'closed' | 'error' | 'ping';
  sessionId?: string;
  data?: string;
  pid?: number;
  code?: number;
  signal?: number;
  message?: string;
}

export interface TermWsClientMsg {
  action: 'open' | 'input' | 'resize' | 'close' | 'pong';
  sessionId?: string;
  type?: 'local' | 'ssh';
  cols?: number;
  rows?: number;
  cwd?: string;
  connectionId?: string;
  data?: string;
}

type MessageHandler = (msg: TermWsServerMsg) => void;
type ReconnectHandler = () => void;

export class TerminalWebSocket {
  private ws: WebSocket | null = null;
  private token: string;
  private handlers = new Set<MessageHandler>();
  private reconnectHandlers = new Set<ReconnectHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private disposed = false;
  private pendingMessages: TermWsClientMsg[] = [];
  private hasConnectedOnce = false;

  constructor(token: string) {
    this.token = token;
  }

  connect(): void {
    if (this.disposed) return;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.VITE_WS_URL
      ? import.meta.env.VITE_WS_URL.replace(/\/ws$/, '/ws/terminal')
      : `${proto}//${location.host}/ws/terminal`;

    this.ws = new WebSocket(`${wsUrl}?token=${this.token}`);

    this.ws.onopen = () => {
      const isReconnect = this.hasConnectedOnce;
      this.hasConnectedOnce = true;
      this.reconnectAttempts = 0;

      // Flush queued messages
      for (const msg of this.pendingMessages) {
        this.ws!.send(JSON.stringify(msg));
      }
      this.pendingMessages = [];

      // Notify reconnect handlers (so TerminalPanels can re-open sessions)
      if (isReconnect) {
        for (const handler of this.reconnectHandlers) {
          handler();
        }
      }
    };

    this.ws.onmessage = (event) => {
      let msg: TermWsServerMsg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      // Respond to server pings
      if (msg.event === 'ping') {
        this.send({ action: 'pong' });
        return;
      }

      for (const handler of this.handlers) {
        handler(msg);
      }
    };

    this.ws.onclose = () => {
      if (this.disposed) return;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  send(msg: TermWsClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (!this.disposed) {
      // Queue messages while connecting — they'll be flushed on open
      this.pendingMessages.push(msg);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onReconnect(handler: ReconnectHandler): () => void {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  dispose(): void {
    this.disposed = true;
    this.pendingMessages = [];
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
    this.reconnectHandlers.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
