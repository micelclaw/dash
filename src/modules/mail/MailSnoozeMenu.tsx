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

import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { addDays, getNextWeekday } from '@/lib/date-helpers';

interface MailSnoozeMenuProps {
  open: boolean;
  onClose: () => void;
  onSnooze: (until: string) => void;
  anchorEl?: HTMLElement | null;
}

function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Preset {
  label: string;
  icon: typeof Clock | typeof Calendar;
  getDate: () => Date;
  show: () => boolean;
}

function buildPresets(): Preset[] {
  return [
    {
      label: 'Later today',
      icon: Clock,
      getDate: () => {
        const d = new Date();
        d.setHours(18, 0, 0, 0);
        return d;
      },
      show: () => new Date().getHours() < 17,
    },
    {
      label: 'Tomorrow',
      icon: Calendar,
      getDate: () => {
        const d = addDays(new Date(), 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
      show: () => true,
    },
    {
      label: 'Next Monday',
      icon: Calendar,
      getDate: () => {
        const d = getNextWeekday(new Date(), 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
      show: () => true,
    },
    {
      label: 'Next week',
      icon: Calendar,
      getDate: () => {
        const d = addDays(new Date(), 7);
        d.setHours(9, 0, 0, 0);
        return d;
      },
      show: () => true,
    },
  ];
}

export function MailSnoozeMenu({
  open,
  onClose,
  onSnooze,
  anchorEl,
}: MailSnoozeMenuProps) {
  const [customValue, setCustomValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  /* Close on click outside */
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, handleClose]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  /* Position based on anchor element */
  let positionStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };

  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    positionStyle = {
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      transform: 'none',
    };
  }

  const presets = buildPresets();

  function handlePreset(preset: Preset) {
    const d = preset.getDate();
    onSnooze(d.toISOString());
  }

  function handleCustomSnooze() {
    if (!customValue) return;
    const d = new Date(customValue);
    if (isNaN(d.getTime())) return;
    onSnooze(d.toISOString());
  }

  return (
    <div
      ref={menuRef}
      style={{
        ...positionStyle,
        zIndex: 'var(--z-dropdown)',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        minWidth: 220,
        padding: '6px 0',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '6px 12px 4px',
        }}
      >
        Snooze until
      </div>

      {/* Presets */}
      {presets
        .filter((p) => p.show())
        .map((preset) => {
          const PresetIcon = preset.icon;
          return (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                transition: 'background var(--transition-fast)',
                textAlign: 'left',
              }}
            >
              <PresetIcon size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <span>{preset.label}</span>
            </button>
          );
        })}

      {/* Separator */}
      <div
        style={{
          height: 1,
          background: 'var(--border)',
          margin: '6px 0',
        }}
      />

      {/* Custom section */}
      <div
        style={{
          padding: '4px 12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <label
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Custom
        </label>
        <input
          type="datetime-local"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          min={toLocalISOString(new Date())}
          style={{
            width: '100%',
            padding: '6px 8px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleCustomSnooze}
          disabled={!customValue}
          onMouseEnter={(e) => {
            if (customValue) e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          style={{
            width: '100%',
            padding: '6px 12px',
            background: customValue ? 'var(--amber)' : 'var(--surface)',
            color: customValue ? '#06060a' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: customValue ? 'pointer' : 'default',
            fontSize: '0.8125rem',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            transition: 'opacity var(--transition-fast)',
          }}
        >
          Snooze
        </button>
      </div>
    </div>
  );
}
