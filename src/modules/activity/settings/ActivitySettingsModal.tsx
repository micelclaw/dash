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
  DialogDescription,
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
  updateNotificationRule,
  resetNotificationRule,
} from '@/services/activity.service';
import type { ActivityBudget, BuiltinRule } from '@/services/activity.service';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();
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
          toast.error(t('activity.loadFailed', { message: (err as Error).message }));
        } finally {
          setLoading(false);
        }
      },
    [t],
  );

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  async function onSaveBudget() {
    const value = parseInt(budgetInput, 10);
    if (!Number.isFinite(value) || value < BUDGET_MIN || value > BUDGET_MAX) {
      toast.error(t('activity.budgetOutOfRange', { min: BUDGET_MIN, max: BUDGET_MAX }));
      return;
    }
    setSavingBudget(true);
    try {
      const next = await setActivityBudget(value);
      setBudget(next);
      toast.success(t('activity.budgetUpdated', { value }));
    } catch (err) {
      toast.error(t('activity.saveFailed', { message: (err as Error).message }));
    } finally {
      setSavingBudget(false);
    }
  }

  async function onToggleRule(rule: BuiltinRule, enabled: boolean) {
    try {
      await updateNotificationRule(rule.key, { enabled, threshold: rule.threshold });
      setRules((prev) => prev.map((r) => (r.key === rule.key ? { ...r, enabled, overridden: true } : r)));
      toast.success(t(enabled ? 'activity.ruleEnabled' : 'activity.ruleDisabled', { rule: rule.key }));
    } catch (err) {
      toast.error(t('activity.saveFailed', { message: (err as Error).message }));
    }
  }

  async function onChangeThreshold(rule: BuiltinRule, key: string, value: string) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const nextThreshold = { ...rule.threshold, [key]: parsed };
    try {
      await updateNotificationRule(rule.key, { enabled: rule.enabled, threshold: nextThreshold });
      setRules((prev) => prev.map((r) => (r.key === rule.key ? { ...r, threshold: nextThreshold, overridden: true } : r)));
    } catch (err) {
      toast.error(t('activity.saveFailed', { message: (err as Error).message }));
    }
  }

  async function onResetRule(rule: BuiltinRule) {
    try {
      await resetNotificationRule(rule.key);
      const next = await getNotificationRules();
      setRules(next);
      toast.success(t('activity.budgetRestored'));
    } catch (err) {
      toast.error(t('activity.saveFailed', { message: (err as Error).message }));
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
      t('activity.eraseConfirm'),
    )) return;
    try {
      await api.patch(`/agent-events/by-user/${encodeURIComponent(userId)}`, {});
      toast.success(t('activity.eraseRequested'));
    } catch (err) {
      toast.error(t('activity.deleteFailed', { message: (err as Error).message }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('activity.settingsTitle')}</DialogTitle>
          <DialogDescription>
            {t('activity.settingsDescription')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="p-6 text-center text-sm text-[var(--text-muted)]">{t('activity.loading')}</div>
        ) : (
          <div className="space-y-6 py-2">
            {/* ── Storage & Retention ──────────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2">{t('activity.storageRetention')}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">{t('activity.totalBudget')}</span>
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
                  {savingBudget ? t('activity.saving') : t('activity.apply')}
                </Button>
              </div>

              {budget && (
                <div className="mt-3 rounded-md border border-[var(--border)] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--surface)] text-[var(--text-muted)]">
                      <tr>
                        <th className="text-left px-2 py-1.5">{t('activity.bucket')}</th>
                        <th className="text-right px-2 py-1.5">%</th>
                        <th className="text-right px-2 py-1.5">MB</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-[var(--border)]">
                        <td className="px-2 py-1.5">{t('activity.eventsBucket')}</td>
                        <td className="text-right px-2 py-1.5">40%</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{formatMB(budget.splits.events)}</td>
                      </tr>
                      <tr className="border-t border-[var(--border)]">
                        <td className="px-2 py-1.5">{t('activity.gatewayBucket')}</td>
                        <td className="text-right px-2 py-1.5">25%</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{formatMB(budget.splits.gateway)}</td>
                      </tr>
                      <tr className="border-t border-[var(--border)]">
                        <td className="px-2 py-1.5">{t('activity.containersBucket')}</td>
                        <td className="text-right px-2 py-1.5">20%</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{formatMB(budget.splits.containers)}</td>
                      </tr>
                      <tr className="border-t border-[var(--border)]">
                        <td className="px-2 py-1.5">{t('activity.coreBucket')}</td>
                        <td className="text-right px-2 py-1.5">15%</td>
                        <td className="text-right px-2 py-1.5 tabular-nums">{formatMB(budget.splits.core)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                {t('activity.retentionHelp')}
              </p>
            </section>

            {/* ── Notifications — built-in rules ───────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2">{t('activity.notificationRules')}</h3>
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.key}
                    className="rounded-md border border-[var(--border)] p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{rule.key}</span>
                          {rule.overridden && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
                              {t('activity.override')}
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
                        <span>{rule.enabled ? t('activity.on') : t('activity.off')}</span>
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
                            {t('activity.reset')}
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
              <h3 className="text-sm font-semibold mb-2">{t('activity.backupExport')}</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={exportEvents} disabled={!userId}>
                  <Download size={14} className="mr-2" />
                  {t('activity.exportEvents')}
                </Button>
                <Button variant="outline" size="sm" disabled title={t('activity.comingSoon')}>
                  <Download size={14} className="mr-2" />
                  {t('activity.gatewayLogsRaw')}
                </Button>
                <Button variant="outline" size="sm" disabled title={t('activity.comingSoon')}>
                  <Download size={14} className="mr-2" />
                  {t('activity.coreLogsRaw')}
                </Button>
                <Button variant="outline" size="sm" disabled title={t('activity.comingSoon')}>
                  <Download size={14} className="mr-2" />
                  {t('activity.containersZip')}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                {t('activity.exportHelp')}
              </p>
            </section>

            {/* ── Privacy / GDPR ────────────────────────────────────── */}
            <section>
              <h3 className="text-sm font-semibold mb-2">{t('activity.privacy')}</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={exportEvents} disabled={!userId}>
                  <Download size={14} className="mr-2" />
                  {t('activity.exportMyData')}
                </Button>
                <Button variant="outline" size="sm" onClick={eraseMyEvents} disabled={!userId}>
                  <Trash2 size={14} className="mr-2" />
                  {t('activity.eraseMyData')}
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                {t('activity.eraseHelp')}
              </p>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>{t('activity.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
