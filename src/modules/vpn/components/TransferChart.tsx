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

import { useMemo, useState } from 'react';
import type { VpnTransferSnapshot } from '../hooks/use-vpn-stats';
import type { VpnPeer } from '../hooks/use-vpn';

interface TransferChartProps {
  snapshots: VpnTransferSnapshot[];
  peers: VpnPeer[];
  width?: number;
  height?: number;
}

const PEER_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function TransferChart({ snapshots, peers, width = 700, height = 280 }: TransferChartProps) {
  const [hiddenPeers, setHiddenPeers] = useState<Set<string>>(new Set());
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const margin = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const peerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of snapshots) {
      for (const id of Object.keys(s.peers)) ids.add(id);
    }
    return Array.from(ids);
  }, [snapshots]);

  const peerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of peers) map[p.id] = p.name;
    return map;
  }, [peers]);

  // Compute cumulative deltas for each peer (rate of transfer)
  const { series, maxVal, timeLabels } = useMemo(() => {
    if (snapshots.length < 2) return { series: {} as Record<string, number[]>, maxVal: 1, timeLabels: [] as string[] };

    const result: Record<string, number[]> = {};
    let max = 0;
    const labels: string[] = [];

    for (const id of peerIds) {
      result[id] = [];
    }

    for (let i = 1; i < snapshots.length; i++) {
      labels.push(formatTime(snapshots[i].timestamp));
      for (const id of peerIds) {
        const prev = snapshots[i - 1].peers[id];
        const curr = snapshots[i].peers[id];
        const delta = curr && prev
          ? Math.max(0, (curr.rx + curr.tx) - (prev.rx + prev.tx))
          : 0;
        result[id].push(delta);
        if (!hiddenPeers.has(id) && delta > max) max = delta;
      }
    }

    return { series: result, maxVal: max || 1, timeLabels: labels };
  }, [snapshots, peerIds, hiddenPeers]);

  if (snapshots.length < 2) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
        border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
      }}>
        Not enough data yet. Transfer stats accumulate every minute.
      </div>
    );
  }

  const dataLen = timeLabels.length;

  const toX = (i: number) => margin.left + (i / (dataLen - 1)) * chartW;
  const toY = (val: number) => margin.top + chartH - (val / maxVal) * chartH;

  const makePath = (data: number[]) => {
    return data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ');
  };

  const togglePeer = (id: string) => {
    setHiddenPeers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Y-axis labels
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => (maxVal / yTicks) * i);

  // X-axis labels (show ~6)
  const xStep = Math.max(1, Math.floor(dataLen / 6));

  return (
    <div>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Grid lines */}
        {yLabels.map((v, i) => (
          <g key={i}>
            <line
              x1={margin.left} y1={toY(v)}
              x2={width - margin.right} y2={toY(v)}
              stroke="var(--border)" strokeDasharray="2,4"
            />
            <text
              x={margin.left - 6} y={toY(v) + 3}
              textAnchor="end" fontSize={9}
              fill="var(--text-muted)" fontFamily="var(--font-mono, monospace)"
            >
              {formatBytes(v)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {timeLabels.map((label, i) => {
          if (i % xStep !== 0 && i !== dataLen - 1) return null;
          return (
            <text
              key={i}
              x={toX(i)} y={height - 6}
              textAnchor="middle" fontSize={9}
              fill="var(--text-muted)" fontFamily="var(--font-mono, monospace)"
            >
              {label}
            </text>
          );
        })}

        {/* Lines */}
        {peerIds.map((id, idx) => {
          if (hiddenPeers.has(id) || !series[id]) return null;
          return (
            <path
              key={id}
              d={makePath(series[id])}
              fill="none"
              stroke={PEER_COLORS[idx % PEER_COLORS.length]}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          );
        })}

        {/* Hover line */}
        {hoverIdx !== null && (
          <line
            x1={toX(hoverIdx)} y1={margin.top}
            x2={toX(hoverIdx)} y2={margin.top + chartH}
            stroke="var(--text-muted)" strokeDasharray="2,4"
          />
        )}

        {/* Hover target (invisible rects) */}
        {timeLabels.map((_, i) => (
          <rect
            key={i}
            x={toX(i) - chartW / dataLen / 2}
            y={margin.top}
            width={chartW / dataLen}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
      </svg>

      {/* Hover tooltip */}
      {hoverIdx !== null && (
        <div style={{
          fontSize: '0.6875rem', color: 'var(--text-dim)',
          padding: '4px 0', display: 'flex', gap: 12,
          fontFamily: 'var(--font-sans)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{timeLabels[hoverIdx]}</span>
          {peerIds.map((id, idx) => {
            if (hiddenPeers.has(id)) return null;
            return (
              <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PEER_COLORS[idx % PEER_COLORS.length] }} />
                {peerNameMap[id] ?? id.slice(0, 8)}: {formatBytes(series[id]?.[hoverIdx] ?? 0)}
              </span>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        {peerIds.map((id, idx) => (
          <button
            key={id}
            onClick={() => togglePeer(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'transparent', border: 'none', cursor: 'pointer',
              opacity: hiddenPeers.has(id) ? 0.3 : 1,
              fontSize: '0.6875rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)', padding: '2px 0',
            }}
          >
            <span style={{
              width: 10, height: 3, borderRadius: 1,
              background: PEER_COLORS[idx % PEER_COLORS.length],
            }} />
            {peerNameMap[id] ?? id.slice(0, 8)}
          </button>
        ))}
      </div>
    </div>
  );
}
