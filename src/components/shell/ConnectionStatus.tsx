import { useWebSocketStore } from '@/stores/websocket.store';

interface ConnectionStatusProps {
  collapsed: boolean;
}

export function ConnectionStatus({ collapsed }: ConnectionStatusProps) {
  const status = useWebSocketStore((s) => s.status);

  const config = {
    connected: { color: 'var(--success)', label: 'Connected' },
    reconnecting: { color: 'var(--warning)', label: 'Reconnecting...' },
    offline: { color: 'var(--error)', label: 'Offline' },
  }[status];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: collapsed ? '4px 0' : '4px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontSize: '0.75rem',
        color: 'var(--text-dim)',
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: 'var(--radius-full)',
          background: config.color,
          flexShrink: 0,
        }}
      />
      {!collapsed && <span>{config.label}</span>}
    </div>
  );
}
