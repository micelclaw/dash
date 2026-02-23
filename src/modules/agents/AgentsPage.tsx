import { useState } from 'react';
import { Bot } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useAgents } from './hooks/use-agents';
import { AgentTree } from './AgentTree';
import { CouncilTab } from './council/CouncilTab';
import { AgentConversations } from './AgentConversations';
import { AgentWorkspaces } from './AgentWorkspaces';
import { CreateAgentWizard } from './CreateAgentWizard';
import type { AgentTab } from './types';

const TABS: { key: AgentTab; label: string }[] = [
  { key: 'tree', label: 'Tree' },
  { key: 'council', label: 'Council' },
  { key: 'conversations', label: 'Conversations' },
  { key: 'workspaces', label: 'Workspaces' },
];

export function Component() {
  const { agents, loading, error, addAgent } = useAgents();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<AgentTab>('tree');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [newBtnHover, setNewBtnHover] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<AgentTab | null>(null);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-dim)',
        fontSize: '0.875rem',
      }}>
        Loading agents...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
      }}>
        <span style={{ color: 'var(--error)', fontSize: '0.875rem' }}>{error}</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '10px 12px' : '12px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        ...(isMobile ? { flexWrap: 'wrap' as const, gap: 8 } : {}),
      }}>
        {/* Left: title + new button on mobile */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          ...(isMobile ? { width: '100%', justifyContent: 'space-between' } : {}),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={20} style={{ color: 'var(--mod-agents)' }} />
            <h1 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text)',
              margin: 0,
            }}>
              Agents
            </h1>
          </div>
          {/* On mobile, move + New button next to title */}
          {isMobile && (
            <button
              onClick={() => setShowCreateWizard(true)}
              style={{
                background: 'var(--amber)',
                color: '#000',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              + New
            </button>
          )}
        </div>

        {/* Center: tabs */}
        <div style={{
          display: 'flex',
          gap: isMobile ? 2 : 4,
          ...(isMobile ? {
            width: '100%',
            overflowX: 'auto' as const,
            WebkitOverflowScrolling: 'touch' as const,
          } : {}),
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const isHovered = hoveredTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                onMouseEnter={() => setHoveredTab(tab.key)}
                onMouseLeave={() => setHoveredTab(null)}
                style={{
                  background: isActive
                    ? 'var(--amber-dim)'
                    : isHovered
                      ? 'var(--surface-hover)'
                      : 'transparent',
                  color: isActive
                    ? 'var(--amber)'
                    : 'var(--text-dim)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: isMobile ? '5px 10px' : '5px 12px',
                  fontSize: isMobile ? '0.75rem' : '0.8125rem',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                  flex: isMobile ? 1 : undefined,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right: + New button (desktop only) */}
        {!isMobile && (
          <button
            onClick={() => setShowCreateWizard(true)}
            onMouseEnter={() => setNewBtnHover(true)}
            onMouseLeave={() => setNewBtnHover(false)}
            style={{
              background: 'var(--amber)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 14px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              fontFamily: 'var(--font-sans)',
              opacity: newBtnHover ? 0.9 : 1,
            }}
          >
            + New
          </button>
        )}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'tree' && (
          <AgentTree
            agents={agents}
            selectedId={selectedAgentId}
            onSelect={setSelectedAgentId}
            isMobile={isMobile}
          />
        )}
        {activeTab === 'council' && <CouncilTab agents={agents} />}
        {activeTab === 'conversations' && <AgentConversations agents={agents} />}
        {activeTab === 'workspaces' && <AgentWorkspaces agents={agents} isMobile={isMobile} />}
      </div>

      {/* Create wizard modal */}
      {showCreateWizard && (
        <CreateAgentWizard
          onClose={() => setShowCreateWizard(false)}
          agents={agents}
          onCreated={addAgent}
        />
      )}
    </div>
  );
}
