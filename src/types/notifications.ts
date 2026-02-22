export interface Notification {
  id: string;
  type: 'sync' | 'agent_action' | 'system' | 'email' | 'digest' | 'approval';
  title: string;
  body?: string;
  read: boolean;
  timestamp: string;
  action?: {
    label: string;
    route?: string;
    callback?: string;
  };
  icon?: string;
  color?: string;
}
