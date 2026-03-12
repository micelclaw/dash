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

import { useState } from 'react';
import { X, Image } from 'lucide-react';
import { usePhotoAiStore } from '@/stores/photo-ai.store';
import { getPreviewUrl } from '@/lib/file-utils';

interface SimilarPhotosPanelProps {
  onNavigateToPhoto: (photoId: string) => void;
}

export function SimilarPhotosPanel({ onNavigateToPhoto }: SimilarPhotosPanelProps) {
  const similarResults = usePhotoAiStore((s) => s.similarResults);
  const similarLoading = usePhotoAiStore((s) => s.similarLoading);
  const similarMode = usePhotoAiStore((s) => s.similarMode);
  const setSimilarMode = usePhotoAiStore((s) => s.setSimilarMode);
  const closeSimilarPanel = usePhotoAiStore((s) => s.closeSimilarPanel);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const tabStyle = (mode: 'visual' | 'concept'): React.CSSProperties => ({
    flex: 1,
    padding: '5px 0',
    fontSize: '0.6875rem',
    fontFamily: 'var(--font-sans)',
    fontWeight: similarMode === mode ? 600 : 400,
    border: 'none',
    borderBottom: similarMode === mode ? '2px solid var(--amber)' : '2px solid transparent',
    background: 'transparent',
    color: similarMode === mode ? 'var(--amber)' : 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    transition: 'color 0.1s, border-color 0.1s',
  });

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        background: 'rgba(0,0,0,0.8)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 12px 8px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#fff',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Similar photos
        </span>
        <button
          onClick={closeSimilarPanel}
          onMouseEnter={() => setHoveredBtn('close')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: hoveredBtn === 'close' ? 'rgba(255,255,255,0.15)' : 'transparent',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          margin: '0 12px',
          flexShrink: 0,
        }}
      >
        <button style={tabStyle('visual')} onClick={() => setSimilarMode('visual')}>
          Visual
        </button>
        <button style={tabStyle('concept')} onClick={() => setSimilarMode('concept')}>
          Concept
        </button>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {similarLoading ? (
          <div
            style={{
              padding: '32px 0',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Finding similar photos...
          </div>
        ) : !similarResults || similarResults.length === 0 ? (
          <div
            style={{
              padding: '32px 0',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            No similar photos found
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 4,
            }}
          >
            {similarResults.map((result) => (
              <SimilarThumbnail
                key={result.id}
                id={result.id}
                filename={result.filename}
                similarity={result.similarity}
                onClick={() => onNavigateToPhoto(result.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SimilarThumbnail({
  id,
  filename,
  similarity,
  onClick,
}: {
  id: string;
  filename: string;
  similarity: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const previewUrl = getPreviewUrl(id, 300);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${filename}\n${Math.round(similarity * 100)}% similar`}
      style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform var(--transition-fast)',
        background: 'rgba(255,255,255,0.05)',
      }}
    >
      {!imgError ? (
        <img
          src={previewUrl}
          alt={filename}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image size={20} style={{ opacity: 0.3, color: '#fff' }} />
        </div>
      )}

      {/* Similarity badge */}
      <div
        style={{
          position: 'absolute',
          bottom: 3,
          right: 3,
          background: 'rgba(0,0,0,0.75)',
          borderRadius: 'var(--radius-sm)',
          padding: '2px 4px',
          fontSize: '0.5625rem',
          fontWeight: 600,
          color: 'var(--amber)',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1,
        }}
      >
        {Math.round(similarity * 100)}%
      </div>
    </div>
  );
}
