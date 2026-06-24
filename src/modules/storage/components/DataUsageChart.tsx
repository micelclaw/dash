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

// ─── "Uso de datos" — cuadro interactivo (100% cliente) ────────────
// Reescritura del antiguo "Data Usage by Category" en un panel con tres
// ámbitos conmutables (segmented control):
//   · Por categoría — el GroupedChart de siempre, ahora clicable: al pulsar
//     una barra se despliega un desglose inline (CollapsibleSection).
//   · Por almacén (pool) — solo si hay pools ZFS observados: barra de capacidad
//     por pool (reusa el patrón healthColor/capColor de ZfsSection) + sus
//     datasets hijos al desplegar.
//   · Por carpeta (dataset) — solo si hay datasets ZFS: barras por dataset con
//     selector de pool (Todos / tank / vault); al pulsar uno se ve el detalle
//     (usado/disponible/compresión/cifrado/snapshots de ese dataset).
// Fila-resumen (StatItem): Total usado · Snapshots · Libre.
// Popover de acciones (⋯): crear instantánea, verificar almacén, ver detalles.
// Estilo inline var(--*) (sin Tailwind), español llano. Sin tocar el backend:
// todo sale del store (data_usage + zfs_*).

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Camera, Waves, FileText, MoreHorizontal } from 'lucide-react';
import { formatFileSize } from '@/lib/file-utils';
import { useStorageStore } from '@/stores/storage.store';
import type { DataCategoryResult, ZfsPoolObservation, ZfsDatasetObservation } from '../types';
import { InfoTip, ZFS_COPY } from './ZfsHelp';
import { CollapsibleSection } from './CollapsibleSection';
import { CreateSnapshotForm } from './ZfsModals';

const CATEGORY_COLORS: Record<string, string> = {
  // User
  drive: '#3b82f6',
  photos: '#8b5cf6',
  attachments: '#06b6d4',
  // Others
  other_users: '#a78bfa',
  // System
  models: '#10b981',
  database: '#f59e0b',
  media: '#ec4899',
  crypto: '#f97316',
  backups: '#6366f1',
};

const DEFAULT_COLOR = '#6b7280';

const GROUP_LABELS: Record<string, string> = {
  user: 'Tu almacenamiento',
  others: 'Otros usuarios',
  system: 'Sistema',
};

// Paleta para las barras de pools/datasets (cíclica).
const POOL_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

// Tamaño seguro: formatFileSize peta con null/undefined/NaN.
function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return formatFileSize(n);
}

function formatCacheAge(seconds: number): string {
  if (seconds < 60) return 'ahora mismo';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return 'hace 1 min';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'hace 1 h';
  return `hace ${hours} h`;
}

// Color de la barra de capacidad según % ocupado (idéntico a ZfsSection).
function capColorFor(cap: number | null | undefined): string {
  if (cap == null) return 'var(--text-dim)';
  if (cap >= 90) return 'var(--error,#ef4444)';
  if (cap >= 80) return 'var(--warning,#f59e0b)';
  return 'var(--success,#22c55e)';
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      padding: '8px 12px', background: '#1a1a24', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ color: 'var(--text)', fontWeight: 500 }}>{d.label}</div>
      <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
        {d.size_bytes > 0 ? formatFileSize(d.size_bytes) : d.status === 'calculating' ? 'Calculando…' : '0 B'}
      </div>
    </div>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)',
      fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.04em',
      padding: '8px 0 4px 0',
    }}>
      {label}
    </div>
  );
}

