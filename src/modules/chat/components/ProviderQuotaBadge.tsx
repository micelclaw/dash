/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * ProviderQuotaBadge (F3.1) — chip in the chat toolbar showing the
 * quota / usage of the active agent's provider. Powered by OpenClaw
 * 5.17+ `usage.status` RPC (wraps Claude Pro, GitHub Copilot, Gemini
 * CLI, MiniMax, OpenAI Codex, Xiaomi, Z.AI subscription endpoints).
 *
 * Behaviour:
 *  - Hidden when the upstream snapshot has no providers (raw-API-key
 *    setups never expose quota — silently absent).
 *  - Hidden when the active agent's provider isn't in the snapshot.
 *  - Polls every 60s while mounted.
 *  - Click opens a popover with every window of every provider.
 */

import { useEffect, useMemo, useState } from 'react';
import { Gauge } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useChatStore } from '@/stores/chat.store';
import { getUsageStatus } from '@/services/gateway.service';
import type { UsageStatus, ProviderUsage, UsageWindow } from '@/services/gateway.service';

const POLL_MS = 60_000;

/**
 * Map of provider id prefixes (as appearing in `agent.model` like
 * "anthropic/claude-sonnet-4-6") to the upstream `usage.status`
 * provider ids. When the agent's model uses a different prefix than
 * the upstream id, the dash needs this hint to find the right row.
 */
const PROVIDER_PREFIX_TO_USAGE_ID: Record<string, string> = {
  anthropic: 'anthropic',
  claude: 'anthropic',
  openai: 'openai-codex',
  'openai-codex': 'openai-codex',
  google: 'google-gemini-cli',
  'google-gemini-cli': 'google-gemini-cli',
  minimax: 'minimax',
  xiaomi: 'xiaomi',
  zai: 'zai',
  'github-copilot': 'github-copilot',
};

function extractProviderPrefix(model: string | undefined): string | null {
  if (!model) return null;
  const slash = model.indexOf('/');
  if (slash < 0) return model.toLowerCase();
  return model.slice(0, slash).toLowerCase();
}

function findProviderForActiveAgent(snapshot: UsageStatus, model: string | undefined): ProviderUsage | null {
  if (!snapshot.providers.length) return null;
  const prefix = extractProviderPrefix(model);
  if (!prefix) return snapshot.providers[0]; // fallback: just show the first known one
  const upstreamId = PROVIDER_PREFIX_TO_USAGE_ID[prefix] ?? prefix;
  return snapshot.providers.find((p) => p.provider === upstreamId) ?? null;
}

function bestWindow(windows: UsageWindow[]): UsageWindow | null {
  if (!windows.length) return null;
  // Prefer the most constrained: smallest remaining %, else first.
  const ranked = [...windows].sort((a, b) => {
    const pa = pctRemaining(a);
    const pb = pctRemaining(b);
    if (pa === null && pb === null) return 0;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return pa - pb;
  });
  return ranked[0];
}

function pctRemaining(w: UsageWindow): number | null {
  if (typeof w.limit === 'number' && w.limit > 0) {
    const remaining = typeof w.remaining === 'number'
      ? w.remaining
      : typeof w.used === 'number'
        ? Math.max(0, w.limit - w.used)
        : null;
    if (remaining === null) return null;
    return Math.max(0, Math.min(100, (remaining / w.limit) * 100));
  }
  return null;
}

function colorForPct(pct: number | null): string {
  if (pct === null) return 'var(--text-muted)';
  if (pct < 10) return 'var(--red, #ef4444)';
  if (pct < 30) return 'var(--amber, #f59e0b)';
  return 'var(--green, #10b981)';
}

function formatBadgeText(w: UsageWindow | null): string {
  if (!w) return 'quota';
  const pct = pctRemaining(w);
  if (pct !== null) return `${Math.round(pct)}%`;
  if (typeof w.used === 'number' && typeof w.limit === 'number') {
    return `${w.used}/${w.limit}`;
  }
  return 'quota';
}

export function ProviderQuotaBadge() {
  const selectedAgent = useChatStore((s) => s.selectedAgent);
  const agents = useChatStore((s) => s.agents);
  const activeModel = useMemo(
    () => agents.find((a) => a.name === selectedAgent)?.model,
    [agents, selectedAgent],
  );

  const [snapshot, setSnapshot] = useState<UsageStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await getUsageStatus();
        if (!cancelled) setSnapshot(s);
      } catch {
        // Silent — endpoint will 500 if Gateway is down; no badge is fine.
      }
    }
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const activeProvider = useMemo(
    () => (snapshot ? findProviderForActiveAgent(snapshot, activeModel) : null),
    [snapshot, activeModel],
  );

  // Early return: nothing to show when the active provider has no quota
  // data. Don't render an empty/grey badge — keeps the toolbar clean.
  if (!snapshot || !snapshot.providers.length || !activeProvider) return null;
  if (activeProvider.error && !activeProvider.windows.length) return null;

  const window = bestWindow(activeProvider.windows);
  const pct = window ? pctRemaining(window) : null;
  const color = colorForPct(pct);
  const text = formatBadgeText(window);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`${activeProvider.display_name} quota`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: open ? 'var(--surface-hover)' : 'transparent',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            color,
          }}
        >
          <Gauge size={14} />
          <span style={{ color: 'var(--text-dim)' }}>{activeProvider.display_name}</span>
          <span style={{ color, fontWeight: 600 }}>{text}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} style={{ width: 320, padding: 12 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>
          Provider quota
        </div>
        {snapshot.providers.map((p) => (
          <div
            key={p.provider}
            style={{
              padding: '6px 0',
              borderBottom: '1px solid var(--border)',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontWeight: 500 }}>{p.display_name}</span>
              <span style={{ color: 'var(--text-muted)' }}>{p.provider}</span>
            </div>
            {p.error && (
              <div style={{ color: 'var(--amber)', fontSize: '0.7rem' }}>{p.error}</div>
            )}
            {p.windows.length === 0 && !p.error && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>No data.</div>
            )}
            {p.windows.map((w, idx) => {
              const wpct = pctRemaining(w);
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.7rem',
                    marginTop: 2,
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>
                    {w.label ?? `window ${idx + 1}`}
                  </span>
                  <span style={{ color: colorForPct(wpct), fontWeight: 600 }}>
                    {wpct !== null
                      ? `${Math.round(wpct)}% left`
                      : typeof w.used === 'number'
                        ? `${w.used}${w.unit ? ` ${w.unit}` : ''}`
                        : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          Refreshed {new Date(snapshot.updated_at).toLocaleTimeString()} · upstream covers
          subscription / OAuth providers only.
        </div>
      </PopoverContent>
    </Popover>
  );
}
