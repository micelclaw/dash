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

// ─── ActivityFeed — chronological list of tool calls + file edits
//
// Data sourced from useOpencodeStream's `toolHistory` and `recentEdits`.
// Light row format, latest-on-top. Click a row to expand.

import { useMemo, useState } from 'react';
import type { ChatToolPart, FileEdit } from '../../hooks/useOpencodeStream';

interface Props {
  toolHistory: ChatToolPart[];
  recentEdits: FileEdit[];
}

type Entry =
  | { kind: 'tool'; ts: number; tool: ChatToolPart }
  | { kind: 'edit'; ts: number; edit: FileEdit };

export function ActivityFeed({ toolHistory, recentEdits }: Props) {
  const entries = useMemo<Entry[]>(() => {
    const merged: Entry[] = [
      ...toolHistory.map<Entry>((t) => ({ kind: 'tool', ts: t.completedAt ?? t.startedAt, tool: t })),
      ...recentEdits.map<Entry>((e) => ({ kind: 'edit', ts: e.ts, edit: e })),
    ];
    merged.sort((a, b) => b.ts - a.ts);
    return merged.slice(0, 50);
  }, [toolHistory, recentEdits]);

  if (entries.length === 0) {
    return (
      <div style={{
        padding: '8px 12px', fontSize: '0.7rem',
        color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
      }}>
        (waiting for first action…)
      </div>
    );
  }

  return (
    <div style={{
      maxHeight: 200, overflowY: 'auto',
      fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
      padding: '4px 0',
    }}>
      {entries.map((entry) => (
        <ActivityRow
          key={entry.kind === 'tool'
            ? `tool-${entry.tool.callId || entry.ts}`
            : `edit-${entry.edit.path}-${entry.ts}`}
          entry={entry}
        />
      ))}
    </div>
  );
}

function ActivityRow({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false);
  const time = new Date(entry.ts).toLocaleTimeString(undefined, { hour12: false });
  if (entry.kind === 'edit') {
    return (
      <div style={{ display: 'flex', gap: 8, padding: '2px 12px', color: 'var(--text-dim)' }}>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{time}</span>
        <span aria-hidden>✏️</span>
        <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.edit.path}
        </span>
      </div>
    );
  }
  const t = entry.tool;
  const status = t.status === 'error' ? '✗' : '✓';
  const statusColor = t.status === 'error' ? 'var(--danger)' : '#22c55e';
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', textAlign: 'left',
          padding: '2px 12px', background: 'transparent', border: 'none',
          color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit',
        }}
      >
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{time}</span>
        <span style={{ color: statusColor, flexShrink: 0 }}>{status}</span>
        <span style={{ fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{t.tool}</span>
        {t.ms && <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{t.ms}ms</span>}
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: '4px 24px', whiteSpace: 'pre-wrap',
          wordBreak: 'break-word', color: 'var(--text-muted)',
          fontSize: '0.65rem', background: 'var(--surface)',
        }}>
          {JSON.stringify({ input: t.input, output: t.output, error: t.error }, null, 2).slice(0, 1500)}
        </pre>
      )}
    </div>
  );
}
