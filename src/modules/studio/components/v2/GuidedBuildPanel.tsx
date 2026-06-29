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

// ─── Studio v3 — Guided build panel (left side, Modo Guiado) ────────
//
// In Guided mode the technical left pane (file tree, code editor,
// activity feed, raw token counters) is replaced by this human-language
// panel: the build checklist rendered as a list of milestones that
// advances on its own (✓ done · ⟳ in progress · ○ pending), a progress
// bar, and an "effort" bar (tokens used vs cap) reframed without jargon.
// This realizes §3.6 / §6.3 of the V3 plan: the curtain over the engine.

import { Hammer, CheckCircle2, Circle, Loader2, Sparkles } from 'lucide-react';
import type { StudioChecklistItem } from '@/stores/studio.store';
import type { StreamStatus } from '../../hooks/useOpencodeStream';

interface Props {
  status: StreamStatus;
  checklist: StudioChecklistItem[];
  tokensUsed: number;
  tokenCap: number;
  isStarted: boolean;
  starting?: boolean;
}

export function GuidedBuildPanel({ status, checklist, tokensUsed, tokenCap, isStarted, starting }: Props) {
  const total = checklist.length;
  const done = checklist.filter((c) => c.status === 'done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const effortPct = tokenCap > 0 ? Math.min(100, Math.round((tokensUsed / tokenCap) * 100)) : 0;

  return (
    <div style={wrap}>
      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Hammer size={18} style={{ color: 'var(--amber)' }} />
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
          {headline(status, isStarted, !!starting)}
        </div>
        {(status === 'running' || starting) && (
          <Loader2 size={14} className="spin" style={{ color: 'var(--amber)' }} />
        )}
      </div>

      {/* Progress */}
      {total > 0 ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 4 }}>
            <span>{done} de {total} pasos listos</span>
            <span>{pct}%</span>
          </div>
          <div style={barTrack}><div style={{ ...barFill, width: `${pct}%` }} /></div>
        </div>
      ) : (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          Estoy preparando la lista de pasos…
        </div>
      )}

      {/* Milestone list */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {checklist.map((item) => (
          <div key={item.id} style={milestoneRow(item.status)}>
            <span style={{ flexShrink: 0, display: 'flex', marginTop: 1 }}>
              {item.status === 'done' ? (
                <CheckCircle2 size={15} style={{ color: '#22c55e' }} />
              ) : item.status === 'in_progress' ? (
                <Loader2 size={15} className="spin" style={{ color: 'var(--amber)' }} />
              ) : (
                <Circle size={15} style={{ color: 'var(--text-muted)' }} />
              )}
            </span>
            <span style={{
              fontSize: '0.82rem', lineHeight: 1.35,
              color: item.status === 'pending' ? 'var(--text-muted)' : 'var(--text)',
            }} title={item.human_label ? item.text : undefined}>
              {item.human_label ?? item.text}
            </span>
          </div>
        ))}
        {total === 0 && !starting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px 0' }}>
            <Sparkles size={15} /> En cuanto apruebes el plan, verás aquí los pasos completándose solos.
          </div>
        )}
      </div>

      {/* Effort bar (tokens reframed — no jargon) */}
      <div style={effortBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: 4 }}>
          <span>Esfuerzo usado</span>
          <span>{effortPct}% del máximo</span>
        </div>
        <div style={barTrack}>
          <div style={{ ...barFill, width: `${effortPct}%`, background: effortPct > 85 ? 'var(--danger)' : 'var(--amber)' }} />
        </div>
        <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Hay un tope para que nunca se dispare sin tu permiso.
        </div>
      </div>
    </div>
  );
}

function headline(status: StreamStatus, isStarted: boolean, starting: boolean): string {
  if (starting) return 'Preparando tu app…';
  if (status === 'running') return 'Construyendo tu app…';
  if (status === 'failed') return 'Me encontré un obstáculo';
  if (!isStarted) return 'Lista para empezar';
  return 'En pausa, lista para ti';
}

const wrap: React.CSSProperties = {
  height: '100%', display: 'flex', flexDirection: 'column', gap: 14,
  padding: 18, minHeight: 0, fontFamily: 'var(--font-sans)', background: 'var(--surface)',
};
const barTrack: React.CSSProperties = {
  height: 7, borderRadius: 999, background: 'var(--card)', overflow: 'hidden',
  border: '1px solid var(--border)',
};
const barFill: React.CSSProperties = {
  height: '100%', background: 'var(--amber)', borderRadius: 999,
  transition: 'width 400ms ease',
};
const milestoneRow = (s: StudioChecklistItem['status']): React.CSSProperties => ({
  display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 8px',
  borderRadius: 'var(--radius-sm)',
  background: s === 'in_progress' ? 'color-mix(in srgb, var(--amber) 8%, transparent)' : 'transparent',
});
const effortBox: React.CSSProperties = {
  borderTop: '1px solid var(--border)', paddingTop: 12, flexShrink: 0,
};

export default GuidedBuildPanel;
