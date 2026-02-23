import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { useAgentDetail } from './hooks/use-agent-detail';
import { AgentIdentity } from './AgentIdentity';
import { AgentSkills } from './AgentSkills';
import { AgentActivity } from './AgentActivity';
import type { ManagedAgent } from './types';

interface AgentDetailProps {
  agentId: string;
  agents: ManagedAgent[];
  onSelect: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--success)',
  idle: '#EAB308',
  error: 'var(--error)',
};

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

export function AgentDetail({ agentId, agents, onSelect }: AgentDetailProps) {
  const { agent, loading } = useAgentDetail(agentId);
  const navigate = useNavigate();
  const [browseHover, setBrowseHover] = useState(false);
  const [hoveredChildId, setHoveredChildId] = useState<string | null>(null);

  if (loading || !agent) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-dim)',
        fontSize: '0.875rem',
      }}>
        {loading ? 'Loading...' : 'Agent not found'}
      </div>
    );
  }

  const children = agents.filter(a => a.parent_agent_id === agentId);

  return (
    <div style={{
      overflowY: 'auto',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      height: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: '1.25rem' }}>{agent.avatar || '🤖'}</span>
          <div>
            <div style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text)',
            }}>
              {agent.display_name} — {agent.role}
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              marginTop: 2,
            }}>
              {agent.model}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.75rem',
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: 'var(--radius-full)',
            background: STATUS_COLORS[agent.status] || 'var(--text-muted)',
          }} />
          <span style={{ color: 'var(--text)' }}>{agent.status}</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {' '} — last active {formatRelativeTime(agent.last_active_at)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Identity */}
      <AgentIdentity agentId={agentId} />

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Skills */}
      <AgentSkills skills={agent.skills} />

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Activity */}
      <AgentActivity agent={agent} />

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Sub-agents */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h4 style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text)',
          margin: 0,
        }}>
          Sub-agents ({children.length})
        </h4>
        {children.length === 0 ? (
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}>
            No sub-agents
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {children.map(child => (
              <div
                key={child.id}
                onClick={() => onSelect(child.id)}
                onMouseEnter={() => setHoveredChildId(child.id)}
                onMouseLeave={() => setHoveredChildId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: hoveredChildId === child.id
                    ? 'var(--surface-hover)'
                    : 'var(--surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{ fontSize: '1rem' }}>{child.avatar || '🤖'}</span>
                  <div>
                    <div style={{
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      color: 'var(--text)',
                    }}>
                      {child.display_name}
                    </div>
                    <div style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-dim)',
                    }}>
                      {child.skills.length} skill{child.skills.length !== 1 ? 's' : ''} — {child.role}
                    </div>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Footer */}
      <button
        onClick={() => navigate(`/explorer?path=${encodeURIComponent(agent.workspace_path)}`)}
        onMouseEnter={() => setBrowseHover(true)}
        onMouseLeave={() => setBrowseHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: browseHover ? 'var(--surface-hover)' : 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text)',
          fontSize: '0.8125rem',
          fontWeight: 500,
          padding: '8px 16px',
          cursor: 'pointer',
          transition: 'var(--transition-fast)',
          fontFamily: 'var(--font-sans)',
          width: '100%',
        }}
      >
        Browse Files <ArrowRight size={14} />
      </button>
    </div>
  );
}
