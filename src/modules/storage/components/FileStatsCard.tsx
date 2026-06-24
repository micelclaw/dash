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

// Inline-styles var(--*) para combinar con el resto del módulo Storage
// (que no usa Tailwind). Misma lógica que antes; solo cambia el estilado.

import { useState, useEffect } from 'react';
import { Files, Camera } from 'lucide-react';
import { api } from '@/services/api';
import { formatFileSize } from '@/lib/file-utils';

// Guarda contra valores nulos/undefined/NaN: formatFileSize(undefined)
// devuelve "NaN undefined". Si no es un número finito, mostramos "—".
function safeSize(bytes: number | null | undefined): string {
  if (bytes == null || typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—';
  return formatFileSize(bytes);
}

// Cuenta segura: number.toLocaleString() peta si el valor es undefined.
function safeCount(n: number | null | undefined): string {
  if (n == null || typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

interface MimeStat {
  mime_type: string | null;
  count: number;
  total_bytes: number;
}

interface FileStats {
  total_files: number;
  total_directories: number;
  total_size_bytes: number;
  mime_distribution: MimeStat[];
  duplicates?: { groups: number; files: number; wasted_bytes: number };
}

interface SnapshotStats {
  count: number;
  files_with_snapshots: number;
  total_snapshot_size: number;
}

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: 16,
};
const heading: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px',
  fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)',
};

export function FileStatsCard() {
  const [stats, setStats] = useState<FileStats | null>(null);
  const [snapStats, setSnapStats] = useState<SnapshotStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [fileRes, snapRes] = await Promise.all([
          api.get<{ data: FileStats }>('/files/stats'),
          api.get<{ data: SnapshotStats }>('/files/snapshots/stats'),
        ]);
        setStats(fileRes.data);
        setSnapStats(snapRes.data);
      } catch {
        // optional endpoints
      }
      setLoading(false);
    })();
  }, []);

  if (loading || !stats) return null;

  const topMimes = (Array.isArray(stats.mime_distribution) ? [...stats.mime_distribution] : [])
    .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
    .slice(0, 5);

  return (
    <div style={card}>
      <h3 style={heading}>
        <Files size={14} />
        Estadísticas de archivos
      </h3>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: 12, marginBottom: 16,
      }}>
        <StatItem label="Archivos" value={safeCount(stats.total_files)} />
        <StatItem label="Carpetas" value={safeCount(stats.total_directories)} />
        <StatItem label="Tamaño total" value={safeSize(stats.total_size_bytes)} />
        {stats.duplicates && Number(stats.duplicates.files) > 0 && (
          <StatItem label="Duplicados" value={safeCount(stats.duplicates.files)} warn />
        )}
      </div>

      {snapStats && Number(snapStats.count) > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12,
          fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', flexWrap: 'wrap',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Camera size={12} />
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{safeCount(snapStats.count)}</span> instantáneas
          </span>
          <span>
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{safeCount(snapStats.files_with_snapshots)}</span> archivos versionados
          </span>
          <span>
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{safeSize(snapStats.total_snapshot_size)}</span> usados
          </span>
        </div>
      )}

      {topMimes.length > 0 && (
        <div>
          <div style={{
            fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
            color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 8,
          }}>
            Tipos más frecuentes
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {topMimes.map((m, i) => (
              <span key={m.mime_type ?? i} style={{
                padding: '2px 8px', fontSize: '0.625rem', borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-hover, var(--card))', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
              }}>
                {(m.mime_type ?? 'unknown').split('/').pop()} <span style={{ color: 'var(--text-muted)' }}>({safeCount(m.count)})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
        color: warn ? 'var(--warning, #f59e0b)' : 'var(--text)',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.04em', fontFamily: 'var(--font-sans)',
      }}>
        {label}
      </div>
    </div>
  );
}
