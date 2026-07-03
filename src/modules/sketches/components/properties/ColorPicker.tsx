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

// ─── Color Picker (paleta fija + entrada HEX) ───────────
// Los swatches son botones nativos a propósito: cuadrados 18x18 de color puro,
// fuera del lenguaje visual de los Button canónicos.

import { useState } from 'react';
import { COLOR_PALETTE } from '../../types';
import { miniLabelStyle, PanelInput } from './shared';

export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value?: string;
  onChange: (c: string) => void;
  label?: string;
}) {
  const [hexInput, setHexInput] = useState('');
  const [showHex, setShowHex] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={miniLabelStyle}>{label}</span>}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              background: c,
              border: value === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              padding: 0,
              transition: 'transform 0.1s',
            }}
          />
        ))}
        <button
          onClick={() => setShowHex(!showHex)}
          title="Custom HEX"
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            background: showHex ? 'var(--amber, #d4a017)' : 'var(--surface, #1e1e1e)',
            border: '1px solid var(--border, #333)',
            cursor: 'pointer',
            padding: 0,
            fontSize: 10,
            color: showHex ? '#000' : 'var(--text-dim)',
            lineHeight: 1,
          }}
        >
          #
        </button>
      </div>
      {showHex && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>#</span>
          <PanelInput
            type="text"
            value={hexInput || (value?.replace('#', '') ?? '')}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
              setHexInput(v);
              if (v.length === 6 || v.length === 3) onChange(`#${v}`);
            }}
            onBlur={() => setHexInput('')}
            placeholder="3b82f6"
            maxLength={6}
            style={{ width: 70, fontFamily: 'var(--font-mono, monospace)', fontSize: 10 }}
          />
          {value && (
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 3,
                background: value,
                border: '1px solid rgba(255,255,255,0.15)',
                flexShrink: 0,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
