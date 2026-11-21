/** Fleet entry point for per-agent command security. */

import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Bot, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import { AgentSecurity } from '@/modules/agents/AgentSecurity';
import { useAgents } from '@/modules/agents/hooks/use-agents';
import { CommandProfilesPanel } from './CommandProfilesPanel';

export function AgentExecutionPanel() {
  const { agents, loading, error, refetch } = useAgents();
  const [selectedId, setSelectedId] = useState('');
  const [profileCatalogRevision, setProfileCatalogRevision] = useState(0);
  const [, setSearchParams] = useSearchParams();
  const profilesChanged = useCallback(() => setProfileCatalogRevision(value => value + 1), []);
  const manageProfiles = () => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('security_tab', 'command-profiles');
      return next;
    });
    const heading = document.getElementById('security-command-profiles');
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start' });
  };

  const effectiveSelectedId = agents.some((agent) => agent.id === selectedId)
    ? selectedId
    : agents[0]?.id ?? '';
  const selected = agents.find((agent) => agent.id === effectiveSelectedId) ?? null;

  return (
    <div className="space-y-5" aria-busy={loading && agents.length === 0}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="security-agent-settings" tabIndex={-1} className="m-0 flex scroll-mt-4 items-center gap-2 text-lg font-semibold text-[var(--text)]"><Bot size={19} className="text-[var(--amber)]" />Agent security</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">Choose an agent to configure its isolation, commands and exceptions. Shared command profiles are managed below.</p></div>
        <Button type="button" size="sm" variant="outline" onClick={() => void refetch()} disabled={loading}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh agents</Button>
      </div>
      {error && <RetryBanner severity="error" title="Agents unavailable" message={error} onRetry={() => void refetch()} loading={loading} />}
      {loading && agents.length === 0 ? (
        <div className="flex items-center gap-2 py-10 text-sm text-[var(--text-muted)]"><Loader2 size={15} className="animate-spin" />Loading agents…</div>
      ) : agents.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">No managed agents are available.</div>
      ) : (
        <>
          <label className="block max-w-lg text-xs font-medium text-[var(--text-dim)]">Agent
            <select value={effectiveSelectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-2 h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]">
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.display_name || agent.name} · {agent.status}</option>)}
            </select>
          </label>
          {selected && <AgentSecurity key={selected.id} agentId={selected.id} agentName={selected.display_name || selected.name} showSandbox embedded profileCatalogRevision={profileCatalogRevision} onManageProfiles={manageProfiles} />}
        </>
      )}
      <section aria-labelledby="security-command-profiles" className="border-t border-[var(--border)] pt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 id="security-command-profiles" tabIndex={-1} className="m-0 scroll-mt-4 text-base font-semibold text-[var(--text)]">Shared command profiles</h3>
          <span className="rounded border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">Shared</span>
        </div>
        <p className="mb-3 text-xs text-[var(--text-dim)]">A published profile can be used by several agents. Editing it does not assign it to the selected agent.</p>
        <CommandProfilesPanel embedded onProfilesChanged={profilesChanged} />
      </section>
    </div>
  );
}
