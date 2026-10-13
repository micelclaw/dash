/** Gateway → Heartbeat: native OpenClaw scheduling with Micelclaw projection. */
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Heart, HeartOff, Save } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/services/api';
import * as gateway from '@/services/gateway.service';

const INTERVALS = [
  { value: '0m', label: 'Desactivado' },
  { value: '5m', label: 'Cada 5 min' },
  { value: '15m', label: 'Cada 15 min' },
  { value: '30m', label: 'Cada 30 min' },
  { value: '1h', label: 'Cada hora' },
  { value: '2h', label: 'Cada 2 horas' },
  { value: '4h', label: 'Cada 4 horas' },
];

interface AgentSummary {
  id: string;
  name: string;
  display_name: string;
  avatar: string | null;
}

const stateLabels: Record<string, string> = {
  active: 'Activo', paused: 'Pausado', global_disabled: 'Configuración global desactivada',
  missing_capabilities: 'Falta una app', requirements_unknown: 'Requisitos desconocidos',
  active_without_chat: 'Activo, sin chat', invalid_heartbeat_file: 'Configuración inconsistente',
  destination_unavailable: 'Destino desconectado', gateway_unavailable: 'Gateway no disponible',
};

function lastRunLabel(status?: gateway.HeartbeatAgentStatus): string {
  if (!status?.last_run) return 'Sin ejecuciones registradas';
  const when = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const minutes = Math.round((new Date(status.last_run.at).getTime() - Date.now()) / 60_000);
  const result = status.last_run.result === 'silent' ? 'silenciosa' : status.last_run.result === 'notice' ? 'con aviso' : 'registrada';
  return `Última ejecución ${result} ${when.format(minutes, 'minute')}`;
}

export function HeartbeatTab() {
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
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la configuración de latidos');
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
      toast.success('Configuración global actualizada');
      setDirty(false);
      await fetchConfig();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const toggleAgent = async (agent: AgentSummary, openclawId: string, enabled: boolean) => {
    setBusyAgent(agent.id);
    try {
      await gateway.updateHeartbeatConfig({ agentId: openclawId, agentHeartbeat: enabled ? { every: '0m' } : {} });
      toast.success(enabled ? `Latido de ${agent.display_name} pausado` : `Latido de ${agent.display_name} activado`);
      await fetchConfig();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el estado'); }
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
      toast.success(`Destino cambiado a ${pendingDestination.destination.label}`);
      setPendingDestination(null);
      await fetchConfig();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el destino'); }
    finally { setBusyAgent(null); }
  };

  if (loading || !config) return <div className="flex h-full items-center justify-center text-sm text-[var(--text-dim)]">Cargando latidos…</div>;

  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl space-y-6 p-5">
        <section className="rounded-lg border border-[var(--border)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Global</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Valores predeterminados; cada agente muestra debajo su estado efectivo.</p>
            </div>
            <button onClick={saveGlobal} disabled={!dirty || saving} className="flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50">
              <Save size={14} /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-[var(--text-dim)]">
              <span>Intervalo predeterminado</span>
              <Select value={every} onValueChange={(value) => { setEvery(value); setDirty(true); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INTERVALS.map((row) => <SelectItem key={row.value} value={row.value}>{row.label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-xs text-[var(--text-dim)]">
              <span>Zona horaria</span>
              <input value={timezone} onChange={(event) => { setTimezone(event.target.value); setDirty(true); }} placeholder="Europe/Madrid" className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input,var(--bg))] px-3 text-sm text-[var(--text)]" />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-dim)]"><span>Horario desde</span><input value={activeStart} onChange={(event) => { setActiveStart(event.target.value); setDirty(true); }} placeholder="08:00" className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input,var(--bg))] px-3 text-sm" /></label>
            <label className="space-y-1 text-xs text-[var(--text-dim)]"><span>Horario hasta</span><input value={activeEnd} onChange={(event) => { setActiveEnd(event.target.value); setDirty(true); }} placeholder="23:00" className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input,var(--bg))] px-3 text-sm" /></label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-xs text-[var(--text-dim)]">
            <input type="checkbox" checked={lightContext} onChange={(event) => { setLightContext(event.target.checked); setDirty(true); }} /> Contexto ligero
          </label>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">Por agente</h3>
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
                        <div className="text-sm font-semibold text-[var(--text)]">{agent.display_name} · {stateLabels[status?.state ?? 'gateway_unavailable']}</div>
                        <div className="mt-1 text-xs text-[var(--text-dim)]">
                          {status?.task_count ?? 0} tareas · {status?.enabled ? `cada ${status.effective_every}` : 'sin ejecución periódica'}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{lastRunLabel(status)}</div>
                        {status?.parse_error && <div className="mt-1 text-xs text-amber-500">{status.parse_error}</div>}
                      </div>
                    </div>
                    <button onClick={() => toggleAgent(agent, openclawId, status?.enabled === true)} disabled={busyAgent === agent.id} className="flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50">
                      {status?.enabled ? <HeartOff size={14} /> : <Heart size={14} />} {status?.enabled ? 'Pausar' : 'Activar'}
                    </button>
                  </div>
                  <div className="mt-4 grid items-end gap-2 md:grid-cols-[1fr_auto]">
                    <label className="space-y-1 text-xs text-[var(--text-dim)]">
                      <span>Destino de todas las tareas</span>
                      <Select value={selectedId} onValueChange={(id) => {
                        const destination = options.find((entry) => entry.id === id);
                        if (destination) setPendingDestination({ agent, openclawId, destination });
                      }} disabled={busyAgent === agent.id}>
                        <SelectTrigger><SelectValue placeholder="Selecciona un destino" /></SelectTrigger>
                        <SelectContent>{options.map((option) => (
                          <SelectItem key={option.id} value={option.id} disabled={!option.available}>
                            {option.label}{!option.available ? ` · ${option.unavailable_reason === 'binding_required'
                              ? 'vinculación pendiente'
                              : option.unavailable_reason === 'account_binding_required'
                                ? 'vuelve a vincular indicando la cuenta'
                                : 'desconectado'}` : ''}
                          </SelectItem>
                        ))}</SelectContent>
                      </Select>
                    </label>
                    <button onClick={() => status?.destination.kind === 'micelclaw_chat' && chat ? navigate(chat.deep_link) : navigate('/gateway?tab=channels')} className="flex h-8 items-center gap-1 rounded-md border border-[var(--border)] px-3 text-xs">
                      <ExternalLink size={13} /> Abrir destino
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
            <DialogTitle>Cambiar destino del heartbeat de {pendingDestination?.agent.display_name}</DialogTitle>
            <DialogDescription>
              Las {pendingDestination ? config.agent_statuses[pendingDestination.openclawId]?.task_count ?? 0 : 0} tareas enviarán sus próximos avisos a {pendingDestination?.destination.label}. Las tareas y sus intervalos no cambiarán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 gap-2">
            <button onClick={() => setPendingDestination(null)} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm">Cancelar</button>
            <button onClick={confirmDestination} className="rounded-md bg-[var(--amber)] px-4 py-2 text-sm font-semibold text-black">Cambiar destino</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
