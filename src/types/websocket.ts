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
