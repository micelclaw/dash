import type { WsEvent, WsStatus } from '@/types/websocket';

interface ClawWebSocketOptions {
  onStatusChange: (status: WsStatus) => void;
  onEvent: (event: WsEvent) => void;
}

type EventCallback = (event: WsEvent) => void;

export class ClawWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Map<string, Set<EventCallback>>();
  private options: ClawWebSocketOptions;
  private token: string | null = null;

  constructor(options: ClawWebSocketOptions) {
    this.options = options;
  }

  connect(token: string): void {
    this.token = token;

    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      this.options.onStatusChange('connected');
      this.scheduleMockNotifications();
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://127.0.0.1:7200/ws';
    this.ws = new WebSocket(`${wsUrl}?token=${token}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.options.onStatusChange('connected');
    };

    this.ws.onmessage = (raw: MessageEvent) => {
      this.handleMessage(raw);
    };

    this.ws.onclose = () => {
      this.clearHeartbeat();
      if (this.token) {
        this.options.onStatusChange('reconnecting');
        this.reconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.token = null;
    this.clearHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.options.onStatusChange('offline');
  }

  send(action: string, data?: Record<string, unknown>): void {
    const useMock = import.meta.env.VITE_MOCK_API === 'true';
    if (useMock) {
      this.handleMockSend(action, data);
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, data }));
    }
  }

  on(pattern: string, callback: EventCallback): () => void {
    const existing = this.listeners.get(pattern);
    if (existing) {
      existing.add(callback);
    } else {
      this.listeners.set(pattern, new Set([callback]));
    }
    return () => {
      this.listeners.get(pattern)?.delete(callback);
    };
  }

  private handleMessage(raw: MessageEvent): void {
    let parsed: WsEvent;
    try {
      parsed = JSON.parse(raw.data as string) as WsEvent;
    } catch {
      return;
    }

    if (parsed.event === 'ping') {
      this.handleHeartbeat();
      return;
    }

    this.options.onEvent(parsed);
    this.dispatch(parsed);
  }

  private dispatch(event: WsEvent): void {
    for (const [pattern, callbacks] of this.listeners) {
      if (this.matchPattern(pattern, event.event)) {
        for (const cb of callbacks) cb(event);
      }
    }
  }

  private matchPattern(pattern: string, eventName: string): boolean {
    if (pattern === '*') return true;
    if (pattern === eventName) return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return eventName.startsWith(prefix + '.');
    }
    return false;
  }

  private handleHeartbeat(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'pong' }));
    }
    this.clearHeartbeat();
    this.heartbeatTimer = setTimeout(() => {
      this.ws?.close();
    }, 90_000);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.token) {
      this.options.onStatusChange('offline');
      return;
    }

    const base = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 30_000);
    const jitter = base * (0.8 + Math.random() * 0.4);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (this.token) this.connect(this.token);
    }, jitter);
  }

  private handleMockSend(action: string, data?: Record<string, unknown>): void {
    if (action === 'chat.send') {
      const convId = (data?.conversation_id as string) ?? crypto.randomUUID();
      const message = (data?.message as string) ?? '';

      setTimeout(() => {
        this.dispatch({
          event: 'chat.stream.start',
          data: { conversation_id: convId, agent: 'francis', model: 'claude-opus-4-6' },
          timestamp: new Date().toISOString(),
        });

        const response = this.generateMockResponse(message);
        const tokens = response.split(/(?<=\s)/);
        let i = 0;

        const interval = setInterval(() => {
          if (i < tokens.length) {
            this.dispatch({
              event: 'chat.stream.token',
              data: { conversation_id: convId, token: tokens[i]! },
              timestamp: new Date().toISOString(),
            });
            i++;
          } else {
            clearInterval(interval);
            this.dispatch({
              event: 'chat.stream.done',
              data: {
                conversation_id: convId,
                full_text: response,
                tokens_used: tokens.length * 3,
                model: 'claude-opus-4-6',
              },
              timestamp: new Date().toISOString(),
            });
          }
        }, 30);
      }, 500);
    }
  }

  private mockNotificationTimers: ReturnType<typeof setTimeout>[] = [];

  private scheduleMockNotifications(): void {
    // Clear any existing timers
    for (const t of this.mockNotificationTimers) clearTimeout(t);
    this.mockNotificationTimers = [];

    const mockEvents = [
      {
        delay: 3000,
        event: {
          event: 'sync.completed',
          data: { provider: 'Google Calendar', items_synced: 12 },
          timestamp: new Date().toISOString(),
        },
      },
      {
        delay: 8000,
        event: {
          event: 'email.created',
          data: { count: 2, from: 'Juan López', subject: 'Contract update' },
          timestamp: new Date().toISOString(),
        },
      },
      {
        delay: 15000,
        event: {
          event: 'agent.message',
          data: {
            agent: 'francis',
            action: 'note_created',
            summary: "Created note 'Meeting summary'",
            route: '/notes?id=note-new',
          },
          timestamp: new Date().toISOString(),
        },
      },
    ];

    for (const mock of mockEvents) {
      const timer = setTimeout(() => {
        this.dispatch(mock.event);
      }, mock.delay);
      this.mockNotificationTimers.push(timer);
    }
  }

  private generateMockResponse(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('reunión') || lower.includes('hoy') || lower.includes('calendar')) {
      return `Hoy tienes 3 reuniones:\n\n- **10:00** — Standup diario [Open →](/calendar)\n- **14:00** — Design review con el equipo\n- **16:30** — Llamada con cliente\n\n¿Quieres que te prepare un resumen para alguna?`;
    }
    if (lower.includes('nota') || lower.includes('note')) {
      return `He encontrado 12 notas recientes. Las más relevantes:\n\n1. **Budget Q3** — actualizada hace 2h\n2. **Ideas producto** — 5 items pendientes\n3. **Meeting notes** — de ayer\n\n[Open Notes →](/notes)`;
    }
    if (lower.includes('código') || lower.includes('code') || lower.includes('typescript')) {
      return "Aquí tienes un ejemplo:\n\n```typescript\ninterface User {\n  id: string;\n  name: string;\n  email: string;\n  role: 'admin' | 'user';\n}\n\nfunction greet(user: User): string {\n  return `Hello, ${user.name}!`;\n}\n```\n\n¿Necesitas algo más?";
    }
    return `Entendido. He procesado tu mensaje. ¿En qué más puedo ayudarte?\n\nPuedo asistirte con:\n- 📝 Notas y documentos\n- 📅 Calendario y eventos\n- 📧 Correo electrónico\n- 📁 Archivos y Drive`;
  }
}
