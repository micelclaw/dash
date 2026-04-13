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

// ─── SandboxStatusBadge — at-a-glance project sandbox state ─────────
//
// Shown in the project header for projects in implementation+ phases.
// Polls /sandbox once on mount; the runtime is fast enough that a
// background WS event is overkill until Phase 8 wires the preview iframe.

import { useEffect, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';

interface SandboxStatus {
  schema: string;
  schema_exists: boolean;
  mounted: boolean;
  route_count: number;
  file_count: number;
}

interface ApiEnvelope<T> { data: T }

interface Props { projectId: string; }

export function SandboxStatusBadge({ projectId }: Props) {
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get<ApiEnvelope<SandboxStatus>>(`/studio/projects/${projectId}/sandbox`);
      setStatus(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sandbox status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  if (loading && !status) {
    return null;
  }
  if (error) {
    return (
      <span style={badgeStyle('var(--danger)')} title={error}>
        <Database size={12} /> sandbox error
      </span>
    );
  }
  if (!status) return null;

  const color = status.mounted ? '#22c55e' : (status.schema_exists ? 'var(--amber)' : 'var(--text-muted)');
  const label = status.mounted
    ? `${status.route_count} route${status.route_count === 1 ? '' : 's'}`
    : (status.schema_exists ? 'schema ready' : 'no sandbox');

  return (
    <button
      type="button"
      onClick={refresh}
      title={`${status.schema} • ${status.file_count} files`}
      style={{
        ...badgeStyle(color),
        cursor: 'pointer',
        background: 'transparent',
      }}
    >
      <Database size={12} /> {label}
      {loading && <RefreshCw size={10} className="animate-spin" />}
    </button>
  );
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', fontSize: '0.6875rem',
    color, border: `1px solid ${color}40`,
    borderRadius: 'var(--radius-full)',
    fontFamily: 'var(--font-sans)',
  };
}
