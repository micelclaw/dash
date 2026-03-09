import { useState, useEffect, useCallback } from 'react';
import { Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProUpsellPanel } from '@/components/shared/ProUpsellPanel';
import { getPreviewUrl } from '@/lib/file-utils';
import type { DejaVuCollection } from './types';

interface PhotosDejaVuProps {
  onViewPhoto?: (photoId: string) => void;
}

export function PhotosDejaVu({ onViewPhoto }: PhotosDejaVuProps) {
  const isPro = useAuthStore(s => s.user?.tier === 'pro');
  const [collections, setCollections] = useState<DejaVuCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: DejaVuCollection[] }>('/photos/deja-vu');
      setCollections(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (isPro) fetchCollections();
    else setLoading(false);
  }, [isPro, fetchCollections]);

  if (!isPro) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ProUpsellPanel feature="Visual Deja Vu" description="Discover visually similar photos taken at different times." />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: 120, background: 'var(--surface)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <EmptyState
          icon={Eye}
          title="No Deja Vu yet"
          description="As photos are processed, visually similar groups will appear here."
        />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginBottom: 4 }}>
        {collections.length} collection{collections.length !== 1 ? 's' : ''} of visually similar photos
      </div>

      {collections.map(col => {
        const isExpanded = expandedId === col.id;
        const previewIds = isExpanded ? col.photo_ids : col.photo_ids.slice(0, 5);

        return (
          <div
            key={col.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : col.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                textAlign: 'left',
              }}
            >
              {isExpanded
                ? <ChevronDown size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                : <ChevronRight size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              }
              <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
                {col.title}
              </span>
              <span style={{
                fontSize: '0.6875rem', color: 'var(--text-dim)',
                padding: '2px 8px', background: 'var(--bg)',
                borderRadius: 'var(--radius-full)',
              }}>
                {col.photo_count} photos
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {formatDateRange(col.date_range.earliest, col.date_range.latest)}
              </span>
            </button>

            {/* Photo strip / grid */}
            <div style={{
              display: 'flex',
              flexWrap: isExpanded ? 'wrap' : 'nowrap',
              gap: 4,
              padding: '0 14px 10px',
              overflow: isExpanded ? 'visible' : 'hidden',
            }}>
              {previewIds.map(photoId => (
                <div
                  key={photoId}
                  onClick={() => onViewPhoto?.(photoId)}
                  style={{
                    width: isExpanded ? 100 : 80,
                    height: isExpanded ? 100 : 80,
                    flexShrink: 0,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '1px solid var(--border)',
                  }}
                >
                  <img
                    src={getPreviewUrl(photoId, 120)}
                    alt=""
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))}
              {!isExpanded && col.photo_ids.length > 5 && (
                <div style={{
                  width: 80, height: 80, flexShrink: 0,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8125rem',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedId(col.id)}
                >
                  +{col.photo_ids.length - 5}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDateRange(earliest: string, latest: string): string {
  const e = new Date(earliest);
  const l = new Date(latest);
  const eMonth = e.toLocaleDateString('en', { month: 'short', year: 'numeric' });
  const lMonth = l.toLocaleDateString('en', { month: 'short', year: 'numeric' });
  return eMonth === lMonth ? eMonth : `${eMonth} — ${lMonth}`;
}
