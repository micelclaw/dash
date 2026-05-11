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

// ─── ToolCallCard — compact inline view of an MCP / builtin tool call
//
// One row per call inside an assistant bubble. Click to expand input +
// output. Colours follow the Studio v1 conventions (amber=running,
// green=ok, red=error, muted=pending).

import { useState } from 'react';
import { ChevronRight, ChevronDown, Loader2, Check, X } from 'lucide-react';
import type { ChatToolPart } from '../../hooks/useOpencodeStream';

const TOOL_ICON: Record<string, string> = {
  read: '📖',
  write: '✏️',
  edit: '✏️',
  glob: '🔎',
  grep: '🔎',
  mount_project: '🔌',
  run_migration: '🛢',
  seed: '🌱',
  truncate_tables: '🧹',
  call_sandbox_api: '🌐',
  run_tests: '🧪',
  read_doc: '📖',
  list_routes: '📋',
  mark_progress: '✅',
  todowrite: '📝',
};

interface Props {
  part: ChatToolPart;
}

export function ToolCallCard({ part }: Props) {
  const [open, setOpen] = useState(false);
  const icon = TOOL_ICON[part.tool] ?? '⚙';
  const summary = summariseInput(part.tool, part.input);
  const statusBadge =
    part.status === 'pending' ? <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>queued…</span>
    : part.status === 'running' ? <Loader2 size={12} style={{ color: 'var(--amber)' }} className="spin" />
    : part.status === 'completed' ? <Check size={12} style={{ color: '#22c55e' }} />
    : <X size={12} style={{ color: 'var(--danger)' }} />;
  const ms = part.ms ? `${part.ms}ms` : '';
  const borderColor =
    part.status === 'error' ? 'var(--danger)'
    : part.status === 'running' || part.status === 'pending' ? 'var(--amber)'
    : 'transparent';

  return (
    <div style={{
      borderLeft: `2px solid ${borderColor}`,
      paddingLeft: 8, marginTop: 4,
      fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', textAlign: 'left',
          background: 'transparent', border: 'none', padding: '2px 0',
          color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit',
        }}
      >
        {open
          ? <ChevronDown size={11} style={{ flexShrink: 0 }} />
          : <ChevronRight size={11} style={{ flexShrink: 0 }} />}
        <span aria-hidden style={{ flexShrink: 0 }}>{icon}</span>
        <span style={{
          fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', flexShrink: 0,
        }}>{part.tool}</span>
        {summary && (
          <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summary}
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {ms && <span style={{ color: 'var(--text-muted)' }}>{ms}</span>}
          {statusBadge}
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 4, padding: '6px 8px', background: 'var(--surface)', borderRadius: 4 }}>
          {part.input !== undefined && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: 2 }}>input</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                {prettyJson(part.input)}
              </pre>
            </div>
          )}
          {part.output !== undefined && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: 2 }}>output</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                {prettyJson(part.output)}
              </pre>
            </div>
          )}
          {part.error && (
            <div style={{ color: 'var(--danger)', fontSize: '0.7rem', marginTop: 4 }}>
              error: {part.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function summariseInput(tool: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  switch (tool) {
    case 'read': case 'write': case 'edit':
      return String(i.filePath ?? i.file ?? '');
    case 'glob': case 'grep':
      return String(i.pattern ?? '');
    case 'run_migration': case 'seed':
      return String(i.sql ?? '').slice(0, 60);
    case 'call_sandbox_api':
      return `${String(i.method ?? 'GET')} ${String(i.path ?? '')}`;
    case 'read_doc':
      return String(i.name ?? '');
    case 'mark_progress':
      return String(i.checklist_item_id ?? '');
    default:
      return '';
  }
}

function prettyJson(v: unknown): string {
  try {
    if (typeof v === 'string') return v.length > 800 ? v.slice(0, 800) + '\n…[truncated]' : v;
    const json = JSON.stringify(v, null, 2);
    return json.length > 1500 ? json.slice(0, 1500) + '\n…[truncated]' : json;
  } catch {
    return String(v);
  }
}
