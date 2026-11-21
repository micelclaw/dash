/** Gateway → Heartbeat: native OpenClaw scheduling with Micelclaw projection. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Heart, HeartOff, Save } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/services/api';
import * as gateway from '@/services/gateway.service';
import { useI18n } from '@/i18n';

const INTERVALS = [
  { value: '0m', key: 'gateway.heartbeat.disabled' },
  { value: '5m', key: 'gateway.heartbeat.every5' },
  { value: '15m', key: 'gateway.heartbeat.every15' },
  { value: '30m', key: 'gateway.heartbeat.every30' },
  { value: '1h', key: 'gateway.heartbeat.every1h' },
  { value: '2h', key: 'gateway.heartbeat.every2h' },
  { value: '4h', key: 'gateway.heartbeat.every4h' },
];

interface AgentSummary {
  id: string;
  name: string;
  display_name: string;
  avatar: string | null;
}

function lastRunLabel(status: gateway.HeartbeatAgentStatus | undefined, t: (key: string, values?: Record<string, string | number>) => string, locale: string): string {
  if (!status?.last_run) return t('gateway.heartbeat.noRuns');
  const when = new Intl.RelativeTimeFormat(locale === 'es' ? 'es' : 'en', { numeric: 'auto' });
  const minutes = Math.round((new Date(status.last_run.at).getTime() - Date.now()) / 60_000);
  const result = status.last_run.result === 'silent' ? t('gateway.heartbeat.silent') : status.last_run.result === 'notice' ? t('gateway.heartbeat.withNotice') : t('gateway.heartbeat.recorded');
  return t('gateway.heartbeat.lastRun', { result, time: when.format(minutes, 'minute') });
}

export function HeartbeatTab() {
  const { t, locale } = useI18n();
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [every, setEvery] = useState('30m');
  const [activeStart, setActiveStart] = useState('');
  const [activeEnd, setActiveEnd] = useState('');
  const [timezone, setTimezone] = useState('');
  const [lightContext, setLightContext] = useState(false);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [config, setConfig] = useState<gateway.HeartbeatConfig | null>(null);
  const [destinations, setDestinations] = useState<Record<string, gateway.HeartbeatDestination[]>>({});
  const [busyAgent, setBusyAgent] = useState<string | null>(null);
  const [pendingDestination, setPendingDestination] = useState<{
    agent: AgentSummary; openclawId: string; destination: gateway.HeartbeatDestination;
  } | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [heartbeat, agentsResponse] = await Promise.all([
        gateway.getHeartbeatConfig(),
        api.get<{ data: AgentSummary[] }>('/managed-agents'),
      ]);
      const global = heartbeat.global ?? {};
      const hours = (global.active_hours ?? {}) as Record<string, unknown>;
      setEvery(String(global.every ?? '30m'));
      setActiveStart(String(hours.start ?? ''));
      setActiveEnd(String(hours.end ?? ''));
      setTimezone(String(hours.timezone ?? ''));
      setLightContext(global.light_context === true);
      setConfig(heartbeat);
      const rows = agentsResponse.data ?? [];
      setAgents(rows);
      const destinationRows = await Promise.all(rows.map(async (agent) => [
        agent.id, await gateway.getHeartbeatDestinations(agent.id),
      ] as const));
      setDestinations(Object.fromEntries(destinationRows));
      setDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tRef.current('gateway.heartbeat.loadFailed'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  const saveGlobal = async () => {
    setSaving(true);
    try {
      await gateway.updateHeartbeatConfig({
        global: {
          every,
          ...(activeStart && activeEnd ? { activeHours: { start: activeStart, end: activeEnd, ...(timezone ? { timezone } : {}) } } : {}),
          lightContext,
        },
      });
      toast.success(t('gateway.heartbeat.globalUpdated'));
      setDirty(false);
      await fetchConfig();
    } catch (error) { toast.error(error instanceof Error ? error.message : t('gateway.heartbeat.saveFailed')); }
    finally { setSaving(false); }
  };

  const toggleAgent = async (agent: AgentSummary, openclawId: string, enabled: boolean) => {
    setBusyAgent(agent.id);
    try {
      await gateway.updateHeartbeatConfig({ agentId: openclawId, agentHeartbeat: enabled ? { every: '0m' } : {} });
      toast.success(t(enabled ? 'gateway.heartbeat.agentPaused' : 'gateway.heartbeat.agentActivated', { agent: agent.display_name }));
      await fetchConfig();
    } catch (error) { toast.error(error instanceof Error ? error.message : t('gateway.heartbeat.stateFailed')); }
    finally { setBusyAgent(null); }
  };

  const confirmDestination = async () => {
    if (!pendingDestination) return;
    setBusyAgent(pendingDestination.agent.id);
    try {
      await gateway.updateHeartbeatConfig({
        agentId: pendingDestination.openclawId,
        destination_id: pendingDestination.destination.id,
      });
      toast.success(t('gateway.heartbeat.destinationChanged', { destination: pendingDestination.destination.label }));
      setPendingDestination(null);
      await fetchConfig();
    } catch (error) { toast.error(error instanceof Error ? error.message : t('gateway.heartbeat.destinationFailed')); }
    finally { setBusyAgent(null); }
  };

  if (loading || !config) return <div className="flex h-full items-center justify-center text-sm text-[var(--text-dim)]">{t('gateway.heartbeat.loading')}</div>;

  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl space-y-6 p-5">
        <section className="rounded-lg border border-[var(--border)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t('gateway.heartbeat.global')}</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t('gateway.heartbeat.defaultsHelp')}</p>
            </div>
            <button onClick={saveGlobal} disabled={!dirty || saving} className="flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50">
              <Save size={14} /> {saving ? t('gateway.heartbeat.saving') : t('gateway.heartbeat.save')}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-[var(--text-dim)]">
              <span>{t('gateway.heartbeat.defaultInterval')}</span>
              <Select value={every} onValueChange={(value) => { setEvery(value); setDirty(true); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INTERVALS.map((row) => <SelectItem key={row.value} value={row.value}>{t(row.key)}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-xs text-[var(--text-dim)]">
              <span>{t('gateway.heartbeat.timezone')}</span>
              <input value={timezone} onChange={(event) => { setTimezone(event.target.value); setDirty(true); }} placeholder="Europe/Madrid" className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input,var(--bg))] px-3 text-sm text-[var(--text)]" />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-dim)]"><span>{t('gateway.heartbeat.activeStart')}</span><input value={activeStart} onChange={(event) => { setActiveStart(event.target.value); setDirty(true); }} placeholder="08:00" className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input,var(--bg))] px-3 text-sm" /></label>
            <label className="space-y-1 text-xs text-[var(--text-dim)]"><span>{t('gateway.heartbeat.activeHoursEnd')}</span><input value={activeEnd} onChange={(event) => { setActiveEnd(event.target.value); setDirty(true); }} placeholder="23:00" className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input,var(--bg))] px-3 text-sm" /></label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-xs text-[var(--text-dim)]">
            <input type="checkbox" checked={lightContext} onChange={(event) => { setLightContext(event.target.checked); setDirty(true); }} /> {t('gateway.heartbeat.lightContext')}
          </label>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t('gateway.heartbeat.agent')}</h3>
          <div className="space-y-3">
            {agents.map((agent) => {
              const openclawId = config.agent_id_map[agent.name];
              if (!openclawId) return null;
              const status = config.agent_statuses?.[openclawId];
              const chat = config.heartbeat_chats?.[openclawId];
              const options = destinations[agent.id] ?? [];
              const selectedId = status?.destination.kind === 'channel'
                ? `channel:${encodeURIComponent(status.destination.channel ?? '')}:${encodeURIComponent(status.destination.account_id ?? 'default')}`
                : 'micelclaw:heartbeat-chat';
              return (
                <article key={agent.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className="text-lg">{agent.avatar ?? '🤖'}</span>
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">{agent.display_name} · {t(`gateway.heartbeat.state.${status?.state ?? 'gateway_unavailable'}`)}</div>
                        <div className="mt-1 text-xs text-[var(--text-dim)]">
                          {t('gateway.heartbeat.tasks', { count: status?.task_count ?? 0 })} · {status?.enabled ? t('gateway.heartbeat.every', { interval: status.effective_every }) : t('gateway.heartbeat.noPeriodicRun')}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{lastRunLabel(status, t, locale)}</div>
                        {status?.parse_error && <div className="mt-1 text-xs text-amber-500">{status.parse_error}</div>}
                      </div>
                    </div>
                    <button onClick={() => toggleAgent(agent, openclawId, status?.enabled === true)} disabled={busyAgent === agent.id} className="flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50">
                      {status?.enabled ? <HeartOff size={14} /> : <Heart size={14} />} {status?.enabled ? t('gateway.heartbeat.pause') : t('gateway.heartbeat.activate')}
                    </button>
                  </div>
                  <div className="mt-4 grid items-end gap-2 md:grid-cols-[1fr_auto]">
                    <label className="space-y-1 text-xs text-[var(--text-dim)]">
                      <span>{t('gateway.heartbeat.destinationAllTasks')}</span>
                      <Select value={selectedId} onValueChange={(id) => {
                        const destination = options.find((entry) => entry.id === id);
                        if (destination) setPendingDestination({ agent, openclawId, destination });
                      }} disabled={busyAgent === agent.id}>
                        <SelectTrigger><SelectValue placeholder={t('gateway.heartbeat.selectDestination')} /></SelectTrigger>
                        <SelectContent>{options.map((option) => (
                          <SelectItem key={option.id} value={option.id} disabled={!option.available}>
                            {option.label}{!option.available ? ` · ${option.unavailable_reason === 'binding_required'
                              ? t('gateway.heartbeat.pendingBinding')
                              : option.unavailable_reason === 'account_binding_required'
                                ? t('gateway.heartbeat.rebindAccount')
                                : t('gateway.heartbeat.disconnected')}` : ''}
                          </SelectItem>
                        ))}</SelectContent>
                      </Select>
                    </label>
                    <button onClick={() => status?.destination.kind === 'micelclaw_chat' && chat ? navigate(chat.deep_link) : navigate('/gateway?tab=channels')} className="flex h-8 items-center gap-1 rounded-md border border-[var(--border)] px-3 text-xs">
                      <ExternalLink size={13} /> {t('gateway.heartbeat.openDestination')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <Dialog open={Boolean(pendingDestination)} onOpenChange={(open) => { if (!open) setPendingDestination(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('gateway.heartbeat.changeDestinationTitle', { agent: pendingDestination?.agent.display_name ?? '' })}</DialogTitle>
            <DialogDescription>
              {t('gateway.heartbeat.changeDestinationDescription', { count: pendingDestination ? config.agent_statuses[pendingDestination.openclawId]?.task_count ?? 0 : 0, destination: pendingDestination?.destination.label ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 gap-2">
            <button onClick={() => setPendingDestination(null)} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm">{t('gateway.cron.cancel')}</button>
            <button onClick={confirmDestination} className="rounded-md bg-[var(--amber)] px-4 py-2 text-sm font-semibold text-black">{t('gateway.heartbeat.changeDestination')}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
