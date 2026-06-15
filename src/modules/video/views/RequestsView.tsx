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

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Clapperboard, Download, Inbox, Search } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  MEDIA_STATUS_AVAILABLE,
  type DiscoverResult,
} from '@/services/video.service';
import { useVideoStore } from '@/stores/video.store';
import { RequestModal, discoverTitle, discoverYear, tmdbPosterUrl } from '../components/RequestModal';
import { StatusBadge, requestDisplayStatus } from '../components/StatusBadge';

function DiscoverCard({
  result,
  onRequest,
}: {
  result: DiscoverResult;
  onRequest: (r: DiscoverResult) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const poster = tmdbPosterUrl(result.poster_path);
  const available = result.media_info?.status === MEDIA_STATUS_AVAILABLE;
  const alreadyKnown = !!result.media_info;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          width: 64,
          aspectRatio: '2 / 3',
          flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {poster && !imgError ? (
          <img
            src={poster}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Clapperboard size={20} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {discoverTitle(result)}
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {result.media_type === 'tv' ? 'Series' : 'Movie'}
          {discoverYear(result) && ` · ${discoverYear(result)}`}
        </div>
        {result.overview && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {result.overview}
          </div>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 4 }}>
          {available ? (
            <StatusBadge status="available" />
          ) : alreadyKnown ? (
            <StatusBadge status="pending" />
          ) : (
            <button
              onClick={() => onRequest(result)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                border: 'none',
                background: 'var(--amber)',
                color: '#06060a',
                fontWeight: 600,
              }}
            >
              <Download size={12} /> Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Requests tab — Jellyseerr discover search + existing request list. When
 * Jellyseerr is not installed, an explanatory empty state links to Servarr.
 */
export function RequestsView() {
  const navigate = useNavigate();
  const jellyseerrUnavailable = useVideoStore((s) => s.jellyseerrUnavailable);
  const discoverResults = useVideoStore((s) => s.discoverResults);
  const loadingDiscover = useVideoStore((s) => s.loadingDiscover);
  const requests = useVideoStore((s) => s.requests);
  const loadingRequests = useVideoStore((s) => s.loadingRequests);

  const [query, setQuery] = useState('');
  const [requestTarget, setRequestTarget] = useState<DiscoverResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!jellyseerrUnavailable && requests === null) {
      void useVideoStore.getState().loadRequests();
    }
  }, [jellyseerrUnavailable, requests]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (jellyseerrUnavailable) {
    return (
      <EmptyState
        icon={Download}
        title="Jellyseerr is not installed"
        description="Media requests are powered by Jellyseerr. Install and start it from the Servarr module to discover and request new movies and series."
        actions={[
          { label: 'Open Servarr', onClick: () => navigate('/multimedia'), variant: 'primary' },
          {
            label: 'Retry',
            onClick: () => {
              const store = useVideoStore.getState();
              void store.checkStatus().then(() => {
                if (!useVideoStore.getState().jellyseerrUnavailable) void store.loadRequests();
              });
            },
            variant: 'secondary',
          },
        ]}
      />
    );
  }

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void useVideoStore.getState().loadDiscover(value);
    }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16, fontFamily: 'var(--font-sans)' }}>
      {/* Discover search */}
      <section>
        <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
          Discover
        </h3>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 12px',
            maxWidth: 420,
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search movies & series to request…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              width: '100%',
            }}
          />
        </div>

        {loadingDiscover && (
          <div style={{ padding: '16px 0', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
            Searching…
          </div>
        )}

        {!loadingDiscover && discoverResults && (
          discoverResults.length === 0 ? (
            <div style={{ padding: '16px 0', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
              No matches found.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
                marginTop: 16,
              }}
            >
              {discoverResults.map((result) => (
                <DiscoverCard
                  key={`${result.media_type}-${result.id}`}
                  result={result}
                  onRequest={setRequestTarget}
                />
              ))}
            </div>
          )
        )}
      </section>

      {/* Existing requests */}
      <section>
        <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
          Your requests
        </h3>
        {loadingRequests && !requests ? (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.8125rem' }}>Loading…</div>
        ) : !requests || requests.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-dim)',
              fontSize: '0.8125rem',
            }}
          >
            <Inbox size={16} /> No requests yet — search above to request something.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {requests.map((req) => (
              <div
                key={req.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                }}
              >
                <Clapperboard size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
                    {req.media?.title ??
                      `${req.media?.media_type === 'tv' ? 'Series' : 'Movie'} · TMDB ${req.media?.tmdb_id ?? '?'}`}
                  </span>
                  {req.created_at && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 10 }}>
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <StatusBadge status={requestDisplayStatus(req)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <RequestModal result={requestTarget} onClose={() => setRequestTarget(null)} />
    </div>
  );
}
