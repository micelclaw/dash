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

// ─── Franja-resumen de primer vistazo ──────────────────────────────
// Tira de orientación al principio de la página Storage: 4 cifras clave
// para entender el estado del almacenamiento de un solo vistazo, sin
// tener que leer cada zona. Capacidad usada (con barra fina), nº de
// pools ZFS, nº de discos físicos y salud global. Inline-styles var(--*).

import { Gauge, Boxes, HardDrive, Activity } from 'lucide-react';
import { formatFileSize } from '@/lib/file-utils';
import type { StorageStatus } from '../types';

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f97316',
  critical: '#f43f5e',
  unknown: '#6b7280',
};

function getBarColor(percent: number): string {
  if (percent > 90) return '#f43f5e';
  if (percent > 80) return '#f97316';
  return 'var(--amber)';
}

// Tile de estadística: icono + etiqueta (arriba), valor grande (abajo) y un
// pie opcional (la barra de capacidad o un texto contextual).
function StatTile({
  icon,
  label,
  value,
  valueColor,
  footer,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div style={{
      flex: '1 1 130px', padding: '12px 14px',
      background: 'var(--card)', borderRadius: 'var(--radius-sm)',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        <span style={{ display: 'inline-flex', color: 'var(--text-dim)' }}>{icon}</span>
        {label}
      </div>
      <div style={{
        fontSize: '1.375rem', fontWeight: 700, color: valueColor ?? 'var(--text)',
        fontFamily: 'var(--font-sans)', lineHeight: 1,
      }}>
        {value}
      </div>
      {footer}
    </div>
  );
}

export function StorageSummaryCard({
  status,
  poolCount,
  diskCount,
}: {
  status: StorageStatus | null;
  poolCount: number;
  diskCount: number;
}) {
  if (!status) {
    return (
      <div style={{
        padding: 14, background: 'var(--surface)',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
        display: 'flex', gap: 12, flexWrap: 'wrap',
      }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: '1 1 130px', height: 64, background: 'var(--card)', borderRadius: 'var(--radius-sm)' }} />
        ))}
      </div>
    );
  }

  const percent = status.total_bytes > 0 ? (status.used_bytes / status.total_bytes) * 100 : 0;
  const barColor = getBarColor(percent);
  const healthColor = HEALTH_COLORS[status.health] ?? '#6b7280';
  const isUnknownHealth = status.health === 'unknown';
  const healthLabel = isUnknownHealth ? 'N/A' : status.health.charAt(0).toUpperCase() + status.health.slice(1);

  const caption: React.CSSProperties = {
    fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
  };

  return (
    <div style={{
      padding: 14, background: 'var(--surface)',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
      display: 'flex', gap: 12, flexWrap: 'wrap',
    }}>
      {/* Capacidad usada (con barra fina). El número se queda neutro y solo se
          pone rojo si la ocupación es crítica (>90%); el color gradual lo lleva
          la barra, para que un uso bajo no parezca un aviso. */}
      <StatTile
        icon={<Gauge size={13} />}
        label="Usado"
        value={`${percent.toFixed(0)}%`}
        valueColor={percent > 90 ? '#f43f5e' : undefined}
        footer={
          <>
            <div style={{
              height: 6, background: 'var(--bg, var(--surface))', borderRadius: 3,
              overflow: 'hidden', border: '1px solid var(--border)',
            }}>
              <div style={{
                height: '100%', width: `${Math.min(percent, 100)}%`,
                background: barColor, transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={caption}>
              {formatFileSize(status.used_bytes)} de {formatFileSize(status.total_bytes)}
            </div>
          </>
        }
      />

      {/* Pools ZFS observados */}
      <StatTile
        icon={<Boxes size={13} />}
        label="Pools"
        value={String(poolCount)}
        footer={<div style={caption}>almacenes ZFS</div>}
      />

      {/* Discos físicos detectados */}
      <StatTile
        icon={<HardDrive size={13} />}
        label="Discos"
        value={String(diskCount)}
        footer={<div style={caption}>físicos</div>}
      />

      {/* Salud global */}
      <StatTile
        icon={<Activity size={13} />}
        label="Salud"
        value={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '1rem', fontWeight: 600 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: healthColor, flexShrink: 0 }} />
            <span style={{ color: 'var(--text)' }}>{healthLabel}</span>
          </span>
        }
        footer={
          <div style={caption}>
            {isUnknownHealth ? 'SMART no disponible (solo bare-metal)' : 'estado del almacenamiento'}
          </div>
        }
      />
    </div>
  );
}
