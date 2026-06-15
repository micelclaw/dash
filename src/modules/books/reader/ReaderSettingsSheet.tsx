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

/**
 * Right sheet with display preferences for the reader. Every change is
 * applied live (ReaderView re-injects styles into the book iframes) and
 * persisted to localStorage ('claw-reader-prefs').
 */

import { RotateCcw } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import {
  DEFAULT_PREFS,
  READER_THEMES,
  type ReaderFontFamily,
  type ReaderPrefs,
  type ReaderTheme,
} from './reader-prefs';

export interface ReaderSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: ReaderPrefs;
  onChange: (next: ReaderPrefs) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: 'var(--text-dim)' }}
    >
      {children}
    </p>
  );
}

export function ReaderSettingsSheet({
  open,
  onOpenChange,
  prefs,
  onChange,
}: ReaderSettingsSheetProps) {
  const set = (patch: Partial<ReaderPrefs>) => onChange({ ...prefs, ...patch });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" style={{ width: 300 }} aria-describedby={undefined}>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <h2 className="pr-8 text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Reader settings
          </h2>

          {/* Theme */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Theme</SectionLabel>
            <div className="flex gap-2">
              {(Object.keys(READER_THEMES) as ReaderTheme[]).map((theme) => {
                const t = READER_THEMES[theme];
                const active = prefs.theme === theme;
                return (
                  <button
                    key={theme}
                    onClick={() => set({ theme })}
                    className="flex flex-1 flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors"
                    style={{
                      background: t.bg,
                      color: t.fg,
                      borderColor: active ? 'var(--accent, #3b82f6)' : 'var(--border)',
                      borderWidth: active ? 2 : 1,
                    }}
                  >
                    <span className="font-serif text-base leading-none">Aa</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font family */}
          <div className="flex flex-col gap-2">
            <SectionLabel>Font</SectionLabel>
            <div className="flex gap-2">
              {(
                [
                  { id: 'serif', label: 'Serif', className: 'font-serif' },
                  { id: 'sans', label: 'Sans', className: 'font-sans' },
                ] as Array<{ id: ReaderFontFamily; label: string; className: string }>
              ).map((f) => {
                const active = prefs.fontFamily === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => set({ fontFamily: f.id })}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm ${f.className}`}
                    style={{
                      color: 'var(--text)',
                      background: active ? 'var(--surface-hover, rgba(127,127,127,0.12))' : 'transparent',
                      borderColor: active ? 'var(--accent, #3b82f6)' : 'var(--border)',
                      borderWidth: active ? 2 : 1,
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font size */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Font size</SectionLabel>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text)' }}>
                {prefs.fontSize}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>A</span>
              <Slider
                min={80}
                max={160}
                step={5}
                value={[prefs.fontSize]}
                onValueChange={([v]) => v !== undefined && set({ fontSize: v })}
              />
              <span className="text-base" style={{ color: 'var(--text-dim)' }}>A</span>
            </div>
          </div>

          {/* Line height */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Line spacing</SectionLabel>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text)' }}>
                {prefs.lineHeight.toFixed(2)}
              </span>
            </div>
            <Slider
              min={1.2}
              max={2.2}
              step={0.05}
              value={[prefs.lineHeight]}
              onValueChange={([v]) => v !== undefined && set({ lineHeight: v })}
            />
          </div>

          <button
            onClick={() => onChange({ ...DEFAULT_PREFS })}
            className="mt-auto flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs"
            style={{ color: 'var(--text-dim)', borderColor: 'var(--border)' }}
          >
            <RotateCcw size={13} />
            Reset to defaults
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
