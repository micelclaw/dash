import type { ManagedAgent } from './types';

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface AgentActivityProps {
  agent: ManagedAgent;
}

export function AgentActivity({ agent }: AgentActivityProps) {
  const stats = [
    { label: 'Last active', value: formatRelativeTime(agent.last_active_at) },
    { label: 'Sessions today', value: String(agent.sessions_today) },
    { label: 'Tokens today', value: agent.tokens_today.toLocaleString() },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h4 style={{
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: 'var(--text)',
        margin: 0,
      }}>
        Activity
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stats.map(stat => (
          <div
            key={stat.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8125rem',
            }}
          >
            <span style={{ color: 'var(--text-dim)' }}>{stat.label}</span>
            <span style={{ color: 'var(--text)' }}>{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
