/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, MoonStar, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';
import { useIsMobile } from '@/hooks/use-media-query';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatRelativeTime } from '../shared/format';
import { parseDreamDiary } from './parseDreamDiary';
import { SignalBadge, dreamCard, dimText, dreamBtn, sectionTitle, toIso, isRecent } from './shared';
import type { DreamDiaryResponse, DreamSignalEntry, DreamingStatus, RemHarness } from './types';

type SortMode = 'backing' | 'recent';

interface Props {
  agentName: string;
  status: DreamingStatus | undefined;
  diary: DreamDiaryResponse | null;
  rem: RemHarness | null;
  remLoading: boolean;
  busy: string | null;
  onLoadRem: () => void;
  onMaintenance: (action: string, label: string) => void;
}

// Acciones de mantenimiento (snake_case = whitelist del backend).
const MAINTENANCE: { action: string; label: string; desc: string; destructive?: boolean }[] = [
  { action: 'backfill_dream_diary', label: 'Rellenar diario', desc: 'Reconstruye el Dream Diary desde el registro diario. No toca MEMORY.md.' },
  { action: 'repair_dreaming_artifacts', label: 'Reparar caché de sueños', desc: 'Archiva y repara artefactos de dreaming corruptos o incompletos.' },
  { action: 'dedupe_dream_diary', label: 'Deduplicar diario', desc: 'Elimina entradas repetidas del Dream Diary.' },
  { action: 'reset_dream_diary', label: 'Restablecer diario', desc: 'Quita las entradas de relleno del diario (se regeneran en el próximo barrido).', destructive: true },
  { action: 'reset_grounded_short_term', label: 'Borrar grounded', desc: 'Vacía los candidatos "grounded" de la memoria a corto plazo.', destructive: true },
];

const MAINTENANCE_MESSAGES: Record<string, { label: string; description: string }> = {
  backfill_dream_diary: { label: 'dreams.maintenance.backfill.label', description: 'dreams.maintenance.backfill.description' },
  repair_dreaming_artifacts: { label: 'dreams.maintenance.repair.label', description: 'dreams.maintenance.repair.description' },
  dedupe_dream_diary: { label: 'dreams.maintenance.dedupe.label', description: 'dreams.maintenance.dedupe.description' },
  reset_dream_diary: { label: 'dreams.maintenance.resetDiary.label', description: 'dreams.maintenance.resetDiary.description' },
  reset_grounded_short_term: { label: 'dreams.maintenance.resetGrounded.label', description: 'dreams.maintenance.resetGrounded.description' },
};

