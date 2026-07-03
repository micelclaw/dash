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

// ─── Toolbar de formato de texto (B/I/U + alineación) ───

import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function FormatButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={title}
      className={cn(
        'h-6 w-[26px] p-0 border border-[var(--border,#333)]',
        active
          ? 'bg-[var(--amber,#d4a017)] text-black hover:bg-[var(--amber,#d4a017)] hover:text-black'
          : 'text-[var(--text-dim)]',
      )}
      style={{ borderRadius: 3 }}
    >
      {children}
    </Button>
  );
}

export function TextFormatBar({
  fontWeight,
  fontStyle,
  textDecoration,
  textAlign,
  onChange,
}: {
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: string;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const toggles = [
    { key: 'fontWeight', icon: Bold, active: fontWeight === 'bold', on: 'bold', off: 'normal' },
    { key: 'fontStyle', icon: Italic, active: fontStyle === 'italic', on: 'italic', off: 'normal' },
    { key: 'textDecoration', icon: Underline, active: textDecoration === 'underline', on: 'underline', off: 'none' },
  ] as const;

  const aligns = [
    { value: 'left', icon: AlignLeft },
    { value: 'center', icon: AlignCenter },
    { value: 'right', icon: AlignRight },
  ] as const;

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      <div style={{ display: 'flex', gap: 1, borderRight: '1px solid var(--border, #333)', paddingRight: 4, marginRight: 2 }}>
        {toggles.map(({ key, icon: Icon, active, on, off }) => (
          <FormatButton key={key} active={active} title={key} onClick={() => onChange({ [key]: active ? off : on })}>
            <Icon size={13} />
          </FormatButton>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 1 }}>
        {aligns.map(({ value, icon: Icon }) => (
          <FormatButton
            key={value}
            active={(textAlign || 'center') === value}
            title={`Align ${value}`}
            onClick={() => onChange({ textAlign: value })}
          >
            <Icon size={13} />
          </FormatButton>
        ))}
      </div>
    </div>
  );
}
