/** Fleet entry point for per-agent command security. */

import { useState } from 'react';
import { Bot, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import { AgentSecurity } from '@/modules/agents/AgentSecurity';
import { useAgents } from '@/modules/agents/hooks/use-agents';

export function AgentExecutionPanel() {
  const { agents, loading, error, refetch } = useAgents();
  const [selectedId, setSelectedId] = useState('');

  const effectiveSelectedId = agents.some((agent) => agent.id === selectedId)
    ? selectedId
    : agents[0]?.id ?? '';
  const selected = agents.find((agent) => agent.id === effectiveSelectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><Bot size={19} className="text-[var(--amber)]" />Agent execution</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">Choose an agent to manage its desired mode, published profile, local overrides, effective runtime state and isolation.</p></div>
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
          {selected && <AgentSecurity key={selected.id} agentId={selected.id} agentName={selected.display_name || selected.name} showSandbox />}
        </>
      )}
    </div>
  );
}
