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

// ─── Primitivas compartidas del panel de propiedades ────
// Estética canvas propia del módulo sketches (fuentes mini + var(--*) inline).
// Botones e inputs se apoyan en los canónicos de ui (Button/Input) con
// className/style para conservar el look original del panel.

import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Estilos base ───────────────────────────────────────

export const miniLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--text-dim, #94a3b8)',
  fontFamily: 'var(--font-sans, system-ui)',
};

export const inputStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '4px 8px',
  background: 'var(--background, #111)',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  color: 'var(--text, #e2e8f0)',
  fontFamily: 'var(--font-sans, system-ui)',
  outline: 'none',
  width: '100%',
};

export const readOnlyValue: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-mono, monospace)',
  color: 'var(--text, #e2e8f0)',
  background: 'var(--background, #111)',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  padding: '4px 8px',
  display: 'block',
};

export const statBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  padding: '6px 4px',
  background: 'var(--background, #111)',
  border: '1px solid var(--border, #333)',
  borderRadius: 6,
};

// ─── Input canónico con la estética del panel ───────────

export function PanelInput({ className, style, ...props }: React.ComponentProps<typeof Input>) {
  // h-auto anula el h-8 del canónico; el resto del look viene de inputStyle.
  return <Input className={cn('h-auto', className)} style={{ ...inputStyle, ...style }} {...props} />;
}

// ─── Botones canónicos con variantes del panel ──────────

export function AddButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-auto px-2 py-[3px] text-[10px] font-normal text-[var(--text-dim,#94a3b8)] border border-[var(--border,#333)]',
        className,
      )}
      style={{ borderRadius: 4 }}
      {...props}
    />
  );
}

export function RemoveButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-[18px] w-[18px] shrink-0 p-0 text-sm leading-none text-[#ef4444] hover:text-[#ef4444]', className)}
      style={{ borderRadius: 4 }}
      {...props}
    >
      {children ?? '×'}
    </Button>
  );
}

export function DangerButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      variant="destructive"
      size="sm"
      className={cn(
        'h-auto mt-2 px-2.5 py-[5px] text-[11px] font-normal shadow-none bg-transparent text-[#ef4444] border border-[#ef4444] hover:bg-[#ef4444]/10 hover:text-[#ef4444]',
        className,
      )}
      style={{ borderRadius: 4 }}
      {...props}
    />
  );
}

// ─── Layout compartido ──────────────────────────────────

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-dim, #94a3b8)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontFamily: 'var(--font-sans, system-ui)',
        paddingBottom: 4,
        borderBottom: '1px solid var(--border, #333)',
      }}
    >
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={miniLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

export function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--border, #333)', paddingBottom: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          color: 'var(--text-dim, #94a3b8)',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-sans, system-ui)',
        }}
      >
        {title}
        <span style={{ fontSize: 8, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
          ▶
        </span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>{children}</div>}
    </div>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        fontSize: 11,
        color: 'var(--text, #e2e8f0)',
        fontFamily: 'var(--font-sans, system-ui)',
      }}
    >
      {label}
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 32,
          height: 18,
          borderRadius: 9,
          border: 'none',
          background: value ? 'var(--amber, #d4a017)' : 'var(--border, #333)',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.15s',
          padding: 0,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: 2,
            left: value ? 16 : 2,
            transition: 'left 0.15s',
          }}
        />
      </button>
    </label>
  );
}
