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

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Bot, Package } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useAgents } from './hooks/use-agents';
import { AgentTree } from './AgentTree';
import { CouncilTab } from './council/CouncilTab';
import { WorkboardTab } from './workboard/WorkboardTab';
import { DreamsTab } from './dreams/DreamsTab';
import { AgentConversations } from './AgentConversations';
import { AgentWorkspaces } from './AgentWorkspaces';
import { FleetTab } from './fleet/FleetTab';
import { CreateAgentWizard } from './CreateAgentWizard';
import { ImportAgentModal } from './ImportAgentModal';
import { useChatStore } from '@/stores/chat.store';
import type { AgentTab } from './types';

type Section = { key: AgentTab; label: string; description?: string };
const TABS: readonly [Section, ...Section[]] = [
  { key: 'tree', label: 'Tree' },
  { key: 'council', label: 'Council', description: 'Board meetings with your chief agents' },
  { key: 'workboard', label: 'Workboard', description: 'Coordinación de agentes · cola de trabajo y traspaso de sesión' },
  { key: 'memory', label: 'Memory', description: 'Memoria activa y consolidación durante el sueño' },
  { key: 'conversations', label: 'Conversations' },
  { key: 'workspaces', label: 'Workspaces' },
  { key: 'fleet', label: 'Fleet' },
];

export function Component() {
  const { agents, loading, error, addAgent, refetch } = useAgents();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const active = TABS.find(tab => tab.key === (requestedTab === 'dreams' ? 'memory' : requestedTab)) ?? TABS[0];
  const activeTab = active.key;
  const updateSearch = useCallback((values: Record<string, string>, replace: boolean) => {
    // Browser history already reflects a rapid replace or Back even while
    // React Router is still committing the corresponding render.
    const next = new URLSearchParams(window.location.search);
    const base = next.toString();
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (next.toString() !== base) setSearchParams(next, { replace });
  }, [setSearchParams]);
  const setActiveTab = useCallback((requested: AgentTab | 'dreams', replace = false) => {
    updateSearch(requested === 'dreams' ? { tab: 'memory', memory_tab: 'dreams' } : { tab: requested }, replace);
  }, [updateSearch]);
  useEffect(() => {
    if (requestedTab === 'dreams') setActiveTab('dreams', true);
  }, [requestedTab, setActiveTab]);
  useEffect(() => {
    const onJump = (event: Event) => {
      const tab = (event as CustomEvent<string>).detail;
      if (tab === 'dreams') setActiveTab('dreams');
      else if (TABS.some(item => item.key === tab)) setActiveTab(tab as AgentTab);
    };
    window.addEventListener('claw:agents-tab', onJump);
    return () => window.removeEventListener('claw:agents-tab', onJump);
  }, [setActiveTab]);
  // Read ?selected= so deep-links from elsewhere (e.g. Settings →
  // Sandbox per-agent table) can land on a specific agent. The
  // ?tab= param is consumed inside AgentDetail.
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('selected');
  });
  const initialWorkspaceFile = typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('file');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newBtnHover, setNewBtnHover] = useState(false);
  const [importBtnHover, setImportBtnHover] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<AgentTab | null>(null);
  const [headerActions, setHeaderActions] = useState<HTMLDivElement | null>(null);

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
      <header aria-label="Sección de agentes" style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: isMobile ? '8px 12px' : '8px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Bot size={20} aria-hidden="true" style={{ color: 'var(--mod-agents)', flexShrink: 0 }} />
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              {active.label}
            </h1>
            {active.description && <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {active.description}
            </p>}
          </div>
        </div>

        <nav aria-label="Pestañas de agentes" style={{
          display: 'flex', gap: isMobile ? 2 : 4, minWidth: 0, maxWidth: '100%',
          overflowX: 'auto', width: isMobile ? '100%' : undefined,
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const isHovered = hoveredTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-current={isActive ? 'page' : undefined}
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
        </nav>

        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <div ref={setHeaderActions} className="flex min-w-0 flex-wrap items-center gap-1.5 empty:hidden" />
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            onMouseEnter={() => setImportBtnHover(true)}
            onMouseLeave={() => setImportBtnHover(false)}
            title="Import a Claws or legacy Agentar package"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: importBtnHover ? 'var(--surface-hover)' : 'transparent',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 12px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Package size={13} /> Import
          </button>
          <button
            type="button"
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
        </div>
      </header>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'tree' && (
          <AgentTree
            agents={agents}
            selectedId={selectedAgentId}
            onSelect={setSelectedAgentId}
            isMobile={isMobile}
            onAgentChanged={refetch}
            onBrowseFiles={(agentId) => {
              setSelectedAgentId(agentId);
              setActiveTab('workspaces');
            }}
          />
        )}
        {activeTab === 'council' && <CouncilTab agents={agents} headerActions={headerActions} />}
        {activeTab === 'workboard' && <WorkboardTab
          agents={agents}
          tab={searchParams.get('workboard_view') === 'sessions' ? 'sessions' : 'coordination'}
          onTabChange={tab => updateSearch({ workboard_view: tab === 'sessions' ? tab : '' }, false)}
        />}
        {activeTab === 'memory' && <DreamsTab agents={agents} />}
        {activeTab === 'conversations' && <AgentConversations
          agents={agents}
          headerActions={headerActions}
          searchParams={searchParams}
          onPreferenceChange={(key, value) => updateSearch({ [key]: value }, true)}
        />}
        {activeTab === 'workspaces' && (
          <AgentWorkspaces
            agents={agents}
            isMobile={isMobile}
            initialAgentId={selectedAgentId}
            initialFilePath={initialWorkspaceFile}
          />
        )}
        {activeTab === 'fleet' && (
          <FleetTab
            agents={agents}
            onSelectAgent={(agentId) => { setSelectedAgentId(agentId); setActiveTab('tree'); }}
          />
        )}
      </div>

      {/* Import modal */}
      {showImportModal && (
        <ImportAgentModal
          onClose={() => setShowImportModal(false)}
          onInstalled={() => refetch()}
        />
      )}

      {/* Create wizard modal */}
      {showCreateWizard && (
        <CreateAgentWizard
          onClose={() => setShowCreateWizard(false)}
          agents={agents}
          onCreated={(agent) => {
            addAgent(agent);
            // Update the chat store so the new agent appears in the bottom bar selector
            const { agents: chatAgents, setAgents, selectAgent, startNewConversation } = useChatStore.getState();
            const newChatAgent = {
              name: agent.name,
              display_name: agent.display_name,
              role: agent.role,
              model: agent.model,
              skills_count: Array.isArray(agent.skills) ? agent.skills.length : 0,
              avatar: agent.avatar ?? undefined,
              color: agent.color,
            };
            setAgents([...chatAgents, newChatAgent]);
            // Start a new chat with the newly created agent
            startNewConversation();
            selectAgent(agent.name);
          }}
        />
      )}
    </div>
  );
}