export function DreamAdvanced({ agentName, status, diary, rem, remLoading, busy, onLoadRem, onMaintenance }: Props) {
  const { t, locale } = useI18n();
  const isMobile = useIsMobile();
  const s = status ?? {};
  const [sort, setSort] = useState<SortMode>('backing');
  const [confirm, setConfirm] = useState<{ action: string; label: string; labelKey: string } | null>(null);

  useEffect(() => { onLoadRem(); }, [onLoadRem]);

  const deepSleep = parseDreamDiary(diary?.content).deep_sleep;

  const signalEntries = [...(s.signal_entries ?? [])].sort((a, b) => {
    if (sort === 'backing') return (b.total_signal_count ?? 0) - (a.total_signal_count ?? 0);
    return ts(b.last_recalled_at) - ts(a.last_recalled_at);
  });

  const statCell = (value: string | number, label: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: isMobile ? 0 : 110 }}>
      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>{value}</span>
      <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Franja de stats */}
      <div style={dreamCard}>
        <div style={{ display: isMobile ? 'grid' : 'flex', gridTemplateColumns: '1fr 1fr', flexWrap: 'wrap', gap: isMobile ? 12 : 24 }}>
          {statCell(s.daily_signal_count ?? 0, t('dreams.advanced.stats.daily'))}
          {statCell(s.total_signal_count ?? 0, t('dreams.advanced.stats.waiting'))}
          {statCell(s.promoted_today ?? 0, t('dreams.advanced.stats.promotedToday'))}
          {statCell(s.promoted_total ?? 0, t('dreams.advanced.stats.promotedTotal'))}
        </div>
        <div style={{ ...dimText, fontSize: '0.66rem' }}>
          {s.last_promoted_at && <>{t('dreams.advanced.lastPromoted', { time: formatRelativeTime(toIso(s.last_promoted_at), locale) })} · </>}
          {t('dreams.advanced.storage')} {s.storage_mode ?? '—'}{s.timezone ? ` · ${s.timezone}` : ''}
        </div>
      </div>

      {/* Del registro diario (grounded replay) */}
      <div style={dreamCard}>
        <span style={sectionTitle}>{t('dreams.advanced.dailyLog.title')}</span>
        <span style={{ ...dimText, fontSize: '0.66rem' }}>{t('dreams.advanced.dailyLog.description')}</span>
        <EntryList entries={s.short_term_entries ?? []} emptyKey="dreams.advanced.dailyLog.empty" />
      </div>

      {/* Esperando promoción */}
      <div style={dreamCard}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={sectionTitle}>{t('dreams.advanced.waiting.title')}</span>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
            {(['backing', 'recent'] as SortMode[]).map(m => (
              <button key={m} onClick={() => setSort(m)}
                style={{
                  padding: isMobile ? '7px 11px' : '4px 10px', border: 'none', cursor: 'pointer', fontSize: '0.66rem',
                  background: sort === m ? 'var(--bg-subtle, rgba(127,127,127,0.14))' : 'transparent',
                  color: sort === m ? 'var(--text)' : 'var(--text-dim)', fontWeight: sort === m ? 600 : 400,
                  borderLeft: m === 'recent' ? '1px solid var(--border)' : 'none',
                }}>{t(m === 'backing' ? 'dreams.advanced.sort.backing' : 'dreams.advanced.sort.recent')}</button>
            ))}
          </div>
        </div>
        <span style={{ ...dimText, fontSize: '0.66rem' }}>{t('dreams.advanced.waiting.description', { shown: signalEntries.length, total: s.total_signal_count ?? 0 })}</span>
        <EntryList entries={signalEntries} emptyKey="dreams.advanced.waiting.empty" />
      </div>

      {/* Promovidos + Deep Sleep */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div style={{ ...dreamCard, flex: 1, minWidth: 0 }}>
          <span style={sectionTitle}>{t('dreams.advanced.promoted.title')}</span>
          <EntryList entries={s.promoted_entries ?? []} emptyKey="dreams.advanced.promoted.empty" promoted />
        </div>
        <div style={{ ...dreamCard, flex: 1, minWidth: 0 }}>
          <span style={sectionTitle}><MoonStar size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />{t('dreams.advanced.deepSleep.title')}</span>
          {deepSleep.length === 0
            ? <span style={dimText}>{t('dreams.advanced.deepSleep.empty')}</span>
            : deepSleep.map((b, i) => <span key={i} style={{ fontSize: '0.74rem', color: 'var(--text)', lineHeight: 1.5 }}>• {b}</span>)}
        </div>
      </div>

      {/* Ensayo REM (preview) */}
      <div style={dreamCard}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={sectionTitle}>{t('dreams.advanced.rem.title')}</span>
          <span style={{ fontSize: '0.64rem', color: 'var(--warning)', border: '1px solid var(--warning)', borderRadius: 999, padding: '1px 8px' }}>⚠ {t('dreams.advanced.rem.warning')}</span>
        </div>
        {remLoading ? (
          <span style={{ ...dimText, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Loader2 size={13} className="animate-spin" /> {t('dreams.advanced.rem.loading')}</span>
        ) : rem?.ok ? (
          <span style={dimText}>
            {t('dreams.advanced.rem.reflections', { count: rem.rem?.reflections?.length ?? 0 })} · {t('dreams.advanced.rem.truths', { count: rem.rem?.candidate_truths?.length ?? 0 })} ·{' '}
            {t('dreams.advanced.rem.deepCandidates', { count: rem.deep?.candidates?.length ?? 0 })}{typeof rem.deep_config?.min_score === 'number' ? ` ${t('dreams.advanced.rem.minScore', { score: rem.deep_config.min_score })}` : ''}
            {' — '}{t('dreams.advanced.rem.details')}
          </span>
        ) : (
          <span style={dimText}>{t('dreams.advanced.rem.noData')}</span>
        )}
      </div>

      {/* Mantenimiento */}
      <div style={dreamCard}>
        <span style={sectionTitle}><Wrench size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />{t('dreams.advanced.maintenance.title')}</span>
        <span style={{ ...dimText, fontSize: '0.66rem' }}>{t('dreams.advanced.maintenance.description', { agentName })}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MAINTENANCE.map(m => (
            <div key={m.action} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text)', fontWeight: 500 }}>{t(MAINTENANCE_MESSAGES[m.action]!.label)}</div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)' }}>{t(MAINTENANCE_MESSAGES[m.action]!.description)}</div>
              </div>
              <button
                onClick={() => m.destructive ? setConfirm({ action: m.action, label: m.label, labelKey: MAINTENANCE_MESSAGES[m.action]!.label }) : onMaintenance(m.action, m.label)}
                disabled={busy !== null}
                style={{ ...dreamBtn(m.destructive ? 'var(--error)' : undefined), flexShrink: 0 }}>
                {busy === m.action ? <Loader2 size={12} className="animate-spin" /> : null} {t('dreams.advanced.maintenance.run')}
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => { if (confirm) onMaintenance(confirm.action, confirm.label); }}
        title={confirm ? t(confirm.labelKey) : ''}
        description={t('dreams.diary.confirm.description', { agentName })}
        confirmLabel={t('dreams.diary.confirm.execute')}
        cancelLabel={t('dreams.diary.confirm.cancel')}
        variant="warning"
      />
    </div>
  );
}

