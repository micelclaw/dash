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

import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Trash2, ArrowDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import type { LogEntry } from '../types';

const LEVEL_COLORS: Record<string, string> = {
  error: '#f43f5e',
  fatal: '#f43f5e',
  warn: '#f97316',
  info: 'var(--text)',
  debug: 'var(--text-dim)',
  trace: 'var(--text-muted)',
};

const LEVEL_FILTERS = ['all', 'error', 'warn', 'info', 'debug'] as const;
const LIMIT_OPTIONS = [100, 200, 500] as const;

export function LogsTab() {
  const isMobile = useIsMobile();
  const { logs, logsLoading, logsError, fetchLogs } = useGatewayStore();
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [limit, setLimit] = useState<number>(200);
  const [autoScroll, setAutoScroll] = useState(true);
  const [refreshHover, setRefreshHover] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLogs(limit);
  }, [fetchLogs, limit]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isNearBottom);
  };

  const filteredLogs = logs.filter((entry) => {
    if (levelFilter === 'all') return true;
    return entry.level === levelFilter;
  });

  const handleClear = () => {
    useGatewayStore.setState({ logs: [] });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: isMobile ? '8px 12px' : '8px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* Level filter */}
        <div style={{ display: 'flex', gap: 2 }}>
          {LEVEL_FILTERS.map((lvl) => (
            <LevelButton
              key={lvl}
              level={lvl}
              active={levelFilter === lvl}
              onClick={() => setLevelFilter(lvl)}
            />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Limit selector */}
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          style={{
            background: 'var(--surface)',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        >
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={n}>{n} lines</option>
          ))}
        </select>

        {/* Auto-scroll indicator */}
        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }}
            style={{
              background: 'var(--amber-dim)',
              color: 'var(--amber)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontSize: '0.6875rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <ArrowDown size={11} />
            Follow
          </button>
        )}

        <button
          onClick={handleClear}
          title="Clear"
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <Trash2 size={12} />
        </button>

        <button
          onClick={() => fetchLogs(limit)}
          onMouseEnter={() => setRefreshHover(true)}
          onMouseLeave={() => setRefreshHover(false)}
          style={{
            background: refreshHover ? 'var(--surface-hover)' : 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            transition: 'var(--transition-fast)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Log viewer */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#08080e',
          padding: '8px 0',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          lineHeight: 1.6,
        }}
      >
        {logsLoading && filteredLogs.length === 0 ? (
          <div style={{
            padding: 20,
            color: 'var(--text-dim)',
            textAlign: 'center',
          }}>
            Loading logs...
          </div>
        ) : logsError ? (
          <div style={{
            padding: 20,
            color: 'var(--error)',
            textAlign: 'center',
          }}>
            {logsError}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{
            padding: 20,
            color: 'var(--text-dim)',
            textAlign: 'center',
          }}>
            No log entries
          </div>
        ) : (
          filteredLogs.map((entry, i) => (
            <LogLine key={i} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function LogLine({ entry }: { entry: LogEntry }) {
  const color = LEVEL_COLORS[entry.level] ?? 'var(--text-dim)';
  const timestamp = entry.timestamp
    ? new Date(entry.timestamp).toLocaleTimeString()
    : '';

  // Handle raw string logs from CLI
  const message = typeof entry === 'string' ? entry : entry.message;
  const level = typeof entry === 'string' ? '' : entry.level;

  return (
    <div style={{
      padding: '1px 14px',
      display: 'flex',
      gap: 10,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }}>
      {timestamp && (
        <span style={{ color: 'var(--text-muted)', flexShrink: 0, userSelect: 'none' }}>
          {timestamp}
        </span>
      )}
      {level && (
        <span style={{
          color,
          fontWeight: level === 'error' || level === 'fatal' ? 600 : 400,
          minWidth: 36,
          textTransform: 'uppercase',
          flexShrink: 0,
          userSelect: 'none',
        }}>
          {level.padEnd(5)}
        </span>
      )}
      <span style={{ color: level === 'error' || level === 'fatal' ? color : 'var(--text)' }}>
        {message}
      </span>
    </div>
  );
}

function LevelButton({ level, active, onClick }: {
  level: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: active ? 'var(--amber-dim)' : hovered ? 'var(--surface-hover)' : 'transparent',
        color: active ? 'var(--amber)' : 'var(--text-dim)',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        padding: '3px 8px',
        fontSize: '0.6875rem',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        textTransform: 'capitalize',
      }}
    >
      {level}
    </button>
  );
}
