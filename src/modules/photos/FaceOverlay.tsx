import { useState, useEffect, useCallback } from 'react';
import { usePhotoAiStore, type FaceDetection } from '@/stores/photo-ai.store';

interface FaceOverlayProps {
  imageWidth: number;
  imageHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onFaceClick: (detection: FaceDetection) => void;
}

interface ImageBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function FaceOverlay({ imageWidth, imageHeight, containerRef, onFaceClick }: FaceOverlayProps) {
  const faceDetections = usePhotoAiStore((s) => s.faceDetections);
  const showOverlay = usePhotoAiStore((s) => s.showFaceOverlay);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [imageBounds, setImageBounds] = useState<ImageBounds | null>(null);

  const calculate = useCallback(() => {
    const container = containerRef.current;
    if (!container || !imageWidth || !imageHeight) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const imageAspect = imageWidth / imageHeight;
    const containerAspect = cw / ch;

    let renderedW: number, renderedH: number, offsetX: number, offsetY: number;

    if (imageAspect > containerAspect) {
      renderedW = cw;
      renderedH = cw / imageAspect;
      offsetX = 0;
      offsetY = (ch - renderedH) / 2;
    } else {
      renderedH = ch;
      renderedW = ch * imageAspect;
      offsetX = (cw - renderedW) / 2;
      offsetY = 0;
    }

    setImageBounds({ x: offsetX, y: offsetY, w: renderedW, h: renderedH });
  }, [containerRef, imageWidth, imageHeight]);

  useEffect(() => {
    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [calculate]);

  if (!showOverlay || !faceDetections || faceDetections.length === 0 || !imageBounds) {
    return null;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {faceDetections.map((face) => {
        const bbox = face.bounding_box;
        if (!bbox) return null;

        const left = imageBounds.x + bbox.x * imageBounds.w;
        const top = imageBounds.y + bbox.y * imageBounds.h;
        const width = bbox.width * imageBounds.w;
        const height = bbox.height * imageBounds.h;
        const isHovered = hoveredId === face.id;
        const hasName = !!face.cluster_name;

        return (
          <div key={face.id}>
            <div
              onMouseEnter={() => setHoveredId(face.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => { e.stopPropagation(); onFaceClick(face); }}
              style={{
                position: 'absolute',
                left, top, width, height,
                border: `2px solid ${isHovered ? 'var(--amber)' : 'rgba(255,255,255,0.5)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                pointerEvents: 'auto',
                transition: 'border-color 0.15s, background 0.15s',
                background: isHovered ? 'rgba(255,200,0,0.1)' : 'transparent',
              }}
            />
            {isHovered && (
              <div
                style={{
                  position: 'absolute',
                  left: left + width / 2,
                  top: top - 26,
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.85)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 8px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: hasName ? 'var(--amber)' : 'rgba(255,255,255,0.6)',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {face.cluster_name ?? 'Unknown'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