function ts(v: string | number | undefined | null): number {
  const iso = toIso(v);
  return iso ? new Date(iso).getTime() : 0;
}

function EntryList({ entries, emptyKey, promoted }: { entries: DreamSignalEntry[]; emptyKey: string; promoted?: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (entries.length === 0) return <span style={dimText}>{t(emptyKey)}</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.map(e => {
        const live = !promoted && isRecent(e.last_recalled_at);
        const loc = `${e.path}${typeof e.start_line === 'number' ? `:${e.start_line}` : ''}`;
        const expanded = !!open[e.key];
        return (
          <div key={e.key} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-subtle, rgba(127,127,127,0.05))', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              {live && (
                <span style={{ flexShrink: 0, marginTop: 2, fontSize: '0.58rem', fontWeight: 700, color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 4, padding: '0px 5px', letterSpacing: '0.05em' }}>{t('dreams.advanced.signal.live')}</span>
              )}
              <button onClick={() => setOpen(x => ({ ...x, [e.key]: !x[e.key] }))}
                style={{
                  flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                  fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.5,
                  ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }),
                }}>
                {e.snippet}
              </button>
              <span style={{ flexShrink: 0, color: 'var(--text-muted)', marginTop: 2 }}>
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
              <button
                title={t('dreams.advanced.signal.copyPath')}
                onClick={() => { void navigator.clipboard?.writeText(loc); toast.success(t('dreams.advanced.signal.pathCopied')); }}
                style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {loc}
              </button>
              <span style={{ flex: 1 }} />
              {(e.total_signal_count ?? 0) > 0 && <SignalBadge>{t('dreams.advanced.signal.count', { count: e.total_signal_count ?? 0 })}</SignalBadge>}
              {(e.daily_count ?? 0) > 0 && <SignalBadge>{t('dreams.advanced.signal.daily', { count: e.daily_count ?? 0 })}</SignalBadge>}
              {(e.grounded_count ?? 0) > 0 && <SignalBadge>{t('dreams.advanced.signal.grounded', { count: e.grounded_count ?? 0 })}</SignalBadge>}
              {(e.phase_hit_count ?? 0) > 0 && <SignalBadge>{t('dreams.advanced.signal.phaseHit', { count: e.phase_hit_count ?? 0 })}</SignalBadge>}
              {(e.light_hits ?? 0) > 0 && <SignalBadge color="var(--warning)">☀ {e.light_hits}</SignalBadge>}
              {(e.rem_hits ?? 0) > 0 && <SignalBadge color="var(--amber)">🌙 {e.rem_hits}</SignalBadge>}
              {promoted && e.promoted_at && <SignalBadge color="var(--success)">{t('dreams.advanced.signal.promoted', { time: formatRelativeTime(toIso(e.promoted_at), locale) })}</SignalBadge>}
              {!promoted && e.last_recalled_at && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{formatRelativeTime(toIso(e.last_recalled_at), locale)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