// ── Modo "Por categoría": el gráfico de siempre, ahora con barras clicables ──
function GroupedChart({
  categories,
  onPick,
}: {
  categories: DataCategoryResult[];
  onPick?: (cat: DataCategoryResult) => void;
}) {
  const groups = ['user', 'others', 'system'] as const;

  return (
    <div>
      {groups.map((group) => {
        const items = categories.filter((c) => c.group === group);
        if (items.length === 0) return null;

        return (
          <div key={group}>
            <GroupHeader label={GROUP_LABELS[group] ?? group} />
            <ResponsiveContainer width="100%" height={Math.max(items.length * 34, 34)}>
              <BarChart layout="vertical" data={items} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <XAxis type="number" tickFormatter={(v: number) => formatFileSize(v)} tick={{ fontSize: 11, fill: '#7a7a8a' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12, fill: '#e0e0e8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar
                  dataKey="size_bytes"
                  radius={[0, 3, 3, 0]}
                  maxBarSize={20}
                  cursor={onPick ? 'pointer' : undefined}
                  onClick={(d: any) => { if (onPick && d?.payload) onPick(d.payload as DataCategoryResult); }}
                >
                  {items.map((cat) => (
                    <Cell
                      key={cat.name}
                      fill={cat.size_bytes > 0 ? (CATEGORY_COLORS[cat.name] ?? DEFAULT_COLOR) : '#2a2a38'}
                      opacity={cat.size_bytes > 0 ? 1 : 0.3}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}

// Fila de detalle clave/valor reutilizable en los desgloses.
function DetailRow({ label, value, tip }: { label: string; value: React.ReactNode; tip?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.8125rem', lineHeight: 1.7 }}>
      <span style={{ color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}{tip && <InfoTip text={tip} />}
      </span>
      <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// StatItem inline (mismo aspecto que FileStatsCard, pero con var(--*) inline).
function StatItem({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div>
      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      <div style={{
        fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        {label}{tip && <InfoTip text={tip} />}
      </div>
    </div>
  );
}

// Snapshots que pertenecen a un dataset (su nombre exacto o cualquier hijo).
function snapshotsOfDataset(snapshots: { full_name: string; used_bytes: number | null }[], dsName: string) {
  return snapshots.filter((s) => {
    const base = s.full_name.split('@')[0];
    return base === dsName || base.startsWith(`${dsName}/`);
  });
}

// Barra de capacidad reutilizable (pool o dataset).
function CapacityBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 10, background: 'var(--bg, #0001)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, height: '100%', background: color, transition: 'width .2s' }} />
    </div>
  );
}

type Scope = 'category' | 'pool' | 'dataset';

export function DataUsageChart() {
  const data_usage = useStorageStore((s) => s.data_usage);
  const status = useStorageStore((s) => s.status);
  const pools = useStorageStore((s) => s.zfs_pools);
  const datasets = useStorageStore((s) => s.zfs_datasets);
  const snapshots = useStorageStore((s) => s.zfs_snapshots);
  const caps = useStorageStore((s) => s.zfs_capabilities);
  const scrub = useStorageStore((s) => s.zfsScrub);

  const [scope, setScope] = useState<Scope>('category');
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [poolFilter, setPoolFilter] = useState<string>('__all__');
  const [menuOpen, setMenuOpen] = useState(false);
  const [snapTarget, setSnapTarget] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ámbitos disponibles (los que no tienen datos no se muestran; degradan a categoría).
  const hasPools = pools.length > 0;
  const hasDatasets = datasets.length > 0;

  // Si el ámbito activo deja de tener datos (p. ej. se apaga el demo), volvemos a categoría.
  useEffect(() => {
    if (scope === 'pool' && !hasPools) setScope('category');
    if (scope === 'dataset' && !hasDatasets) setScope('category');
  }, [scope, hasPools, hasDatasets]);

  // Cierra el popover al hacer clic fuera o pulsar Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  // Suma de espacio de snapshots (ocupan aparte del uso lógico).
  const snapTotal = useMemo(
    () => snapshots.reduce((acc, s) => acc + (s.used_bytes ?? 0), 0),
    [snapshots],
  );

  // Totales para la fila-resumen. Si hay pools ZFS, son la fuente más fiel de
  // usado/libre; si no, caemos al total de categorías de data_usage para el
  // usado y al free del status de almacenamiento (si lo hay) para el libre.
  const summary = useMemo(() => {
    if (hasPools) {
      const used = pools.reduce((a, p) => a + (p.alloc_bytes ?? 0), 0);
      const free = pools.reduce((a, p) => a + (p.free_bytes ?? 0), 0);
      return { used, free, hasFree: true };
    }
    const free = status?.free_bytes;
    return {
      used: data_usage?.total_data_bytes ?? 0,
      free: free ?? 0,
      hasFree: typeof free === 'number' && Number.isFinite(free),
    };
  }, [hasPools, pools, data_usage, status]);

  // Datasets filtrados por pool (para el modo carpeta), ordenados por uso.
  const filteredDatasets = useMemo(() => {
    const list = poolFilter === '__all__'
      ? datasets
      : datasets.filter((d) => d.name.split('/')[0] === poolFilter);
    return [...list].sort((a, b) => (b.used_bytes ?? 0) - (a.used_bytes ?? 0));
  }, [datasets, poolFilter]);

  const poolNames = useMemo(() => pools.map((p) => p.name), [pools]);

  if (!data_usage) {
    return (
      <div style={{
        padding: '20px 16px', background: 'var(--surface)',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', height: 280,
      }}>
        <div style={{ height: 12, width: '40%', background: 'var(--card)', borderRadius: 4 }} />
      </div>
    );
  }

  const segments: { id: Scope; label: string }[] = [
    { id: 'category', label: 'Por categoría' },
    ...(hasPools ? [{ id: 'pool' as const, label: 'Por almacén (pool)' }] : []),
    ...(hasDatasets ? [{ id: 'dataset' as const, label: 'Por carpeta (dataset)' }] : []),
  ];

  const onScrubAll = async () => {
    setMenuOpen(false);
    for (const p of pools) {
      try { await scrub(p.name); } catch { /* el store ya togglea toast en real */ }
    }
  };

  return (
    <div style={{
      padding: '16px', background: 'var(--surface)',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
    }}>
      {/* Barra de controles del cuadro: edad de la caché + popover de acciones.
          El título de la zona lo provee el SectionHeader en StoragePage. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            Actualizado {formatCacheAge(data_usage.cache_age_seconds)}
          </span>
          <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              type="button"
              aria-label="Acciones de uso de datos"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, padding: 0, border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', background: menuOpen ? 'var(--surface-hover, var(--card))' : 'transparent',
                color: 'var(--text-dim)', cursor: 'pointer',
              }}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, minWidth: 230,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                  padding: 4, display: 'flex', flexDirection: 'column',
                }}
              >
                {caps?.can_snapshot && (
                  <MenuItem
                    icon={<Camera size={14} />}
                    label="Crear instantánea"
                    onClick={() => { setMenuOpen(false); setSnapTarget(datasets[0]?.name ?? pools[0]?.name ?? 'tank'); }}
                  />
                )}
                {caps?.can_scrub && hasPools && (
                  <MenuItem
                    icon={<Waves size={14} />}
                    label="Verificar almacén"
                    onClick={onScrubAll}
                  />
                )}
                <MenuItem
                  icon={<FileText size={14} />}
                  label="Ver detalles de archivos"
                  onClick={() => {
                    setMenuOpen(false);
                    document.querySelector('[data-storage-file-stats]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Segmented control de ámbito (solo si hay más de uno) */}
      {segments.length > 1 && (
        <div style={{
          display: 'inline-flex', gap: 2, padding: 2, marginBottom: 12,
          background: 'var(--bg, var(--card))', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        }}>
          {segments.map((s) => {
            const active = scope === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { setScope(s.id); setOpenCat(null); }}
                style={{
                  padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  border: 'none', borderRadius: 'calc(var(--radius-sm) - 2px)',
                  background: active ? 'var(--mod-storage, var(--accent))' : 'transparent',
                  color: active ? '#fff' : 'var(--text-dim)', fontFamily: 'var(--font-sans)',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Zona de gráfico conmutable */}
      {scope === 'category' && (
        <CategoryScope
          categories={data_usage.categories}
          openCat={openCat}
          setOpenCat={setOpenCat}
        />
      )}

      {scope === 'pool' && hasPools && (
        <PoolScope pools={pools} datasets={datasets} snapshots={snapshots} />
      )}

      {scope === 'dataset' && hasDatasets && (
        <DatasetScope
          datasets={filteredDatasets}
          snapshots={snapshots}
          poolNames={poolNames}
          poolFilter={poolFilter}
          setPoolFilter={setPoolFilter}
          canSnapshot={!!caps?.can_snapshot}
          onSnapshot={setSnapTarget}
        />
      )}

      {/* Fila-resumen */}
      <div style={{
        display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 14, paddingTop: 12,
        borderTop: '1px solid var(--border)',
      }}>
        <StatItem label="Total usado" value={fmt(summary.used)} />
        <StatItem
          label="Snapshots"
          value={fmt(snapTotal)}
          tip={ZFS_COPY.usage_snapshots}
        />
        {summary.hasFree && <StatItem label="Libre" value={fmt(summary.free)} />}
      </div>

      {/* Modal de crear instantánea */}
      {snapTarget && <CreateSnapshotForm target={snapTarget} onClose={() => setSnapTarget(null)} />}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px',
        background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        color: 'var(--text)', fontSize: '0.8125rem', textAlign: 'left', fontFamily: 'var(--font-sans)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover, var(--card))'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ display: 'inline-flex', color: 'var(--mod-storage)', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Ámbito: Por categoría ──────────────────────────────────────────
function CategoryScope({
  categories,
  openCat,
  setOpenCat,
}: {
  categories: DataCategoryResult[];
  openCat: string | null;
  setOpenCat: (name: string | null) => void;
}) {
  const total = categories.reduce((a, c) => a + (c.size_bytes ?? 0), 0);
  const picked = categories.find((c) => c.name === openCat) ?? null;
  const pct = picked && total > 0 ? (picked.size_bytes / total) * 100 : 0;

  return (
    <div>
      <GroupedChart
        categories={categories}
        onPick={(cat) => setOpenCat(openCat === cat.name ? null : cat.name)}
      />
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
        Pulsa una barra para ver su desglose.
      </div>
      {picked && (
        <div style={{ marginTop: 10 }}>
          <CollapsibleSection title={picked.label} defaultOpen>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <DetailRow label="Grupo" value={GROUP_LABELS[picked.group] ?? picked.group} />
              <DetailRow label="Espacio usado" value={fmt(picked.size_bytes)} />
              <DetailRow
                label="Porcentaje del total"
                value={total > 0 ? `${pct.toFixed(1)} %` : '—'}
              />
              <DetailRow
                label="Estado"
                value={
                  picked.status === 'calculating' ? 'Calculando…'
                  : picked.status === 'timeout' ? 'Cálculo expirado'
                  : picked.status === 'empty' ? 'Vacío'
                  : 'Calculado'
                }
              />
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

// ── Ámbito: Por almacén (pool) ─────────────────────────────────────
function PoolScope({
  pools,
  datasets,
  snapshots,
}: {
  pools: ZfsPoolObservation[];
  datasets: ZfsDatasetObservation[];
  snapshots: { full_name: string; used_bytes: number | null }[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pools.map((p, i) => {
        const cap = p.cap_pct ?? (p.size_bytes ? Math.round(((p.alloc_bytes ?? 0) / p.size_bytes) * 100) : 0);
        const children = datasets.filter((d) => d.name.split('/')[0] === p.name);
        return (
          <CollapsibleSection
            key={p.name}
            title={p.name}
            count={children.length}
            defaultOpen={i === 0}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CapacityBar pct={cap} color={capColorFor(cap)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                <span>{cap}% ocupado · {fmt(p.alloc_bytes)} de {fmt(p.size_bytes)}</span>
                <span>{fmt(p.free_bytes)} libres</span>
              </div>
              {children.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                  <div style={{
                    fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2,
                  }}>
                    Carpetas
                  </div>
                  {children
                    .slice()
                    .sort((a, b) => (b.used_bytes ?? 0) - (a.used_bytes ?? 0))
                    .map((d) => {
                      const snaps = snapshotsOfDataset(snapshots, d.name);
                      const snapBytes = snaps.reduce((acc, s) => acc + (s.used_bytes ?? 0), 0);
                      return (
                        <DetailRow
                          key={d.name}
                          label={d.name.split('/').slice(1).join('/') || d.name}
                          value={
                            <>
                              {fmt(d.used_bytes)}
                              {snaps.length > 0 && (
                                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {snaps.length} snap ({fmt(snapBytes)})</span>
                              )}
                            </>
                          }
                        />
                      );
                    })}
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                  Este almacén todavía no tiene carpetas gestionadas.
                </div>
              )}
            </div>
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

// ── Ámbito: Por carpeta (dataset) ──────────────────────────────────
function DatasetScope({
  datasets,
  snapshots,
  poolNames,
  poolFilter,
  setPoolFilter,
  canSnapshot,
  onSnapshot,
}: {
  datasets: ZfsDatasetObservation[];
  snapshots: { full_name: string; used_bytes: number | null }[];
  poolNames: string[];
  poolFilter: string;
  setPoolFilter: (v: string) => void;
  canSnapshot: boolean;
  onSnapshot: (target: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const maxUsed = Math.max(1, ...datasets.map((d) => d.used_bytes ?? 0));

  return (
    <div>
      {/* Selector de pool: Todos / tank / vault … */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Almacén
        </span>
        {[{ id: '__all__', label: 'Todos' }, ...poolNames.map((n) => ({ id: n, label: n }))].map((opt) => {
          const active = poolFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setPoolFilter(opt.id); setOpen(null); }}
              style={{
                padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
                borderRadius: 'var(--radius-pill, 999px)',
                background: active ? 'color-mix(in srgb, var(--mod-storage) 14%, transparent)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {datasets.length === 0 && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', padding: '8px 0' }}>
          No hay carpetas en este almacén.
        </div>
      )}

      {/* Barras por dataset + desglose al pulsar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {datasets.map((d, i) => {
          const used = d.used_bytes ?? 0;
          const w = (used / maxUsed) * 100;
          const color = POOL_COLORS[i % POOL_COLORS.length];
          const shortName = d.name.split('/').slice(1).join('/') || d.name;
          const isOpen = open === d.name;
          const snaps = snapshotsOfDataset(snapshots, d.name);
          const snapBytes = snaps.reduce((acc, s) => acc + (s.used_bytes ?? 0), 0);
          // Cuota (refquota): si existe, mostramos cuánto del tope se usa.
          const quota = d.refquota_bytes ?? d.quota_bytes ?? null;
          const quotaPct = quota ? Math.round((used / quota) * 100) : null;

          return (
            <div key={d.name}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : d.name)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: 'transparent', border: 'none', padding: '4px 0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>
                    {shortName}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                    {fmt(used)}
                    {quotaPct != null && (
                      <span style={{ color: quotaPct >= 90 ? 'var(--error,#ef4444)' : quotaPct >= 80 ? 'var(--warning,#f59e0b)' : 'var(--text-muted)' }}>
                        {' '}/ {fmt(quota)} ({quotaPct}%)
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--bg, #0001)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ width: `${Math.min(w, 100)}%`, height: '100%', background: color, transition: 'width .2s' }} />
                </div>
              </button>

              {isOpen && (
                <div style={{ marginTop: 8, marginBottom: 4 }}>
                  <CollapsibleSection title={`Detalle de ${shortName}`} defaultOpen>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <DetailRow label="Ruta completa" value={d.name} />
                      <DetailRow
                        label="Usado"
                        value={fmt(used)}
                        tip={ZFS_COPY.usage_logical_vs_physical}
                      />
                      <DetailRow label="Disponible" value={fmt(d.available_bytes)} />
                      {quota != null && (
                        <DetailRow label="Cuota (refquota)" value={`${fmt(quota)}${quotaPct != null ? ` · ${quotaPct}% usado` : ''}`} />
                      )}
                      <DetailRow
                        label="Compresión"
                        value={d.compression && d.compression !== 'off' ? d.compression : '—'}
                      />
                      <DetailRow
                        label="Cifrado"
                        value={d.encryption && d.encryption !== 'off' ? 'Sí' : '—'}
                      />
                      <DetailRow
                        label="Instantáneas"
                        value={snaps.length > 0 ? `${snaps.length} · ${fmt(snapBytes)}` : 'ninguna'}
                        tip={ZFS_COPY.usage_snapshots}
                      />
                    </div>
                    {canSnapshot && d.type !== 'volume' && (
                      <button
                        type="button"
                        onClick={() => onSnapshot(d.name)}
                        style={{
                          marginTop: 10, padding: '6px 12px', fontSize: '0.8125rem', cursor: 'pointer',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                          background: 'transparent', color: 'var(--text)', display: 'inline-flex',
                          alignItems: 'center', gap: 6, fontWeight: 500,
                        }}
                      >
                        <Camera size={13} /> Crear instantánea de esta carpeta
                      </button>
                    )}
                  </CollapsibleSection>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
