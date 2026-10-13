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

export function DreamAdvanced({ agentName, status, diary, rem, remLoading, busy, onLoadRem, onMaintenance }: Props) {
  const isMobile = useIsMobile();
  const s = status ?? {};
  const [sort, setSort] = useState<SortMode>('backing');
  const [confirm, setConfirm] = useState<{ action: string; label: string } | null>(null);

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
          {statCell(s.daily_signal_count ?? 0, 'del registro diario')}
          {statCell(s.total_signal_count ?? 0, 'en espera')}
          {statCell(s.promoted_today ?? 0, 'promovidos hoy')}
          {statCell(s.promoted_total ?? 0, 'promovidos en total')}
        </div>
        <div style={{ ...dimText, fontSize: '0.66rem' }}>
          {s.last_promoted_at && <>último promovido {formatRelativeTime(toIso(s.last_promoted_at))} · </>}
          almacenamiento: {s.storage_mode ?? '—'}{s.timezone ? ` · ${s.timezone}` : ''}
        </div>
      </div>

      {/* Del registro diario (grounded replay) */}
      <div style={dreamCard}>
        <span style={sectionTitle}>Del registro diario</span>
        <span style={{ ...dimText, fontSize: '0.66rem' }}>Candidatos recientes extraídos de las entradas del registro diario.</span>
        <EntryList entries={s.short_term_entries ?? []} empty="No hay entradas de reproducción preparadas ahora mismo." />
      </div>

      {/* Esperando promoción */}
      <div style={dreamCard}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={sectionTitle}>Esperando promoción</span>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
            {(['backing', 'recent'] as SortMode[]).map(m => (
              <button key={m} onClick={() => setSort(m)}
                style={{
                  padding: isMobile ? '7px 11px' : '4px 10px', border: 'none', cursor: 'pointer', fontSize: '0.66rem',
                  background: sort === m ? 'var(--bg-subtle, rgba(127,127,127,0.14))' : 'transparent',
                  color: sort === m ? 'var(--text)' : 'var(--text-dim)', fontWeight: sort === m ? 600 : 400,
                  borderLeft: m === 'recent' ? '1px solid var(--border)' : 'none',
                }}>{m === 'backing' ? 'Mayor respaldo' : 'Más reciente'}</button>
            ))}
          </div>
        </div>
        <span style={{ ...dimText, fontSize: '0.66rem' }}>Candidatos a corto plazo que esperan ascender a memoria real (muestra de {signalEntries.length}; {s.total_signal_count ?? 0} en cola).</span>
        <EntryList entries={signalEntries} empty="Nada esperando promoción." />
      </div>

      {/* Promovidos + Deep Sleep */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div style={{ ...dreamCard, flex: 1, minWidth: 0 }}>
          <span style={sectionTitle}>Promovidos a MEMORY.md</span>
          <EntryList entries={s.promoted_entries ?? []} empty="Nada promovido todavía." promoted />
        </div>
        <div style={{ ...dreamCard, flex: 1, minWidth: 0 }}>
          <span style={sectionTitle}><MoonStar size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />Último sueño profundo</span>
          {deepSleep.length === 0
            ? <span style={dimText}>Sin registro del último barrido profundo.</span>
            : deepSleep.map((b, i) => <span key={i} style={{ fontSize: '0.74rem', color: 'var(--text)', lineHeight: 1.5 }}>• {b}</span>)}
        </div>
      </div>

      {/* Ensayo REM (preview) */}
      <div style={dreamCard}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={sectionTitle}>Ensayo REM (preview)</span>
          <span style={{ fontSize: '0.64rem', color: 'var(--warning)', border: '1px solid var(--warning)', borderRadius: 999, padding: '1px 8px' }}>⚠ global — corre sobre el agente por defecto del gateway</span>
        </div>
        {remLoading ? (
          <span style={{ ...dimText, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Loader2 size={13} className="animate-spin" /> Ensayando…</span>
        ) : rem?.ok ? (
          <span style={dimText}>
            {rem.rem?.reflections?.length ?? 0} reflexiones · {rem.rem?.candidate_truths?.length ?? 0} verdades candidatas ·{' '}
            {rem.deep?.candidates?.length ?? 0} candidatos deep{typeof rem.deep_config?.min_score === 'number' ? ` (min_score ${rem.deep_config.min_score})` : ''}
            {' — el detalle vive en Diario → Reflexiones.'}
          </span>
        ) : (
          <span style={dimText}>El REM harness no devolvió datos.</span>
        )}
      </div>

      {/* Mantenimiento */}
      <div style={dreamCard}>
        <span style={sectionTitle}><Wrench size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />Mantenimiento</span>
        <span style={{ ...dimText, fontSize: '0.66rem' }}>Acciones de operador sobre {agentName}. No editan MEMORY.md.</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MAINTENANCE.map(m => (
            <div key={m.action} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text)', fontWeight: 500 }}>{m.label}</div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)' }}>{m.desc}</div>
              </div>
              <button
                onClick={() => m.destructive ? setConfirm({ action: m.action, label: m.label }) : onMaintenance(m.action, m.label)}
                disabled={busy !== null}
                style={{ ...dreamBtn(m.destructive ? 'var(--error)' : undefined), flexShrink: 0 }}>
                {busy === m.action ? <Loader2 size={12} className="animate-spin" /> : null} Ejecutar
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => { if (confirm) onMaintenance(confirm.action, confirm.label); }}
        title={confirm?.label ?? ''}
        description={`Se ejecutará sobre ${agentName}. Es reversible y NO edita MEMORY.md.`}
        confirmLabel="Ejecutar"
        cancelLabel="Cancelar"
        variant="warning"
      />
    </div>
  );
}

function ts(v: string | number | undefined | null): number {
  const iso = toIso(v);
  return iso ? new Date(iso).getTime() : 0;
}

function EntryList({ entries, empty, promoted }: { entries: DreamSignalEntry[]; empty: string; promoted?: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (entries.length === 0) return <span style={dimText}>{empty}</span>;
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
                <span style={{ flexShrink: 0, marginTop: 2, fontSize: '0.58rem', fontWeight: 700, color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 4, padding: '0px 5px', letterSpacing: '0.05em' }}>EN VIVO</span>
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
                title="Copiar ruta"
                onClick={() => { void navigator.clipboard?.writeText(loc); toast.success('Ruta copiada'); }}
                style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {loc}
              </button>
              <span style={{ flex: 1 }} />
              {(e.total_signal_count ?? 0) > 0 && <SignalBadge>{e.total_signal_count} señales</SignalBadge>}
              {(e.daily_count ?? 0) > 0 && <SignalBadge>{e.daily_count} daily</SignalBadge>}
              {(e.grounded_count ?? 0) > 0 && <SignalBadge>{e.grounded_count} grounded</SignalBadge>}
              {(e.phase_hit_count ?? 0) > 0 && <SignalBadge>{e.phase_hit_count} phase hit</SignalBadge>}
              {(e.light_hits ?? 0) > 0 && <SignalBadge color="var(--warning)">☀ {e.light_hits}</SignalBadge>}
              {(e.rem_hits ?? 0) > 0 && <SignalBadge color="var(--amber)">🌙 {e.rem_hits}</SignalBadge>}
              {promoted && e.promoted_at && <SignalBadge color="var(--success)">promovido {formatRelativeTime(toIso(e.promoted_at))}</SignalBadge>}
              {!promoted && e.last_recalled_at && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{formatRelativeTime(toIso(e.last_recalled_at))}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
