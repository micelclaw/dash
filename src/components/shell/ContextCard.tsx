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

import { useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '@/services/api';
import { useIsMobile } from '@/hooks/use-media-query';

interface ContextSignal {
  type: 'calendar' | 'email' | 'messaging' | 'editing' | 'task';
  icon: string;
  text: string;
  priority: number;
}

interface ContextResponse {
  signals: ContextSignal[];
}

const POLL_INTERVAL_MS = 120_000; // 2 minutes
const STORAGE_KEY = 'claw-context-card-collapsed';
const MAX_SIGNALS = 4;

/**
 * Collapsible context card shown above the chat input in the AI Chat module.
 * Polls GET /api/v1/context every 2 min for contextual signals.
 */
export function ContextCard() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(() => {
    if (isMobile) return true;
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [signals, setSignals] = useState<ContextSignal[]>([]);

  const fetchContext = useCallback(async () => {
    try {
      const res = await api.get<{ data: ContextResponse }>('/context');
      const sigs = (res.data?.signals ?? [])
        .filter((s: ContextSignal) => s.text)
        .sort((a: ContextSignal, b: ContextSignal) => b.priority - a.priority)
        .slice(0, MAX_SIGNALS);
      setSignals(sigs);
    } catch {
      // Silently fail — context is non-critical
    }
  }, []);

  useEffect(() => {
    fetchContext();
    const interval = setInterval(fetchContext, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchContext]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Ignore storage errors
    }
  };

  if (signals.length === 0) return null;

  const topSignal = signals[0];

  return (
    <div style={{
      margin: '8px 12px 0',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface)',
      fontSize: '0.75rem',
      fontFamily: 'var(--font-sans)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={toggleCollapsed}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '6px 10px',
          background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)', fontSize: '0.6875rem',
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}
      >
        <span>Context</span>
        {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {/* Collapsed: single most important line */}
      {collapsed && topSignal && (
        <div style={{
          padding: '0 10px 6px',
          color: 'var(--text-dim)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {topSignal.icon} {topSignal.text}
        </div>
      )}

      {/* Expanded: all signals */}
      {!collapsed && (
        <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {signals.map((s, i) => (
            <div
              key={i}
              style={{
                color: 'var(--text-dim)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.6,
              }}
            >
              {s.icon} {s.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
