import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import Draggable from 'react-draggable';
import { Minus, X } from 'lucide-react';
import { useFloatingPanelsStore, type PanelId } from '@/stores/floating-panels.store';
import { useIsMobile } from '@/hooks/use-media-query';

interface FloatingPanelProps {
  id: PanelId;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export function FloatingPanel({ id, title, icon, children }: FloatingPanelProps) {
  const panels = useFloatingPanelsStore((s) => s.panels);
  const closePanel = useFloatingPanelsStore((s) => s.closePanel);
  const minimizePanel = useFloatingPanelsStore((s) => s.minimizePanel);
  const bringToFront = useFloatingPanelsStore((s) => s.bringToFront);
  const updatePosition = useFloatingPanelsStore((s) => s.updatePosition);
  const isMobile = useIsMobile();
  const nodeRef = useRef<HTMLDivElement>(null);

  const panel = panels.get(id);

  // Close on Escape
  useEffect(() => {
    if (!panel || panel.minimized) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel(id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [panel, id, closePanel]);

  const handleDragStop = useCallback((_: unknown, data: { x: number; y: number }) => {
    updatePosition(id, { x: data.x, y: data.y });
  }, [id, updatePosition]);

  const handleMouseDown = useCallback(() => {
    bringToFront(id);
  }, [id, bringToFront]);

  if (!panel || panel.minimized) return null;

  const titleBar = (
    <div
      className={isMobile ? undefined : 'panel-drag-handle'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        height: 36,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        cursor: isMobile ? 'default' : 'move',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
        {icon}
        <span>{title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {!isMobile && (
          <button
            onClick={(e) => { e.stopPropagation(); minimizePanel(id); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, background: 'transparent', border: 'none',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Minus size={14} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); closePanel(id); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, background: 'transparent', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--error)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );

  const content = (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {children}
    </div>
  );

  // Mobile: full-screen overlay (no drag)
  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'color-mix(in srgb, var(--card) 85%, transparent)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {titleBar}
        {content}
      </div>
    );
  }

  // Desktop: draggable floating panel
  return (
    <Draggable
      nodeRef={nodeRef as React.RefObject<HTMLElement>}
      handle=".panel-drag-handle"
      position={panel.position}
      onStop={handleDragStop}
      bounds="parent"
    >
      <div
        ref={nodeRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          zIndex: panel.zIndex,
          width: panel.size.width,
          height: panel.size.height,
          pointerEvents: 'auto',
          background: 'color-mix(in srgb, var(--card) 85%, transparent)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {titleBar}
        {content}
      </div>
    </Draggable>
  );
}
