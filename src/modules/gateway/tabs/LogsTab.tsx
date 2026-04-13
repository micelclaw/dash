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

// ─── Logs Tab (Ola 7, oc7-2) ────────────────────────────────────────
//
// LIVE log viewer for OpenClaw's Gateway. Subscribes to a WebSocket
// stream (gateway.logs.entry events) on mount and accumulates entries
// in a circular buffer of MAX_BUFFER (2000). Initial paint comes from
// a one-shot HTTP fetch to /gateway/logs so the user sees recent
// history immediately, then the stream takes over.
//
// Decisions applied:
//   D7=A — single PR: CLI→file migration + streaming + filters + export
//   D8=A — Export downloads the *filtered* buffer (NDJSON)
//   D9=A — only Gateway logs in MVP (Core/Vite logs are post-MVP)
//
// Filters: level (existing), agent (new dropdown), subsystem (auto from
// observed sources), search (substring on message). The Live/Paused
// toggle stops the buffer from auto-scrolling but keeps accumulating.
// The original "Follow" button is preserved for jump-to-bottom.

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { RefreshCw, Trash2, ArrowDown, Pause, Play, Download, Search } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAgents } from '@/modules/agents/hooks/use-agents';
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
const MAX_BUFFER = 2000;

export function LogsTab() {
  const isMobile = useIsMobile();
  const fetchLogs = useGatewayStore((s) => s.fetchLogs);
  const initialLogs = useGatewayStore((s) => s.logs);
  const initialError = useGatewayStore((s) => s.logsError);
  const wsStatus = useWebSocketStore((s) => s.status);
  const wsSend = useWebSocketStore((s) => s.send);
  const { agents } = useAgents();

  // ─── Filters ──────────────────────────────────────────────────────
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [subsystemFilter, setSubsystemFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // ─── Buffer ───────────────────────────────────────────────────────
  const [buffer, setBuffer] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // ─── Auto-scroll ──────────────────────────────────────────────────
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Initial paint via HTTP fetch ─────────────────────────────────
  useEffect(() => {
    fetchLogs(200);
  }, [fetchLogs]);

  // Seed the buffer with the initial fetch (one-shot)
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (initialLogs.length > 0) {
      setBuffer(initialLogs.slice(-MAX_BUFFER));
      seededRef.current = true;
    }
  }, [initialLogs]);

  // ─── WS subscribe / unsubscribe ───────────────────────────────────
  useEffect(() => {
    if (wsStatus !== 'connected') return;
    wsSend('gateway.logs.subscribe');
    return () => {
      wsSend('gateway.logs.unsubscribe');
    };
  }, [wsStatus, wsSend]);

  // Listen for incoming gateway.logs.entry events and append to buffer
  const event = useWebSocket('gateway.logs.entry');
  useEffect(() => {
    if (!event || event.event !== 'gateway.logs.entry') return;
    const entry = event.data as unknown as LogEntry | undefined;
    if (!entry || typeof entry.message !== 'string') return;
    setBuffer((prev) => {
      const next = [...prev, entry];
      // Circular: cap at MAX_BUFFER, drop oldest
      if (next.length > MAX_BUFFER) {
        return next.slice(next.length - MAX_BUFFER);
      }
      return next;
    });
  }, [event]);

  // ─── Subsystems observed in buffer (for filter dropdown) ──────────
  const subsystems = useMemo(() => {
    const set = new Set<string>();
    for (const entry of buffer) {
      if (entry.source) set.add(entry.source);
    }
    return Array.from(set).sort();
  }, [buffer]);

  // ─── Filtered view ────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return buffer.filter((entry) => {
      if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
      if (subsystemFilter !== 'all' && entry.source !== subsystemFilter) return false;
      if (agentFilter !== 'all') {
        // Match if message OR source mentions the agent name (case-insensitive).
        // OpenClaw embeds agent identifiers in messages and subsystems
        // inconsistently, so a string match is the most reliable.
        const needle = agentFilter.toLowerCase();
        const inMessage = entry.message.toLowerCase().includes(needle);
        const inSource = (entry.source ?? '').toLowerCase().includes(needle);
        if (!inMessage && !inSource) return false;
      }
      if (term && !entry.message.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [buffer, levelFilter, subsystemFilter, agentFilter, search]);

  // ─── Auto-scroll when new entries arrive (unless paused) ──────────
  useEffect(() => {
    if (paused || !autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [filteredLogs, autoScroll, paused]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isNearBottom);
  };

  // ─── Actions ──────────────────────────────────────────────────────
  const handleClear = () => {
    setBuffer([]);
  };

  const handleRefresh = useCallback(() => {
    seededRef.current = false;
    fetchLogs(200);
  }, [fetchLogs]);

  const handleExport = useCallback(() => {
    // D8=A: export the filtered view, not the entire buffer
    const content = filteredLogs.map((entry) => JSON.stringify(entry)).join('\n');
    const blob = new Blob([content], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `openclaw-logs-${ts}.ndjson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const togglePaused = () => {
    setPaused((p) => !p);
  };

  // ─── Connection status banner ─────────────────────────────────────
  const showReconnectBanner = wsStatus === 'reconnecting' || wsStatus === 'offline' || wsStatus === 'auth_failed';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar row 1: filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: isMobile ? '8px 12px' : '8px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
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

        {/* Agent filter */}
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          title="Filter by agent (matches in message and source)"
          style={selectStyle()}
        >
          <option value="all">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>

        {/* Subsystem filter */}
        <select
          value={subsystemFilter}
          onChange={(e) => setSubsystemFilter(e.target.value)}
          title="Filter by OpenClaw subsystem"
          style={selectStyle()}
        >
          <option value="all">All subsystems</option>
          {subsystems.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Search box */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={11}
            style={{
              position: 'absolute',
              left: 8,
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            style={{
              ...selectStyle(),
              paddingLeft: 24,
              minWidth: 160,
            }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Buffer count */}
        <div
          style={{
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginRight: 4,
          }}
        >
          {filteredLogs.length}/{buffer.length}
        </div>

        {/* Live / Paused toggle */}
        <button
          onClick={togglePaused}
          title={paused ? 'Paused — click to resume' : 'Live — click to pause'}
          style={{
            background: paused ? '#f43f5e15' : '#22c55e15',
            border: `1px solid ${paused ? '#f43f5e60' : '#22c55e60'}`,
            color: paused ? '#f43f5e' : '#22c55e',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            fontSize: '0.6875rem',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 600,
          }}
        >
          {paused ? <Play size={11} /> : <Pause size={11} />}
          {paused ? 'Paused' : 'Live'}
        </button>

        {/* Auto-scroll Follow */}
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
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ArrowDown size={11} />
            Follow
          </button>
        )}

        {/* Export */}
        <button
          onClick={handleExport}
          title={`Export ${filteredLogs.length} filtered entries as NDJSON`}
          disabled={filteredLogs.length === 0}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            cursor: filteredLogs.length === 0 ? 'default' : 'pointer',
            color: filteredLogs.length === 0 ? 'var(--text-muted)' : 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            opacity: filteredLogs.length === 0 ? 0.5 : 1,
          }}
        >
          <Download size={12} />
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          title="Clear buffer"
          style={iconButtonStyle()}
        >
          <Trash2 size={12} />
        </button>

        {/* Refresh (re-fetch HTTP) */}
        <button onClick={handleRefresh} title="Re-fetch from server" style={iconButtonStyle()}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Reconnect banner */}
      {showReconnectBanner && (
        <div
          style={{
            background: '#f59e0b15',
            borderBottom: '1px solid #f59e0b40',
            padding: '6px 16px',
            fontSize: '0.6875rem',
            color: '#f59e0b',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
            textAlign: 'center',
          }}
        >
          {wsStatus === 'reconnecting' ? 'Reconnecting to server...' : wsStatus === 'auth_failed' ? 'Authentication failed' : 'Disconnected — live stream paused'}
        </div>
      )}

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
        {initialError && filteredLogs.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--error)', textAlign: 'center' }}>{initialError}</div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-dim)', textAlign: 'center' }}>
            {buffer.length === 0 ? 'No log entries yet — waiting for stream...' : 'No entries match the current filters'}
          </div>
        ) : (
          filteredLogs.map((entry, i) => <LogLine key={i} entry={entry} />)
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function LogLine({ entry }: { entry: LogEntry }) {
  const color = LEVEL_COLORS[entry.level] ?? 'var(--text-dim)';
  const timestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';

  return (
    <div
      style={{
        padding: '1px 14px',
        display: 'flex',
        gap: 10,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {timestamp && (
        <span style={{ color: 'var(--text-muted)', flexShrink: 0, userSelect: 'none' }}>{timestamp}</span>
      )}
      {entry.level && (
        <span
          style={{
            color,
            fontWeight: entry.level === 'error' || entry.level === 'fatal' ? 600 : 400,
            minWidth: 36,
            textTransform: 'uppercase',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {entry.level.padEnd(5)}
        </span>
      )}
      {entry.source && (
        <span
          style={{
            color: 'var(--text-muted)',
            minWidth: 0,
            flexShrink: 0,
            userSelect: 'none',
            opacity: 0.7,
          }}
        >
          [{entry.source}]
        </span>
      )}
      <span style={{ color: entry.level === 'error' || entry.level === 'fatal' ? color : 'var(--text)' }}>
        {entry.message}
      </span>
    </div>
  );
}

function LevelButton({ level, active, onClick }: { level: string; active: boolean; onClick: () => void }) {
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

// ─── Style helpers ───────────────────────────────────────────────────

function selectStyle() {
  return {
    background: 'var(--surface)',
    color: 'var(--text-dim)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    fontSize: '0.6875rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  };
}

function iconButtonStyle() {
  return {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    cursor: 'pointer',
    color: 'var(--text-dim)',
    display: 'flex',
    alignItems: 'center',
  };
}
