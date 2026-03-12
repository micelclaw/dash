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
import { Dna, ArrowUp, ArrowDown, Minus, BarChart3 } from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProUpsellPanel } from '@/components/shared/ProUpsellPanel';
import type { PhotoDNASnapshot, PhotoDNAComparison } from './types';

type PeriodType = 'month' | 'quarter' | 'year';

export function PhotosDNA() {
  const isPro = useAuthStore(s => s.user?.tier === 'pro');
  const [snapshots, setSnapshots] = useState<PhotoDNASnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [comparison, setComparison] = useState<PhotoDNAComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const fetchSnapshots = useCallback(async (pt: PeriodType) => {
    setLoading(true);
    try {
      const res = await api.get<{ data: PhotoDNASnapshot[] }>('/photos/dna', { period_type: pt });
      setSnapshots(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (isPro) fetchSnapshots(periodType);
    else setLoading(false);
  }, [isPro, periodType, fetchSnapshots]);

  const handlePeriodChange = (pt: PeriodType) => {
    setPeriodType(pt);
    setCompareA(null);
    setCompareB(null);
    setComparison(null);
  };

  const handleSelectForCompare = (id: string) => {
    if (compareA === id) { setCompareA(null); return; }
    if (compareB === id) { setCompareB(null); return; }
    if (!compareA) { setCompareA(id); return; }
    if (!compareB) { setCompareB(id); return; }
    // Both set — replace B
    setCompareB(id);
  };

  const handleCompare = useCallback(async () => {
    if (!compareA || !compareB) return;
    setCompareLoading(true);
    try {
      const res = await api.get<{ data: PhotoDNAComparison }>('/photos/dna/compare', {
        a: compareA,
        b: compareB,
      });
      setComparison(res.data);
    } catch { /* ignore */ }
    finally { setCompareLoading(false); }
  }, [compareA, compareB]);

  if (!isPro) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ProUpsellPanel feature="Photo DNA" description="Track your visual profile over time — aesthetics, people, locations, and mood." />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 140, background: 'var(--surface)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>Photo DNA</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Your visual profile over time</div>
        </div>

        {/* Period toggle */}
        <div style={{
          display: 'flex', gap: 2,
          background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: 2,
        }}>
          {(['month', 'quarter', 'year'] as PeriodType[]).map(pt => (
            <button
              key={pt}
              onClick={() => handlePeriodChange(pt)}
              style={{
                padding: '4px 12px',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: periodType === pt ? 'var(--amber)' : 'transparent',
                color: periodType === pt ? '#000' : 'var(--text-dim)',
                fontWeight: periodType === pt ? 600 : 400,
              }}
            >
              {pt === 'month' ? 'Monthly' : pt === 'quarter' ? 'Quarterly' : 'Yearly'}
            </button>
          ))}
        </div>

        {/* Compare button */}
        {compareA && compareB && (
          <button
            onClick={handleCompare}
            disabled={compareLoading}
            style={{
              padding: '4px 14px', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: 'var(--amber)', color: '#000', fontWeight: 600,
              opacity: compareLoading ? 0.6 : 1,
            }}
          >
            {compareLoading ? 'Comparing...' : 'Compare'}
          </button>
        )}
      </div>

      {snapshots.length === 0 ? (
        <EmptyState
          icon={Dna}
          title="No Photo DNA yet"
          description="Snapshots are generated monthly from your processed photos."
        />
      ) : (
        <>
          {/* Snapshot cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {snapshots.map(snap => {
              const isSelectedA = compareA === snap.id;
              const isSelectedB = compareB === snap.id;
              const isSelected = isSelectedA || isSelectedB;

              return (
                <div
                  key={snap.id}
                  onClick={() => handleSelectForCompare(snap.id)}
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: 14,
                    cursor: 'pointer',
                    transition: 'border-color var(--transition-fast)',
                    position: 'relative',
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'var(--amber)', color: '#000',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.625rem', fontWeight: 700,
                    }}>
                      {isSelectedA ? 'A' : 'B'}
                    </div>
                  )}

                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                    {formatPeriodKey(snap.period_type, snap.period_key)}
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginBottom: 8 }}>
                    {snap.photo_count} photos
                    {snap.avg_aesthetic != null && ` · ★ ${snap.avg_aesthetic.toFixed(1)} avg`}
                  </div>

                  {/* Top faces */}
                  {snap.top_faces.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>People: </span>
                      {snap.top_faces.slice(0, 3).map((f, i) => (
                        <span key={f.cluster_id}>
                          {i > 0 && ', '}{f.name || 'Unknown'} ({f.count})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Top tags */}
                  {snap.top_tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {snap.top_tags.slice(0, 5).map(t => (
                        <span key={t.tag} style={{
                          padding: '1px 6px', fontSize: '0.625rem',
                          background: 'var(--bg)', borderRadius: 'var(--radius-full)',
                          color: 'var(--text-dim)', border: '1px solid var(--border)',
                        }}>
                          {t.tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Mood summary */}
                  {snap.mood_summary && Object.keys(snap.mood_summary).length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <MoodBar moods={snap.mood_summary} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Comparison result */}
          {comparison && <ComparisonCard comparison={comparison} />}
        </>
      )}
    </div>
  );
}

function ComparisonCard({ comparison }: { comparison: PhotoDNAComparison }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--amber)',
      borderRadius: 'var(--radius-md)',
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <BarChart3 size={16} style={{ color: 'var(--amber)' }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Comparison</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {/* Visual similarity */}
        {comparison.visual_similarity != null && (
          <StatItem
            label="Visual similarity"
            value={`${Math.round(comparison.visual_similarity * 100)}%`}
          />
        )}

        {/* Aesthetic delta */}
        {comparison.aesthetic_delta != null && (
          <StatItem
            label="Aesthetic"
            value={comparison.aesthetic_delta > 0 ? `+${comparison.aesthetic_delta.toFixed(2)}` : comparison.aesthetic_delta.toFixed(2)}
            icon={comparison.aesthetic_delta > 0 ? ArrowUp : comparison.aesthetic_delta < 0 ? ArrowDown : Minus}
            iconColor={comparison.aesthetic_delta > 0 ? 'var(--success)' : comparison.aesthetic_delta < 0 ? 'var(--error)' : 'var(--text-dim)'}
          />
        )}

        {/* Face changes */}
        {comparison.face_changes.appeared.length > 0 && (
          <StatItem
            label="New faces"
            value={comparison.face_changes.appeared.join(', ')}
          />
        )}
        {comparison.face_changes.disappeared.length > 0 && (
          <StatItem
            label="Less seen"
            value={comparison.face_changes.disappeared.join(', ')}
          />
        )}

        {/* Location changes */}
        {(comparison.location_changes.new_locations > 0 || comparison.location_changes.dropped_locations > 0) && (
          <StatItem
            label="Locations"
            value={`+${comparison.location_changes.new_locations} new, -${comparison.location_changes.dropped_locations} dropped`}
          />
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value, icon: Icon, iconColor }: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  iconColor?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {Icon && <Icon size={12} style={{ color: iconColor }} />}
        {value}
      </div>
    </div>
  );
}

function MoodBar({ moods }: { moods: Record<string, number> }) {
  const total = Object.values(moods).reduce((sum, v) => sum + v, 0);
  if (total === 0) return null;

  const MOOD_COLORS: Record<string, string> = {
    happy: '#22c55e',
    neutral: '#a3a3a3',
    sad: '#3b82f6',
    excited: '#f59e0b',
    calm: '#8b5cf6',
  };

  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
      {Object.entries(moods).map(([mood, count]) => (
        <div
          key={mood}
          title={`${mood}: ${Math.round((count / total) * 100)}%`}
          style={{
            flex: count,
            background: MOOD_COLORS[mood] || 'var(--text-muted)',
            minWidth: 2,
          }}
        />
      ))}
    </div>
  );
}

function formatPeriodKey(type: string, key: string): string {
  if (type === 'month') {
    const [year, month] = key.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  }
  if (type === 'quarter') return key; // "2026-Q1"
  return key; // year
}
