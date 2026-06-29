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

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { getAgentColor } from '../agent-colors';
import { formatTokens, modelShort } from '../shared/format';
import type { ManagedAgent } from '../types';

type SortKey = 'display_name' | 'role' | 'status' | 'model' | 'sessions_today' | 'tokens_today' | 'skills' | 'scopes_count';

interface FleetTableProps {
  agents: ManagedAgent[];
  /** Stuck-yields por agentId (de live-info batched no disponible → opcional). */
  onSelect?: (agentId: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'var(--success)',
  idle: 'var(--text-muted)',
  error: 'var(--error)',
};

const COLS: { key: SortKey; label: string; align: 'left' | 'right'; num?: boolean }[] = [
  { key: 'display_name', label: 'Agente', align: 'left' },
  { key: 'role', label: 'Rol', align: 'left' },
  { key: 'status', label: 'Estado', align: 'left' },
  { key: 'model', label: 'Modelo', align: 'left' },
  { key: 'sessions_today', label: 'Ses', align: 'right', num: true },
  { key: 'tokens_today', label: 'Tokens hoy', align: 'right', num: true },
  { key: 'skills', label: 'Skl', align: 'right', num: true },
  { key: 'scopes_count', label: 'Scp', align: 'right', num: true },
];

export function FleetTable({ agents, onSelect }: FleetTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('tokens_today');
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const val = (a: ManagedAgent, k: SortKey): string | number => {
      switch (k) {
        case 'display_name': return a.display_name.toLowerCase();
        case 'role': return (a.role ?? '').toLowerCase();
        case 'status': return a.status;
        case 'model': return modelShort(a.model).toLowerCase();
        case 'sessions_today': return a.sessions_today ?? 0;
        case 'tokens_today': return a.tokens_today ?? 0;
        case 'skills': return Array.isArray(a.skills) ? a.skills.length : 0;
        case 'scopes_count': return a.scopes_count ?? 0;
      }
    };
    return [...agents].sort((x, y) => {
      const a = val(x, sortKey), b = val(y, sortKey);
      const cmp = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
      return asc ? cmp : -cmp;
    });
  }, [agents, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc((p) => !p);
    else { setSortKey(k); setAsc(false); }
  };

  const th = (c: typeof COLS[number]) => (
    <th
      key={c.key}
      onClick={() => toggle(c.key)}
      style={{
        textAlign: c.align, padding: '7px 10px', fontSize: '0.625rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)',
        cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexDirection: c.align === 'right' ? 'row-reverse' : 'row' }}>
        {c.label}
        {sortKey === c.key && (asc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </span>
    </th>
  );

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
        <thead>
          <tr>{COLS.map(th)}</tr>
        </thead>
        <tbody>
          {sorted.map((a) => {
            const skills = Array.isArray(a.skills) ? a.skills.length : 0;
            const color = getAgentColor(a.name, a.color);
            const problem = a.status === 'error';
            return (
              <tr
                key={a.id}
                onClick={() => onSelect?.(a.id)}
                style={{ cursor: onSelect ? 'pointer' : 'default', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 0 2px color-mix(in srgb, ${color} 25%, transparent)` }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {a.avatar && <span style={{ fontSize: '0.9rem' }}>{a.avatar}</span>}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text)', fontWeight: 500 }}>{a.display_name}</span>
                      {a.is_chief && <span style={{ fontSize: '0.5rem', color: 'var(--amber)', border: '1px solid var(--amber-dim)', borderRadius: 'var(--radius-sm)', padding: '0 4px' }}>jefe</span>}
                    </span>
                  </span>
                </td>
                <td style={{ padding: '7px 10px', fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{a.role || '—'}</td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', color: STATUS_COLOR[a.status] ?? 'var(--text-dim)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[a.status] ?? 'var(--text-muted)' }} />
                    {a.status}
                  </span>
                </td>
                <td style={{ padding: '7px 10px', fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }} title={a.model}>
                  {modelShort(a.model)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{a.sessions_today ?? 0}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: '0.6875rem', color: 'var(--text)', fontFamily: 'var(--font-mono)' }} title={(a.tokens_today ?? 0).toLocaleString('es-ES')}>
                  {formatTokens(a.tokens_today)}
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{skills}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                    {a.scopes_count ?? 0}
                    {problem && <AlertTriangle size={12} style={{ color: 'var(--error)' }} />}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
