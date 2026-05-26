/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Activity Center — Settings modal. Four sections:
 *   1. Storage & Retention — budget MB input + read-only split table.
 *   2. Notifications — built-in rule switches with editable thresholds.
 *   3. Backup & Export — NDJSON export links for events + raw logs.
 *   4. Privacy & GDPR — self-export + erasure (admin only).
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import {
  getActivitySettings,
  setActivityBudget,
  getNotificationRules,
  patchNotificationRule,
  resetNotificationRule,
} from '@/services/activity.service';
import type { ActivityBudget, BuiltinRule } from '@/services/activity.service';

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatMB(mb: number): string {
  return `${mb.toFixed(1)} MB`;
}

const BUDGET_MIN = 10;
const BUDGET_MAX = 10_240;

export function ActivitySettingsModal({ open, onClose }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const [budget, setBudget] = useState<ActivityBudget | null>(null);
  const [budgetInput, setBudgetInput] = useState<string>('');
  const [rules, setRules] = useState<BuiltinRule[]>([]);
  const [savingBudget, setSavingBudget] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useMemo(
    () =>
      async () => {
        setLoading(true);
        try {
          const [settings, ruleList] = await Promise.all([
            getActivitySettings(),
            getNotificationRules(),
          ]);
          setBudget(settings.budget);
          setBudgetInput(String(settings.budget.budget_mb));
          setRules(ruleList);
        } catch (err) {
          toast.error(`No se pudo cargar Activity Settings: ${(err as Error).message}`);
        } finally {
          setLoading(false);
        }
      },
    [],
  );

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  async function onSaveBudget() {
    const value = parseInt(budgetInput, 10);
    if (!Number.isFinite(value) || value < BUDGET_MIN || value > BUDGET_MAX) {
      toast.error(`Budget fuera de rango (${BUDGET_MIN}…${BUDGET_MAX} MB)`);
      return;
    }
    setSavingBudget(true);
    try {
      const next = await setActivityBudget(value);
      setBudget(next);
      toast.success(`Budget actualizado a ${value} MB`);
    } catch (err) {
      toast.error(`No se pudo guardar: ${(err as Error).message}`);
    } finally {
      setSavingBudget(false);
    }
  }

  async function onToggleRule(rule: BuiltinRule, enabled: boolean) {
    try {
      await patchNotificationRule(rule.key, { enabled, threshold: rule.threshold });
      setRules((prev) => prev.map((r) => (r.key === rule.key ? { ...r, enabled, overridden: true } : r)));
      toast.success(`${rule.key} ${enabled ? 'activada' : 'desactivada'}`);
    } catch (err) {
      toast.error(`No se pudo guardar: ${(err as Error).message}`);
    }
  }

  async function onChangeThreshold(rule: BuiltinRule, key: string, value: string) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const nextThreshold = { ...rule.threshold, [key]: parsed };
    try {
      await patchNotificationRule(rule.key, { enabled: rule.enabled, threshold: nextThreshold });
      setRules((prev) => prev.map((r) => (r.key === rule.key ? { ...r, threshold: nextThreshold, overridden: true } : r)));
    } catch (err) {
      toast.error(`No se pudo guardar: ${(err as Error).message}`);
    }
  }

  async function onResetRule(rule: BuiltinRule) {
    try {
      await resetNotificationRule(rule.key);
      const next = await getNotificationRules();
      setRules(next);
      toast.success(`${rule.key} restaurada a valores por defecto`);
    } catch (err) {
      toast.error(`No se pudo restaurar: ${(err as Error).message}`);
    }
  }

  // Exports — open in new tab so the browser downloads them directly.
  function exportEvents() {
    if (!userId) return;
    const url = `/api/v1/agent-events/by-user/${encodeURIComponent(userId)}/export`;
    window.open(url, '_blank');
  }

  async function eraseMyEvents() {
    if (!userId) return;
    if (!window.confirm(
      '¿Borrar todos los eventos asociados a tu user_id? Esta acción es irreversible.',
    )) return;
    try {
      await api.patch(`/agent-events/by-user/${encodeURIComponent(userId)}`, {});
      toast.success('Borrado solicitado. Algunos eventos pueden persistir si ya fueron archivados.');
    } catch (err) {
      toast.error(`No se pudo borrar: ${(err as Error).message}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activity Center · Settings</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-6 text-center text-sm text-[var(--text-muted)]">Cargando…</div>
        ) : (
          <div className="space-y-6 py-2">
            {/* ── Storage & Retention ──────────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Storage & Retention</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Presupuesto total:</span>
                <Input
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-24"
                  min={BUDGET_MIN}
                  max={BUDGET_MAX}
                />
                <span className="text-xs text-[var(--text-muted)]">MB</span>
                <Button size="sm" onClick={onSaveBudget} disabled={savingBudget}>
                  {savingBudget ? 'Guardando…' : 'Aplicar'}
                </Button>
              </div>

              {budget && (
                <div className="mt-3 rounded-md border border-[var(--border-base)] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--bg-surface)] text-[var(--text-muted)]">
                      <tr>
                        <th className="text-left px-2 py-1.5">Bucket</th>
                        <th className="text-right px-2 py-1.5">%</th>
                        <th className="text-right px-2 py-1.5">MB</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-[var(--border-subtle)]">
                        <td className="px-2 py-1.5">Events</td>
                        <td className="text-right px-2 py-1.5">40%</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{formatMB(budget.splits.events)}</td>
                      </tr>
                      <tr className="border-t border-[var(--border-subtle)]">
                        <td className="px-2 py-1.5">Gateway</td>
                        <td className="text-right px-2 py-1.5">25%</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{formatMB(budget.splits.gateway)}</td>
                      </tr>
                      <tr className="border-t border-[var(--border-subtle)]">
                        <td className="px-2 py-1.5">Containers</td>
                        <td className="text-right px-2 py-1.5">20%</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{formatMB(budget.splits.containers)}</td>
                      </tr>
                      <tr className="border-t border-[var(--border-subtle)]">
                        <td className="px-2 py-1.5">Core</td>
                        <td className="text-right px-2 py-1.5">15%</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{formatMB(budget.splits.core)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                Los eventos del bus se purgan por política temporal (RETENTION_RULES, Ola 10);
                el presupuesto solo aplica el techo. Los archivos de logs rotan FIFO al 90%
                del cap.
              </p>
            </section>

            {/* ── Notifications — built-in rules ───────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Notifications — reglas built-in</h3>
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.key}
                    className="rounded-md border border-[var(--border-base)] p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{rule.key}</span>
                          {rule.overridden && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
                              override
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1">{rule.description}</p>
                      </div>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => onToggleRule(rule, e.target.checked)}
                        />
                        <span>{rule.enabled ? 'ON' : 'OFF'}</span>
                      </label>
                    </div>

                    {Object.keys(rule.defaults).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {Object.entries(rule.defaults).map(([k, defaultValue]) => {
                          const current = (rule.threshold[k] as number | undefined) ?? (defaultValue as number);
                          return (
                            <label key={k} className="flex items-center gap-1 text-xs">
                              <span className="text-[var(--text-muted)]">{k}</span>
                              <Input
                                type="number"
                                value={String(current)}
                                onChange={(e) => onChangeThreshold(rule, k, e.target.value)}
                                className="w-20 h-7"
                              />
                            </label>
                          );
                        })}
                        {rule.overridden && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onResetRule(rule)}
                            className="h-7"
                          >
                            <RefreshCw size={12} className="mr-1" />
                            Reset
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ── Backup & Export ───────────────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Backup & Export</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={exportEvents} disabled={!userId}>
                  <Download size={14} className="mr-2" />
                  Eventos (mis filas)
                </Button>
                <Button variant="outline" size="sm" disabled title="Próximamente">
                  <Download size={14} className="mr-2" />
                  Gateway logs (raw)
                </Button>
                <Button variant="outline" size="sm" disabled title="Próximamente">
                  <Download size={14} className="mr-2" />
                  Core logs (raw)
                </Button>
                <Button variant="outline" size="sm" disabled title="Próximamente">
                  <Download size={14} className="mr-2" />
                  Containers (zip)
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                El export de eventos se sirve por <code>GET /agent-events/by-user/:id/export</code>
                (admin o self, máx 50k filas por llamada).
              </p>
            </section>

            {/* ── Privacy / GDPR ────────────────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Privacy & GDPR</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={exportEvents} disabled={!userId}>
                  <Download size={14} className="mr-2" />
                  Export my data
                </Button>
                <Button variant="outline" size="sm" onClick={eraseMyEvents} disabled={!userId}>
                  <Trash2 size={14} className="mr-2" />
                  Erase my data
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                El borrado anonimiza el <code>user_id</code> en filas existentes; los
                payloads inalterados. Algunas filas pueden persistir si ya fueron
                archivadas para auditoría regulatoria.
              </p>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
