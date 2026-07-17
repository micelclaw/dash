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

import { ZoomIn, ZoomOut, Maximize, Pause, Play, Eye, EyeOff, Plus, Minus } from 'lucide-react';
import { DEFAULT_FOV_3D, FOV_MIN_3D, FOV_MAX_3D } from './three-contracts';

interface GraphZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleFreeze: () => void;
  frozen: boolean;
  onToggleHulls: () => void;
  showHulls: boolean;
  is3D?: boolean;
  fov?: number;
  onFovChange?: (v: number) => void;
  // Ego-red por grados: muestra solo el nodo seleccionado y su vecindario a N saltos.
  egoDegree?: number;
  egoEnabled?: boolean; // hay un nodo seleccionado
  onEgoPlus?: () => void;
  onEgoMinus?: () => void;
}

const BTN_STYLE: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  borderRadius: 'var(--radius-sm)',
  transition: 'color var(--transition-fast), background var(--transition-fast)',
};

/** Cajita compartida por el panel de botones y el control de FOV (mismo look). */
const PANEL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
  backdropFilter: 'blur(8px)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 4,
};

export function GraphZoomControls({
  onZoomIn, onZoomOut, onZoomReset, onToggleFreeze, frozen, onToggleHulls, showHulls,
  is3D, fov, onFovChange,
  egoDegree = 0, egoEnabled = false, onEgoPlus, onEgoMinus,
}: GraphZoomControlsProps) {
  const showEgo = !!(onEgoPlus && onEgoMinus);
  // Activo si hay nodo seleccionado (engancha) o si ya estamos en ego (permite ±).
  const egoActive = egoEnabled || egoDegree > 0;
  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      right: 16,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 8,
    }}>
      {is3D && onFovChange && (
        <div
          style={{ ...PANEL_STYLE, alignItems: 'center', gap: 4, padding: '8px 4px' }}
          title="Campo de visión (FOV)"
        >
          <input
            type="range"
            min={FOV_MIN_3D}
            max={FOV_MAX_3D}
            step={1}
            value={fov ?? DEFAULT_FOV_3D}
            onChange={e => onFovChange(Number(e.currentTarget.value))}
            title="Campo de visión (FOV)"
            style={{
              // Slider vertical (valores altos arriba), compacto junto a la columna de botones.
              writingMode: 'vertical-lr',
              direction: 'rtl',
              width: 16,
              height: 72,
              cursor: 'pointer',
              accentColor: 'var(--amber)',
            }}
          />
          <span style={{
            fontSize: 10,
            lineHeight: '12px',
            color: 'var(--text-dim)',
            fontVariantNumeric: 'tabular-nums',
            userSelect: 'none',
          }}>
            {Math.round(fov ?? DEFAULT_FOV_3D)}°
          </span>
        </div>
      )}

      <div style={PANEL_STYLE}>
        {showEgo && (
          <>
            <button
              onClick={onEgoPlus}
              disabled={!egoActive}
              style={{ ...BTN_STYLE, opacity: egoActive ? 1 : 0.35, cursor: egoActive ? 'pointer' : 'default' }}
              title={egoActive
                ? 'Mostrar el nodo y su vecindario · + un grado más'
                : 'Selecciona un nodo primero'}
              onMouseEnter={e => { if (egoActive) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; } }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
            >
              <Plus size={16} />
            </button>
            <span style={{
              textAlign: 'center',
              fontSize: 10,
              lineHeight: '12px',
              color: egoDegree > 0 ? 'var(--amber)' : 'var(--text-dim)',
              fontVariantNumeric: 'tabular-nums',
              userSelect: 'none',
            }} title="Grado de la ego-red (0 = grafo completo)">
              {egoDegree > 0 ? `G${egoDegree}` : '·'}
            </span>
            <button
              onClick={onEgoMinus}
              disabled={!egoActive}
              style={{ ...BTN_STYLE, opacity: egoActive ? 1 : 0.35, cursor: egoActive ? 'pointer' : 'default' }}
              title={egoActive ? 'Un grado menos (0 = grafo completo)' : 'Selecciona un nodo primero'}
              onMouseEnter={e => { if (egoActive) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; } }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
            >
              <Minus size={16} />
            </button>
            <div style={{ height: 1, background: 'var(--border)', margin: '2px 4px' }} />
          </>
        )}
        <button
          onClick={onZoomIn}
          style={BTN_STYLE}
          title="Zoom in"
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={onZoomOut}
          style={BTN_STYLE}
          title="Zoom out"
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={onToggleHulls}
          style={{
            ...BTN_STYLE,
            color: showHulls ? 'var(--amber)' : 'var(--text-dim)',
          }}
          title={showHulls ? 'Hide clusters' : 'Show clusters'}
          onMouseEnter={e => { if (!showHulls) e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = showHulls ? 'var(--amber)' : 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
        >
          {showHulls ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <button
          onClick={onZoomReset}
          style={BTN_STYLE}
          title="Reset zoom"
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
        >
          <Maximize size={16} />
        </button>

        <div style={{ height: 1, background: 'var(--border)', margin: '2px 4px' }} />

        <button
          onClick={onToggleFreeze}
          style={{
            ...BTN_STYLE,
            color: frozen ? 'var(--amber)' : 'var(--text-dim)',
          }}
          title={frozen ? 'Resume simulation' : 'Freeze simulation'}
          onMouseEnter={e => { if (!frozen) e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = frozen ? 'var(--amber)' : 'var(--text-dim)'; e.currentTarget.style.background = 'none'; }}
        >
          {frozen ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
    </div>
  );
}
