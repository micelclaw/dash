/** Versioned command-profile editor. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileClock, Layers3, Loader2, Plus, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RetryBanner } from '@/components/settings/shared/RetryBanner';
import {
  createCommandProfile,
  getCommandProfile,
  listCommandProfiles,
  previewCommandProfilePublish,
  publishCommandProfile,
  rollbackCommandProfile,
  updateCommandProfile,
  type CommandProfileDetail,
  type CommandProfileSummary,
  type CommandRuleInput,
  type SecurityExecMode,
  type SecurityExtensionPolicy,
  type SecurityRuleEffect,
} from '@/services/security-policy.service';
import { useAuthStore } from '@/stores/auth.store';

function toRuleInput(rule: CommandProfileDetail['rules'][number]): CommandRuleInput {
  return {
    effect: rule.effect,
    target: rule.target,
    executable_pattern: rule.executable_pattern,
    argument_matcher: rule.argument_matcher,
    cwd_scope: rule.cwd_scope,
    cwd_path: rule.cwd_path,
    category: rule.category,
    description: rule.description,
  };
}

function statusColor(status: string): string {
  if (status === 'published') return '#22c55e';
  if (status === 'draft') return '#f59e0b';
  return 'var(--text-muted)';
}

export function CommandProfilesPanel() {
  const role = useAuthStore((state) => state.user?.role ?? 'user');
  const canEdit = role === 'owner' || role === 'admin';
  const [profiles, setProfiles] = useState<CommandProfileSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommandProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMode, setMaxMode] = useState<SecurityExecMode>('ask');
  const [extensionPolicy, setExtensionPolicy] = useState<SecurityExtensionPolicy>('block_only');
  const [changelog, setChangelog] = useState('');
  const [rules, setRules] = useState<CommandRuleInput[]>([]);
  const [newExecutable, setNewExecutable] = useState('');
  const [newArguments, setNewArguments] = useState('');
  const [newEffect, setNewEffect] = useState<SecurityRuleEffect>('allow');

  const hydrate = (next: CommandProfileDetail) => {
    setDetail(next);
    setName(next.name);
    setDescription(next.description);
    setMaxMode(next.max_exec_mode);
    setExtensionPolicy(next.extension_policy);
    setChangelog(next.draft?.changelog ?? '');
    setRules(next.rules.map(toRuleInput));
  };

  const loadProfiles = useCallback(async (preferredId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await listCommandProfiles();
      setProfiles(next);
      const id = preferredId ?? selectedId ?? next[0]?.id ?? null;
      setSelectedId(id);
      if (id) hydrate(await getCommandProfile(id));
      else setDetail(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load command profiles');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void loadProfiles(); }, []);

  const selectProfile = async (id: string) => {
    setSelectedId(id);
    setLoading(true);
    try {
      hydrate(await getCommandProfile(id));
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const created = await createCommandProfile({
        name: `Command profile ${profiles.length + 1}`,
        description: 'Describe which commands this profile permits or prompts for.',
        max_exec_mode: 'ask',
        extension_policy: 'block_only',
      });
      toast.success('Command profile created');
      await loadProfiles(created.id);
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Could not create profile');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!detail || !canEdit) return;
    setSaving(true);
    try {
      const updated = await updateCommandProfile(detail.id, {
        expected_version: detail.latest_version,
        name,
        description,
        max_exec_mode: maxMode,
        extension_policy: extensionPolicy,
        changelog: changelog || 'Update command rules',
        rules,
      });
      hydrate(updated);
      setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated : profile));
      toast.success('Draft saved');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save profile');
      await loadProfiles(detail.id);
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!detail || !canEdit) return;
    setSaving(true);
    try {
      const preview = await previewCommandProfilePublish(detail.id, detail.latest_version);
      const affected = typeof (preview as { affected_agents?: unknown }).affected_agents === 'number'
        ? ` It affects ${(preview as { affected_agents: number }).affected_agents} agents.`
        : '';
      if (!window.confirm(`Publish v${detail.latest_version}?${affected} Runtime application is reported separately.`)) return;
      const published = await publishCommandProfile(detail.id, detail.latest_version);
      hydrate(published);
      await loadProfiles(published.id);
      toast.success('Command profile published');
    } catch (publishError) {
      toast.error(publishError instanceof Error ? publishError.message : 'Could not publish profile');
    } finally {
      setSaving(false);
    }
  };

  const rollback = async (targetVersion: number) => {
    if (!detail || !canEdit) return;
    if (!window.confirm(`Restore v${targetVersion} as a new published version?`)) return;
    setSaving(true);
    try {
      const restored = await rollbackCommandProfile(detail.id, detail.latest_version, targetVersion);
      hydrate(restored);
      await loadProfiles(restored.id);
      toast.success(`Restored version ${targetVersion}`);
    } catch (rollbackError) {
      toast.error(rollbackError instanceof Error ? rollbackError.message : 'Could not restore profile');
    } finally {
      setSaving(false);
    }
  };

  const addRule = () => {
    const executable = newExecutable.trim();
    if (!executable) return;
    setRules((current) => [...current, {
      effect: newEffect,
      target: 'gateway',
      executable_pattern: executable,
      argument_matcher: { kind: newArguments ? 'prefix' : 'exact', value: newArguments.trim() },
      cwd_scope: 'agent_workspace',
      cwd_path: null,
      description: '',
    }]);
    setNewExecutable('');
    setNewArguments('');
  };

  const selectedSummary = useMemo(() => profiles.find((profile) => profile.id === selectedId) ?? null, [profiles, selectedId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><Layers3 size={19} className="text-[var(--amber)]" />Command profiles</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">Versioned command rules. Publishing updates desired state; runtime application is verified independently.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadProfiles(selectedId ?? undefined)} disabled={loading}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh</Button>
          {canEdit && <Button type="button" size="sm" onClick={() => void createProfile()} disabled={saving}><Plus size={13} />New profile</Button>}
        </div>
      </div>

      {error && <RetryBanner severity="error" title="Profiles unavailable" message={error} onRetry={() => void loadProfiles()} loading={loading} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
        <aside className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2" aria-label="Command profiles">
          {profiles.length === 0 && !loading ? (
            <div className="p-4 text-sm text-[var(--text-muted)]">No command profiles</div>
          ) : profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => void selectProfile(profile.id)}
              aria-current={selectedId === profile.id ? 'true' : undefined}
              className={`mb-1 w-full rounded-[var(--radius-sm)] border-0 p-3 text-left ${selectedId === profile.id ? 'bg-[var(--surface-hover)]' : 'bg-transparent hover:bg-[var(--card)]'}`}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)]">{profile.name}</span>
                <span className="text-[10px] font-semibold uppercase" style={{ color: statusColor(profile.status) }}>{profile.status}</span>
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">v{profile.latest_version} · max {profile.max_exec_mode}</div>
            </button>
          ))}
        </aside>

        <main className="min-w-0">
          {loading && !detail ? (
            <div className="flex items-center gap-2 py-12 text-sm text-[var(--text-muted)]"><Loader2 size={15} className="animate-spin" />Loading profile…</div>
          ) : !detail ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">Select or create a profile.</div>
          ) : (
            <div className="space-y-4">
              <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    {detail.status === 'published' ? <CheckCircle2 size={14} className="text-green-500" /> : <FileClock size={14} className="text-[var(--amber)]" />}
                    {selectedSummary?.builtin ? `Built-in · ${selectedSummary.builtin}` : 'Custom profile'} · latest v{detail.latest_version} · published v{detail.published_version || '—'}
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => void save()} disabled={saving}><Save size={13} />Save draft</Button>
                      {detail.draft && <Button type="button" size="sm" onClick={() => void publish()} disabled={saving}><Upload size={13} />Publish v{detail.draft.version}</Button>}
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-xs font-medium text-[var(--text-dim)]">Name<input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} className="mt-2 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" /></label>
                  <label className="text-xs font-medium text-[var(--text-dim)]">Maximum execution mode<select value={maxMode} onChange={(event) => setMaxMode(event.target.value as SecurityExecMode)} disabled={!canEdit} className="mt-2 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]">{(['deny', 'allowlist', 'ask', 'auto'] as const).map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
                  <label className="text-xs font-medium text-[var(--text-dim)] md:col-span-2">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canEdit} rows={2} className="mt-2 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--text)]" /></label>
                  <label className="text-xs font-medium text-[var(--text-dim)]">Local extension policy<select value={extensionPolicy} onChange={(event) => setExtensionPolicy(event.target.value as SecurityExtensionPolicy)} disabled={!canEdit} className="mt-2 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]"><option value="none">No local rules</option><option value="block_only">Block/prompt only</option><option value="allow_unprotected">Allow unprotected extensions</option></select></label>
                  <label className="text-xs font-medium text-[var(--text-dim)]">Draft changelog<input value={changelog} onChange={(event) => setChangelog(event.target.value)} disabled={!canEdit} className="mt-2 h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text)]" /></label>
                </div>
              </section>

              <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="command-rules-title">
                <div className="flex items-center justify-between gap-3"><div><h3 id="command-rules-title" className="m-0 text-sm font-semibold text-[var(--text)]">Rules ({rules.length})</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Structured executable, arguments and workspace scope; protected categories cannot be allowlisted.</p></div></div>
                {canEdit && (
                  <div className="mt-4 grid gap-2 rounded-[var(--radius-sm)] bg-[var(--card)] p-3 sm:grid-cols-[120px_minmax(130px,1fr)_minmax(150px,1fr)_auto]">
                    <select aria-label="Rule effect" value={newEffect} onChange={(event) => setNewEffect(event.target.value as SecurityRuleEffect)} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]"><option value="allow">Allow</option><option value="prompt">Prompt</option><option value="block">Block</option></select>
                    <input aria-label="Executable" placeholder="Executable, e.g. git" value={newExecutable} onChange={(event) => setNewExecutable(event.target.value)} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]" />
                    <input aria-label="Argument prefix" placeholder="Argument prefix (optional)" value={newArguments} onChange={(event) => setNewArguments(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addRule(); }} className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]" />
                    <Button type="button" variant="secondary" onClick={addRule} disabled={!newExecutable.trim()}><Plus size={13} />Add</Button>
                  </div>
                )}
                <div className="mt-3 space-y-2">
                  {rules.length === 0 ? <div className="py-6 text-center text-sm text-[var(--text-muted)]">No rules in this version.</div> : rules.map((rule, index) => (
                    <div key={`${rule.executable_pattern}-${rule.argument_matcher.kind}-${index}`} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] p-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${rule.effect === 'allow' ? 'bg-green-500/10 text-green-400' : rule.effect === 'block' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{rule.effect}</span>
                      <code className="min-w-0 flex-1 break-all text-xs text-[var(--text)]">{rule.executable_pattern}{rule.argument_matcher.value ? ` ${rule.argument_matcher.value}` : ''}</code>
                      <span className="text-[11px] text-[var(--text-muted)]">{rule.category ?? 'classified on save'} · {rule.cwd_scope}</span>
                      {canEdit && <button type="button" aria-label={`Remove rule ${rule.executable_pattern}`} onClick={() => setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index))} className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--error)]"><Trash2 size={13} /></button>}
                    </div>
                  ))}
                </div>
              </section>

              {canEdit && detail.versions.some((version) => version.status !== 'draft' && version.version !== detail.published_version) && (
                <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <h3 className="m-0 text-sm font-semibold text-[var(--text)]">Version history</h3>
                  <div className="mt-3 flex flex-wrap gap-2">{detail.versions.filter((version) => version.status !== 'draft' && version.version !== detail.published_version).map((version) => <Button key={version.id} type="button" size="sm" variant="outline" onClick={() => void rollback(version.version)} disabled={saving}><RefreshCw size={12} />Restore v{version.version}</Button>)}</div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
