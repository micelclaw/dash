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

import { useEffect, useMemo, useState } from 'react';
import { Archive, BookOpen, Brain, ChevronDown, ChevronRight, Copy as CopyIcon, Loader2, Moon, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useIsMobile } from '@/hooks/use-media-query';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatRelativeTime } from '../shared/format';
import { parseDreamDiary, groupByDay } from './parseDreamDiary';
import { dreamCard, dimText, dreamBtn, sectionTitle } from './shared';
import type { DreamDiaryResponse, DreamEntry, RemHarness, WikiPayload, WikiStatus } from './types';

type DiarySegment = 'dreams' | 'reflections' | 'insights' | 'palace';

interface Props {
  agentName: string;
  diary: DreamDiaryResponse | null;
  rem: RemHarness | null;
  remLoading: boolean;
  wikiStatus: WikiStatus | null;
  wikiInsights: WikiPayload;
  wikiPalace: WikiPayload;
  wikiLoading: boolean;
  busy: string | null;
  onLoadRem: () => void;
  onLoadWiki: () => void;
  onEnableWiki: () => void;
  onMaintenance: (action: string, label: string) => void;
}

const epochIso = (ms?: number) => (ms ? new Date(ms).toISOString() : null);

export function DreamDiary(props: Props) {
  const { agentName, diary, rem, remLoading, wikiStatus, wikiInsights, wikiPalace, wikiLoading, busy, onLoadRem, onLoadWiki, onEnableWiki, onMaintenance } = props;
  const { t, locale } = useI18n();
  const isMobile = useIsMobile();
  const [segment, setSegment] = useState<DiarySegment>('dreams');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [confirm, setConfirm] = useState<{ action: string; label: string; labelKey: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const parsed = useMemo(() => parseDreamDiary(diary?.content), [diary?.content]);
  const days = useMemo(() => groupByDay(parsed.entries), [parsed.entries]);
  const backfillCount = parsed.entries.filter(e => e.backfill).length;

  const activeDay = (selectedDay && days.some(d => d.day_key === selectedDay))
    ? selectedDay
    : (days[0]?.day_key ?? null);
  const dayGroup = days.find(d => d.day_key === activeDay);

  // Lazy-load de las fuentes de cada segmento
  useEffect(() => {
    if (segment === 'reflections') onLoadRem();
    if (segment === 'insights' || segment === 'palace') onLoadWiki();
  }, [segment, onLoadRem, onLoadWiki]);

  const seg = (key: DiarySegment, label: string) => (
    <button key={key} onClick={() => setSegment(key)}
      style={{
        padding: isMobile ? '8px 12px' : '5px 12px', minHeight: isMobile ? 40 : undefined,
        border: 'none', borderBottom: `2px solid ${segment === key ? 'var(--amber)' : 'transparent'}`,
        background: 'transparent', color: segment === key ? 'var(--text)' : 'var(--text-dim)',
        fontSize: '0.74rem', fontWeight: segment === key ? 600 : 400, cursor: 'pointer',
      }}>{label}</button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header del diario */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <BookOpen size={14} color="var(--amber)" />
        <span style={{ fontSize: '0.76rem', color: 'var(--text)', fontWeight: 600 }}>{diary?.path ?? 'DREAMS.md'}</span>
        {diary?.updated_at_ms && <span style={dimText}>{t('dreams.diary.updated', { time: formatRelativeTime(epochIso(diary.updated_at_ms), locale) })}</span>}
        {parsed.parse_ok && (
          <span style={dimText}>
            · {t(`dreams.diary.entries.${parsed.entries.length === 1 ? 'one' : 'other'}`, { count: parsed.entries.length })}
            {backfillCount > 0 ? ` ${t('dreams.diary.backfillCount', { count: backfillCount })}` : ''}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setConfirm({ action: 'backfill_dream_diary', label: 'Rellenar diario', labelKey: 'dreams.diary.confirm.backfill' })} disabled={busy !== null} style={dreamBtn()}>
            {busy === 'backfill_dream_diary' ? <Loader2 size={12} className="animate-spin" /> : null} {t('dreams.diary.action.backfill')}
          </button>
          <button onClick={() => setConfirm({ action: 'dedupe_dream_diary', label: 'Deduplicar diario', labelKey: 'dreams.diary.confirm.dedupe' })} disabled={busy !== null} style={dreamBtn()}>
            {busy === 'dedupe_dream_diary' ? <Loader2 size={12} className="animate-spin" /> : null} {t('dreams.diary.action.dedupe')}
          </button>
          <button onClick={() => setShowRaw(v => !v)} style={dreamBtn(showRaw ? 'var(--amber)' : undefined)}>{t(showRaw ? 'dreams.diary.action.showParsed' : 'dreams.diary.action.viewRaw')}</button>
        </div>
      </div>

      {/* Segmentos */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {seg('dreams', t('dreams.diary.tab.dreams'))}
        {seg('reflections', t('dreams.diary.tab.reflections'))}
        {seg('insights', t('dreams.diary.tab.insights'))}
        {seg('palace', t('dreams.diary.tab.palace'))}
      </div>

      {showRaw ? (
        <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: '0.7rem', whiteSpace: 'pre-wrap', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
          {diary?.found && diary.content ? diary.content : t('dreams.diary.noContent')}
        </div>
      ) : segment === 'dreams' ? (
        !diary?.found || (!parsed.parse_ok && !diary.content) ? (
          <EmptyDiary agentName={agentName} onBackfill={() => setConfirm({ action: 'backfill_dream_diary', label: 'Rellenar diario', labelKey: 'dreams.diary.confirm.backfill' })} />
        ) : !parsed.parse_ok ? (
          // Contenido presente pero no parseable → blob honesto
          <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: '0.7rem', whiteSpace: 'pre-wrap', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
            {diary.content}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
            {/* Rail / strip de días */}
            {isMobile ? (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
                {days.map(d => (
                  <button key={d.day_key} onClick={() => setSelectedDay(d.day_key)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, minHeight: 38,
                      padding: '6px 11px', borderRadius: 999, cursor: 'pointer',
                      border: `1px solid ${d.day_key === activeDay ? 'var(--amber)' : 'var(--border)'}`,
                      background: d.day_key === activeDay ? 'var(--bg-subtle, rgba(127,127,127,0.12))' : 'transparent',
                      color: d.day_key === activeDay ? 'var(--text)' : 'var(--text-dim)', fontSize: '0.72rem',
                    }}>
                    <Moon size={10} /> {d.label} <b>{d.entries.length}</b>{d.has_backfill && <Archive size={10} style={{ opacity: 0.6 }} />}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
                {days.map(d => {
                  const on = d.day_key === activeDay;
                  return (
                    <button key={d.day_key} onClick={() => setSelectedDay(d.day_key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8,
                        border: 'none', textAlign: 'left', cursor: 'pointer',
                        background: on ? 'var(--bg-subtle, rgba(127,127,127,0.10))' : 'transparent',
                      }}>
                      <Moon size={11} color={on ? 'var(--amber)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '0.74rem', color: on ? 'var(--text)' : 'var(--text-dim)', fontWeight: on ? 600 : 400 }}>{d.label}</span>
                      {d.has_backfill && <Archive size={10} style={{ color: 'var(--text-muted)' }} />}
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{d.entries.length}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Panel de lectura */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: isMobile ? undefined : 480, overflowY: isMobile ? undefined : 'auto' }}>
              {(dayGroup?.entries ?? []).map(e => (
                <DiaryEntryCard key={e.id} entry={e}
                  expanded={!!expanded[e.id]}
                  onToggle={() => setExpanded(x => ({ ...x, [e.id]: !x[e.id] }))} />
              ))}
              {(dayGroup?.entries.length ?? 0) === 0 && <div style={{ ...dimText, padding: 16 }}>{t('dreams.diary.noEntries')}</div>}
            </div>
          </div>
        )
      ) : segment === 'reflections' ? (
        <ReflectionsPanel rem={rem} loading={remLoading} />
      ) : (
        <WikiPanel kind={segment} status={wikiStatus} data={segment === 'insights' ? wikiInsights : wikiPalace} loading={wikiLoading} onEnable={onEnableWiki} />
      )}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => { if (confirm) onMaintenance(confirm.action, confirm.label); }}
        title={confirm ? t(confirm.labelKey) : ''}
        description={t('dreams.diary.confirm.description', { agentName })}
        confirmLabel={t('dreams.diary.confirm.execute')}
        cancelLabel={t('dreams.diary.confirm.cancel')}
      />
    </div>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function DiaryEntryCard({ entry, expanded, onToggle }: { entry: DreamEntry; expanded: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const clamp = entry.fragment && !expanded;
  return (
    <div style={{ ...dreamCard, gap: 6, padding: '12px 14px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: 'var(--text-dim)' }}>{entry.date_label}</span>
        {entry.backfill && (
          <span title={entry.backfill_source ? t('dreams.diary.entry.backfillSource', { source: entry.backfill_source }) : t('dreams.diary.entry.backfill')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 8px' }}>
            <Archive size={9} /> {t('dreams.diary.entry.backfill')}
          </span>
        )}
        {entry.fragment && (
          <button onClick={onToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 8px', cursor: 'pointer' }}>
            {expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />} {t('dreams.diary.entry.fragment')}
          </button>
        )}
      </div>
      <div style={{
        fontSize: entry.fragment ? '0.7rem' : '0.8rem',
        lineHeight: 1.65,
        color: entry.fragment ? 'var(--text-dim)' : 'var(--text)',
        whiteSpace: 'pre-wrap',
        fontFamily: entry.fragment ? 'var(--font-mono, monospace)' : undefined,
        ...(clamp ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}),
      }}>
        {entry.body}
      </div>
    </div>
  );
}

function EmptyDiary({ agentName, onBackfill }: { agentName: string; onBackfill: () => void }) {
  const { t } = useI18n();
  return (
    <div style={{ ...dreamCard, alignItems: 'center', padding: '36px 20px', gap: 12, textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 90, height: 54 }}>
        <Moon size={30} color="var(--text-muted)" style={{ position: 'absolute', right: 6, top: 0 }} />
        <Sparkles size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 8, top: 8, opacity: 0.6 }} />
        <Sparkles size={11} color="var(--text-muted)" style={{ position: 'absolute', left: 34, bottom: 0, opacity: 0.4 }} />
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', maxWidth: 380 }}>
        {t('dreams.diary.empty', { agentName })}
      </div>
      <button onClick={onBackfill} style={dreamBtn('var(--amber)')}>{t('dreams.diary.emptyAction')}</button>
    </div>
  );
}

function ReflectionsPanel({ rem, loading }: { rem: RemHarness | null; loading: boolean }) {
  const { t } = useI18n();
  if (loading) return <div style={{ ...dimText, display: 'flex', alignItems: 'center', gap: 8, padding: 20 }}><Loader2 size={14} className="animate-spin" /> {t('dreams.diary.reflections.loading')}</div>;
  const reflections = rem?.rem?.reflections ?? [];
  const truths = rem?.rem?.candidate_truths ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: 'var(--warning)', border: '1px solid var(--warning)', borderRadius: 8, padding: '5px 10px', alignSelf: 'flex-start' }}>
        ⚠ {t('dreams.diary.reflections.warning')}
      </div>
      {!rem?.ok ? (
        <div style={{ ...dimText, padding: 12 }}>{t('dreams.diary.reflections.noData')}</div>
      ) : (
        <>
          <div style={dreamCard}>
            <span style={sectionTitle}>{t('dreams.diary.reflections.title', { count: reflections.length })}</span>
            {reflections.length === 0 && <span style={dimText}>{t('dreams.diary.reflections.empty')}</span>}
            {reflections.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.55 }}>
                <Brain size={13} color="var(--amber)" style={{ flexShrink: 0, marginTop: 3 }} /> <span>{r}</span>
              </div>
            ))}
          </div>
          <div style={dreamCard}>
            <span style={sectionTitle}>{t('dreams.diary.truths.title', { count: truths.length })}</span>
            {truths.length === 0 && <span style={dimText}>{t('dreams.diary.truths.empty')}</span>}
            {truths.map((t, i) => {
              const conf = typeof t.confidence === 'number' ? Math.max(0, Math.min(1, t.confidence)) : null;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text)' }}>{t.snippet ?? '—'}</span>
                  {conf !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 220, height: 5, borderRadius: 4, background: 'var(--bg-subtle, rgba(127,127,127,0.15))', overflow: 'hidden' }}>
                        <div style={{ width: `${conf * 100}%`, height: '100%', background: 'var(--amber)' }} />
                      </div>
                      <span style={{ fontSize: '0.64rem', color: 'var(--text-dim)' }}>{conf.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Insights / Memory Palace (extensión memory-wiki) — UI defensiva sobre shapes del plugin. */
function WikiPanel({ kind, status, data, loading, onEnable }: { kind: 'insights' | 'palace'; status: WikiStatus | null; data: WikiPayload; loading: boolean; onEnable: () => void }) {
  const { t } = useI18n();
  const title = t(kind === 'insights' ? 'dreams.diary.wiki.insights' : 'dreams.diary.wiki.palace');
  if (!status?.enabled) {
    return (
      <div style={{ ...dreamCard, alignItems: 'center', padding: '32px 20px', gap: 12, textAlign: 'center' }}>
        <Brain size={26} color="var(--text-muted)" />
        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', maxWidth: 420 }}>
          {t('dreams.diary.wiki.unavailable', { title })}
        </div>
        <button onClick={onEnable} style={dreamBtn('var(--amber)')}>{t('dreams.diary.wiki.enable')}</button>
        <span style={{ ...dimText, fontSize: '0.65rem' }}>{t('dreams.diary.wiki.reloadNotice')}</span>
      </div>
    );
  }
  if (!status.reachable) {
    return (
      <div style={{ ...dreamCard, padding: 20, gap: 8 }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--warning)' }}>{t('dreams.diary.wiki.notLoaded')}</span>
        <span style={dimText}>{t('dreams.diary.wiki.reload')}</span>
      </div>
    );
  }
  if (loading) return <div style={{ ...dimText, display: 'flex', alignItems: 'center', gap: 8, padding: 20 }}><Loader2 size={14} className="animate-spin" /> {t('dreams.diary.wiki.loading', { title })}</div>;
  if (!data || Object.keys(data).length === 0) {
    return <div style={{ ...dimText, padding: 16 }}>{t('dreams.diary.wiki.noData', { title })}</div>;
  }
  return <WikiGenericView data={data} />;
}

/** Render genérico legible de la respuesta del plugin (strings/arrays/objetos). */
function WikiGenericView({ data }: { data: Record<string, unknown> }) {
  const { t } = useI18n();
  const copy = () => { void navigator.clipboard?.writeText(JSON.stringify(data, null, 2)); };
  return (
    <div style={{ ...dreamCard, gap: 8 }}>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={sectionTitle}>{k.replace(/_/g, ' ')}</span>
          {typeof v === 'string' ? (
            <span style={{ fontSize: '0.76rem', color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{v}</span>
          ) : Array.isArray(v) ? (
            v.length === 0 ? <span style={dimText}>—</span> : v.map((item, i) => (
              <span key={i} style={{ fontSize: '0.74rem', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                {typeof item === 'string' ? `• ${item}` : JSON.stringify(item)}
              </span>
            ))
          ) : (
            <pre style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-dim)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono, monospace)' }}>{JSON.stringify(v, null, 2)}</pre>
          )}
        </div>
      ))}
      <button onClick={copy} style={{ ...dreamBtn(), alignSelf: 'flex-start' }}><CopyIcon size={12} /> {t('dreams.diary.wiki.copyJson')}</button>
    </div>
  );
}
