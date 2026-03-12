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

import { useState, useCallback } from 'react';
import { Plus, Eye, EyeOff, Lock, Unlock, Trash2, Layers } from 'lucide-react';
import { useDiagramsStore } from '@/stores/diagrams.store';
import type { DiagramLayer } from '../types';

const EMPTY_LAYERS: DiagramLayer[] = [];

export function LayerPanel() {
  const [open, setOpen] = useState(false);
  const layers = useDiagramsStore((s) => {
    const page = s.pages.find((p) => p.id === s.activePageId);
    return page?.layers ?? EMPTY_LAYERS;
  });
  const addLayer = useDiagramsStore((s) => s.addLayer);
  const removeLayer = useDiagramsStore((s) => s.removeLayer);
  const updateLayer = useDiagramsStore((s) => s.updateLayer);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleDoubleClick = useCallback((layer: DiagramLayer) => {
    setEditingId(layer.id);
    setEditValue(layer.name);
  }, []);

  const confirmRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      updateLayer(editingId, { name: editValue.trim() });
    }
    setEditingId(null);
  }, [editingId, editValue, updateLayer]);

  return (
    <>
      {/* Toggle button — bottom-left of canvas */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Layers"
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          width: 32,
          height: 32,
          borderRadius: 6,
          background: open ? 'var(--amber, #d4a017)' : 'var(--surface, #1a1a1a)',
          color: open ? '#000' : 'var(--text-dim, #94a3b8)',
          border: `1px solid ${open ? 'var(--amber, #d4a017)' : 'var(--border, #333)'}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <Layers size={15} />
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            left: 12,
            width: 220,
            background: 'var(--surface, #1a1a1a)',
            border: '1px solid var(--border, #333)',
            borderRadius: 8,
            zIndex: 10,
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderBottom: '1px solid var(--border, #333)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-sans)' }}>
              Layers
            </span>
            <button
              onClick={() => addLayer()}
              title="Add layer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: 4,
                background: 'none',
                border: 'none',
                color: 'var(--text-dim, #64748b)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Layer list */}
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
            {[...layers].reverse().map((layer) => (
              <div
                key={layer.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Color dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: layer.color,
                    flexShrink: 0,
                  }}
                />

                {/* Name */}
                {editingId === layer.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={confirmRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontFamily: 'var(--font-sans)',
                      background: 'var(--background, #111)',
                      border: '1px solid var(--amber, #d4a017)',
                      borderRadius: 3,
                      color: 'var(--text, #e2e8f0)',
                      padding: '1px 4px',
                      outline: 'none',
                      minWidth: 0,
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={() => handleDoubleClick(layer)}
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontFamily: 'var(--font-sans)',
                      color: layer.visible ? 'var(--text, #e2e8f0)' : 'var(--text-dim, #64748b)',
                      cursor: 'default',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textDecoration: layer.visible ? 'none' : 'line-through',
                      opacity: layer.visible ? 1 : 0.5,
                    }}
                  >
                    {layer.name}
                  </span>
                )}

                {/* Visibility toggle */}
                <button
                  onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  style={iconBtnStyle}
                >
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>

                {/* Lock toggle */}
                <button
                  onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
                  title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  style={iconBtnStyle}
                >
                  {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>

                {/* Delete */}
                {layers.length > 1 && (
                  <button
                    onClick={() => removeLayer(layer.id)}
                    title="Remove layer"
                    style={iconBtnStyle}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: 3,
  background: 'none',
  border: 'none',
  color: 'var(--text-dim, #64748b)',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
};
