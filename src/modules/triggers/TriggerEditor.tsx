/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Ola 4 — Modal editor for an event trigger (create + edit).
 *
 * Form fields are static for name / pattern / severity / rate_limit and
 * dynamic for action_config (the field shapes are fetched from
 * `/event-triggers/_meta/action-types`). Condition is a raw JSON
 * textarea because the operator subset is intentionally small and the
 * dash audience will copy/paste examples from the docs.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ActionType, EventSeverity, EventTrigger, TriggerActionMeta } from './types';

interface Props {
  trigger: EventTrigger | null; // null => create mode
  onClose: () => void;
  onSaved: () => void;
}

const SEVERITIES: EventSeverity[] = ['debug', 'info', 'warn', 'error', 'critical'];

const CONDITION_PLACEHOLDER = `{
  "==": [{ "var": "reason" }, "suspended"]
}`;

export function TriggerEditor({ trigger, onClose, onSaved }: Props) {
  const [meta, setMeta] = useState<TriggerActionMeta | null>(null);
  const [name, setName] = useState(trigger?.name ?? '');
  const [description, setDescription] = useState(trigger?.description ?? '');
  const [matchPattern, setMatchPattern] = useState(trigger?.match_pattern ?? '');
  const [severityMin, setSeverityMin] = useState<EventSeverity | ''>(trigger?.severity_min ?? '');
  const [conditionJson, setConditionJson] = useState(
    trigger ? JSON.stringify(trigger.condition ?? {}, null, 2) : '{}'
  );
  const [actionType, setActionType] = useState<ActionType>(trigger?.action_type ?? 'event.emit');
  const [actionConfigJson, setActionConfigJson] = useState(
    trigger ? JSON.stringify(trigger.action_config ?? {}, null, 2) : '{}'
  );
  const [rateLimitJson, setRateLimitJson] = useState(
    trigger?.rate_limit ? JSON.stringify(trigger.rate_limit, null, 2) : ''
  );
  const [enabled, setEnabled] = useState(trigger?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<{ data: TriggerActionMeta }>('/event-triggers/_meta/action-types');
        setMeta(res.data);
      } catch (err) {
        console.error('Failed to load action meta', err);
      }
    })();
  }, []);

  const actionFields = useMemo(() => {
    if (!meta) return null;
    return meta.action_configs[actionType]?.fields ?? null;
  }, [meta, actionType]);

  const onSave = useCallback(async () => {
    let parsedCondition: unknown;
    try {
      parsedCondition = conditionJson.trim() ? JSON.parse(conditionJson) : {};
    } catch {
      toast.error('Condición no es JSON válido');
      return;
    }
    let parsedActionConfig: unknown;
    try {
      parsedActionConfig = actionConfigJson.trim() ? JSON.parse(actionConfigJson) : {};
    } catch {
      toast.error('Configuración de acción no es JSON válido');
      return;
    }
    let parsedRateLimit: unknown = null;
    if (rateLimitJson.trim()) {
      try {
        parsedRateLimit = JSON.parse(rateLimitJson);
      } catch {
        toast.error('Rate limit no es JSON válido');
        return;
      }
    }

    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      match_pattern: matchPattern.trim(),
      severity_min: severityMin || undefined,
      condition: parsedCondition,
      action_type: actionType,
      action_config: parsedActionConfig,
      rate_limit: parsedRateLimit,
      enabled,
    };

    if (!body.name) { toast.error('El nombre es obligatorio'); return; }
    if (!body.match_pattern) { toast.error('El patrón es obligatorio'); return; }

    setSaving(true);
    try {
      if (trigger) {
        await api.patch(`/event-triggers/${trigger.id}`, body);
        toast.success('Trigger actualizado');
      } else {
        await api.post('/event-triggers', body);
        toast.success('Trigger creado');
      }
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`No se pudo guardar: ${message}`);
    } finally {
      setSaving(false);
    }
  }, [name, description, matchPattern, severityMin, conditionJson, actionType, actionConfigJson, rateLimitJson, enabled, trigger, onSaved]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{trigger ? 'Editar trigger' : 'Nuevo trigger'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="alert-suspicious-login" />
          </Field>

          <Field label="Descripción (opcional)">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué hace este trigger" />
          </Field>

          <Field label="Patrón de evento (glob)" hint="Ejemplos: auth.login.failed · lifecycle.service.* · system.error.** · **">
            <Input value={matchPattern} onChange={(e) => setMatchPattern(e.target.value)} placeholder="auth.login.failed" />
          </Field>

          <Field label="Severidad mínima (opcional)" hint="Solo dispara si severity >= floor">
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={severityMin}
              onChange={(e) => setSeverityMin(e.target.value as EventSeverity | '')}
            >
              <option value="">— sin filtro —</option>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Condición (JSONLogic, vacío = siempre matchea)" hint='Ej. {"==": [{"var": "reason"}, "suspended"]}'>
            <textarea
              className="w-full font-mono text-xs rounded-md border bg-background px-3 py-2 min-h-[6rem]"
              value={conditionJson}
              onChange={(e) => setConditionJson(e.target.value)}
              placeholder={CONDITION_PLACEHOLDER}
              spellCheck={false}
            />
          </Field>

          <Field label="Acción">
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionType)}
            >
              {(meta?.action_types ?? ['flow.start','event.emit','push.send','webhook.call','audit.persist']).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Configuración de la acción (JSON)"
            hint={actionFields ? actionFields.map((f) => `${f.name}${f.required ? '*' : ''}: ${f.type}`).join(' · ') : 'Cargando…'}
          >
            <textarea
              className="w-full font-mono text-xs rounded-md border bg-background px-3 py-2 min-h-[6rem]"
              value={actionConfigJson}
              onChange={(e) => setActionConfigJson(e.target.value)}
              spellCheck={false}
            />
          </Field>

          <Field label="Rate limit (opcional, vacío = sin límite)" hint='Ej. {"max": 1, "window_ms": 3600000} → máximo 1 vez por hora'>
            <textarea
              className="w-full font-mono text-xs rounded-md border bg-background px-3 py-2 min-h-[4rem]"
              value={rateLimitJson}
              onChange={(e) => setRateLimitJson(e.target.value)}
              placeholder='{"max": 5, "window_ms": 60000}'
              spellCheck={false}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Activo (puede dispararse)
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Guardando…' : (trigger ? 'Guardar cambios' : 'Crear trigger')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
