/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Ola 4 — Triggers list page.
 *
 * Lists every trigger the caller can see (their own; admins see all),
 * with inline toggle for `enabled`, an "Edit" action, "Delete" with
 * confirm, and a "New trigger" button that opens the editor.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Activity, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TriggerEditor } from './TriggerEditor';
import type { EventTrigger } from './types';

export function TriggersPage() {
  const [items, setItems] = useState<EventTrigger[] | null>(null);
  const [editing, setEditing] = useState<EventTrigger | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: EventTrigger[] }>('/event-triggers');
      setItems(res.data);
    } catch (err) {
      toast.error('No se pudieron cargar los triggers');
      console.error(err);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onToggleEnabled = useCallback(async (trigger: EventTrigger, enabled: boolean) => {
    setBusyId(trigger.id);
    try {
      await api.patch(`/event-triggers/${trigger.id}`, { enabled });
      setItems((prev) => prev?.map((t) => t.id === trigger.id ? { ...t, enabled } : t) ?? null);
    } catch {
      toast.error('No se pudo actualizar el trigger');
    } finally {
      setBusyId(null);
    }
  }, []);

  const onDelete = useCallback(async (trigger: EventTrigger) => {
    if (!confirm(`¿Eliminar el trigger "${trigger.name}"? Esta acción es reversible (soft delete), pero no se puede deshacer desde la UI.`)) return;
    setBusyId(trigger.id);
    try {
      await api.delete(`/event-triggers/${trigger.id}`);
      setItems((prev) => prev?.filter((t) => t.id !== trigger.id) ?? null);
      toast.success('Trigger eliminado');
    } catch {
      toast.error('No se pudo eliminar el trigger');
    } finally {
      setBusyId(null);
    }
  }, []);

  const onSaved = useCallback(async () => {
    setEditing(null);
    await load();
  }, [load]);

  const stats = useMemo(() => {
    if (!items) return null;
    const enabled = items.filter((t) => t.enabled).length;
    const withErrors = items.filter((t) => t.last_error).length;
    const totalFires = items.reduce((acc, t) => acc + (t.fire_count ?? 0), 0);
    return { enabled, total: items.length, withErrors, totalFires };
  }, [items]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Triggers</h1>
          <p className="text-sm text-muted-foreground">
            Reglas reactivas: cuando llega un evento al bus que coincide con el patrón y la condición,
            se ejecuta la acción configurada (lanzar flow, re-emitir evento, webhook, audit log…).
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo trigger
        </Button>
      </header>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} icon={<Activity className="h-4 w-4" />} />
          <StatCard label="Activos" value={stats.enabled} accent="text-emerald-500" />
          <StatCard label="Disparos acumulados" value={stats.totalFires} />
          <StatCard
            label="Con error reciente"
            value={stats.withErrors}
            accent={stats.withErrors > 0 ? 'text-amber-500' : undefined}
            icon={stats.withErrors > 0 ? <AlertTriangle className="h-4 w-4" /> : undefined}
          />
        </div>
      )}

      {items === null ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tienes triggers todavía. Crea el primero para reaccionar a eventos del bus.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3 w-12">Activo</th>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3">Patrón</th>
                <th className="text-left p-3">Acción</th>
                <th className="text-left p-3">Severidad min</th>
                <th className="text-right p-3">Disparos</th>
                <th className="text-left p-3">Último error</th>
                <th className="text-right p-3 w-32">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={t.enabled}
                      disabled={busyId === t.id}
                      onClick={() => onToggleEnabled(t, !t.enabled)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        t.enabled ? 'bg-primary' : 'bg-muted'
                      } ${busyId === t.id ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          t.enabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{t.name}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs">{t.match_pattern}</td>
                  <td className="p-3">
                    <Badge variant="outline">{t.action_type}</Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{t.severity_min ?? '—'}</td>
                  <td className="p-3 text-right tabular-nums">{t.fire_count ?? 0}</td>
                  <td className="p-3 text-xs text-amber-600 max-w-[16rem] truncate" title={t.last_error ?? ''}>
                    {t.last_error ?? ''}
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(t)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(t)}
                      disabled={busyId === t.id}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TriggerEditor
          trigger={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon?: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-lg border p-3 flex items-center justify-between">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums ${accent ?? ''}`}>{value}</div>
      </div>
      {icon && <div className={accent ?? 'text-muted-foreground'}>{icon}</div>}
    </div>
  );
}

// Default export for the lazy loader in App.tsx.
export const Component = TriggersPage;
