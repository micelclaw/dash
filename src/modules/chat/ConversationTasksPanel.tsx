/** Native OpenClaw 9.4 task activity for the current authorized conversation. */
import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useIsMobile } from '@/hooks/use-media-query';
import { useWebSocket } from '@/hooks/use-websocket';

type Task = {
  id: string;
  status: string;
  title: string;
  kind: string | null;
  agent_id: string | null;
  has_transcript: boolean;
  created_at: number | null;
  started_at: number | null;
  ended_at: number | null;
  last_tool_name: string | null;
  progress_summary: string | null;
  terminal_summary: string | null;
  error: string | null;
  prompt: string | null;
  result: string | null;
  can_cancel: boolean;
  can_retry_delivery: boolean;
  can_dismiss_delivery: boolean;
};
type TaskList = { tasks: Task[]; truncated: boolean };
type TaskHistory = { messages: Array<{ role: string; text: string }>; has_more: boolean };

const statusLabels: Record<string, string> = {
  queued: 'Pendiente', running: 'En curso', completed: 'Completado',
  failed: 'Fallido', timed_out: 'Tiempo agotado', cancelled: 'Cancelado',
};

function taskTime(value: number | null): string {
  return value ? new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
}

function elapsedTime(task: Task): string {
  const start = task.started_at ?? task.created_at;
  if (!start) return '';
  const seconds = Math.max(0, Math.floor(((task.ended_at ?? Date.now()) - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function ConversationTasksPanel({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const isMobile = useIsMobile();
  const taskEvent = useWebSocket('chat.task.changed');
  const syncedEvent = useWebSocket('chat.synced');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Task | null>(null);
  const [history, setHistory] = useState<TaskHistory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const result = await api.get<{ data: TaskList }>(`/conversations/threads/${conversationId}/tasks`);
      setTasks(result.data.tasks);
      // A task can finish or be cancelled by another authorized reader while
      // its detail is open. Keep its available actions in sync with the list.
      setDetail((current) => {
        if (!current) return current;
        const updated = result.data.tasks.find((task) => task.id === current.id);
        return updated ? { ...current, ...updated } : current;
      });
      setTruncated(result.data.truncated);
      setError('');
    } catch {
      setError('No se pudieron cargar las tareas de esta conversación.');
      if (showSpinner) toast.error('No se pudieron cargar las tareas.');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(true), 0);
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    if (taskEvent?.data?.conversation_id === conversationId || syncedEvent?.data?.conversation_id === conversationId) {
      void refresh();
    }
  }, [conversationId, refresh, taskEvent, syncedEvent]);

  const openTask = async (task: Task) => {
    setSelectedId(task.id);
    setDetail(null);
    setHistory(null);
    setDetailLoading(true);
    try {
      const root = `/conversations/threads/${conversationId}/tasks/${task.id}`;
      const [taskResponse, historyResponse] = await Promise.all([
        api.get<{ data: Task }>(root),
        task.has_transcript ? api.get<{ data: TaskHistory }>(`${root}/history`) : Promise.resolve(null),
      ]);
      setDetail(taskResponse.data);
      setHistory(historyResponse?.data ?? null);
      setError('');
    } catch {
      setError('No se pudo cargar el detalle de esta tarea.');
      toast.error('No se pudo abrir el trabajo delegado.');
    } finally {
      setDetailLoading(false);
    }
  };

  const act = async (action: 'cancel' | 'retry-delivery' | 'dismiss-delivery') => {
    if (!detail || busyAction) return;
    setBusyAction(true);
    try {
      const response = await api.post<{ data: { ok?: boolean; cancelled?: boolean } }>(
        `/conversations/threads/${conversationId}/tasks/${detail.id}/${action}`, {},
      );
      if (response.data.ok !== true && response.data.cancelled !== true) throw new Error('Action was not applied');
      toast.success(action === 'cancel' ? 'Tarea detenida' : action === 'retry-delivery' ? 'Entrega reintentada' : 'Entrega descartada');
      await refresh();
      await openTask(detail);
    } catch {
      toast.error('No se pudo completar la acción de esta tarea.');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Trabajo en segundo plano" style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1000,
      width: isMobile ? '100vw' : 440, maxWidth: '100vw',
      display: 'flex', flexDirection: 'column', background: 'var(--card)',
      borderLeft: '1px solid var(--border)', boxShadow: '-8px 0 24px rgba(0,0,0,.3)',
      color: 'var(--text)', fontFamily: 'var(--font-sans)',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <Activity size={17} style={{ color: 'var(--amber)' }} />
        <strong style={{ flex: 1 }}>Tareas de este chat</strong>
        <button type="button" aria-label="Actualizar tareas" onClick={() => void refresh(true)}><RefreshCw size={16} /></button>
        <button type="button" aria-label="Cerrar trabajo" onClick={onClose}><X size={16} /></button>
      </header>
      <div style={{ overflowY: 'auto', padding: 14, display: 'grid', alignContent: 'start', gap: 10 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5, margin: 0 }}>Aquí aparecen las ejecuciones de este chat, incluso las ya terminadas. Los chats independientes iniciados desde «Nueva conversación en segundo plano» se abren en la lista de conversaciones de la izquierda.</p>
        {error && <p role="alert" style={{ color: 'var(--error)', margin: 0 }}>{error}</p>}
        {loading && <p style={{ color: 'var(--text-muted)' }}><Loader2 size={14} /> Cargando tareas…</p>}
        {!loading && tasks.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Esta conversación no tiene tareas en segundo plano.</p>}
        {truncated && <p style={{ color: 'var(--text-muted)', margin: 0 }}>Se muestran las 500 tareas más recientes.</p>}
        {tasks.map((task) => (
          <button key={task.id} type="button" aria-pressed={selectedId === task.id} onClick={() => void openTask(task)} style={{
            textAlign: 'left', padding: 11, borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${selectedId === task.id ? 'var(--amber)' : 'var(--border)'}`,
            background: 'var(--surface)', color: 'var(--text)', display: 'grid', gap: 5,
          }}>
            <span style={{ fontWeight: 600 }}>{task.title}</span>
            <span style={{ fontSize: 12, color: task.status === 'failed' ? 'var(--error)' : 'var(--text-muted)' }}>
              {statusLabels[task.status] ?? task.status} · {task.agent_id?.split('--').at(-1) ?? 'Agente'}
              {task.last_tool_name ? ` · ${task.last_tool_name}` : ''}
              {taskTime(task.started_at ?? task.created_at) ? ` · ${taskTime(task.started_at ?? task.created_at)}` : ''}
              {elapsedTime(task) ? ` · ${elapsedTime(task)}` : ''}
            </span>
            {(task.progress_summary || task.terminal_summary || task.error) && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{task.terminal_summary ?? task.progress_summary ?? task.error}</span>}
          </button>
        ))}
        {detailLoading && <p style={{ color: 'var(--text-muted)' }}>Cargando detalle…</p>}
        {detail && <section aria-label="Detalle del trabajo" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gap: 8 }}>
          <strong>{detail.title}</strong>
          {(detail.can_cancel || detail.can_retry_delivery || detail.can_dismiss_delivery) && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {detail.can_cancel && <button type="button" disabled={busyAction} onClick={() => void act('cancel')}>Detener</button>}
            {detail.can_retry_delivery && <button type="button" disabled={busyAction} onClick={() => void act('retry-delivery')}>Reintentar entrega</button>}
            {detail.can_dismiss_delivery && <button type="button" disabled={busyAction} onClick={() => void act('dismiss-delivery')}>Descartar entrega</button>}
          </div>}
          {detail.prompt && <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13 }}>{detail.prompt}</p>}
          {(detail.result || detail.terminal_summary) && <p style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>{detail.result ?? detail.terminal_summary}</p>}
          {history && <div aria-label="Transcripción del trabajo" style={{ display: 'grid', gap: 8 }}>
            {history.messages.map((message, index) => <div key={index} style={{ borderLeft: '2px solid var(--amber)', paddingLeft: 8, fontSize: 12 }}>
              <strong>{message.role === 'assistant' ? 'Agente' : message.role === 'user' ? 'Encargo' : 'Herramienta'}</strong>
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.text}</div>
            </div>)}
            {history.has_more && <small style={{ color: 'var(--text-muted)' }}>Hay más actividad en OpenClaw.</small>}
          </div>}
        </section>}
      </div>
    </div>
  );
}
