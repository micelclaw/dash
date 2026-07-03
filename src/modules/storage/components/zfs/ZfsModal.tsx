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

// ─── Chrome compartido de los modales ZFS ──────────────────────────
// Wrapper sobre el Dialog canónico de ui (Radix) conservando la estética
// inline del módulo Storage (var(--*)), más Button/Input canónicos adaptados
// (ZfsButton/ZfsInput) y helpers repetidos entre modales: Field con InfoTip,
// aviso ámbar (WarnBox), lista de discos seleccionables (DiskPickList),
// discos libres (useAvailableDisks) y formato de capacidad (fmtTB).

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useStorageStore } from '@/stores/storage.store';
import { DEMO_AVAILABLE_DISKS } from '../../zfs-demo';
import { InfoTip } from '../ZfsHelp';

export function ZfsModal(props: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) props.onClose(); }}>
      <DialogContent
        className="w-[calc(100vw-32px)] max-w-[620px] p-0"
        style={{ maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius)' }}
      >
        <DialogHeader
          className="flex-row items-center gap-2 space-y-0 text-left"
          style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}
        >
          {props.icon}
          <DialogTitle className="flex-1 text-[0.9375rem] font-bold" style={{ color: 'var(--text)' }}>
            {props.title}
          </DialogTitle>
        </DialogHeader>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>{props.children}</div>
        <DialogFooter
          className="flex-row justify-end gap-2 sm:space-x-0"
          style={{ padding: '14px 18px', borderTop: '1px solid var(--border)' }}
        >
          {props.footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Botón canónico con las variantes del módulo ───────────────────
// primary → color del módulo (--mod-storage); danger → destructive canónico.
// gap-0 conserva el espaciado por márgenes explícitos del markup original.

interface ZfsButtonProps extends ButtonProps {
  primary?: boolean;
  danger?: boolean;
}

export function ZfsButton({ primary, danger, className, style, ...props }: ZfsButtonProps) {
  return (
    <Button
      variant={danger ? 'destructive' : primary ? 'default' : 'outline'}
      className={cn(
        'h-auto px-4 py-[9px] text-sm gap-0 shadow-none',
        primary && 'bg-[var(--mod-storage,var(--accent))] text-white hover:bg-[var(--mod-storage,var(--accent))]/90 font-semibold',
        danger && 'font-semibold',
        !primary && !danger && 'font-normal text-[var(--text)]',
        className,
      )}
      style={{ borderRadius: 'var(--radius-sm)', ...style }}
      {...props}
    />
  );
}

// ─── Input canónico con la estética del módulo ─────────────────────

export function ZfsInput({ className, style, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn('h-auto', className)}
      style={{
        padding: '9px 12px',
        background: 'var(--bg, var(--surface))',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        ...style,
      }}
      {...props}
    />
  );
}

// Mismo look para los <select> nativos (sin canónico equivalente ligero).
export const selectStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: 'var(--bg, var(--surface))', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)',
};

// ─── Field: etiqueta con InfoTip opcional ──────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '0.8125rem', color: 'var(--text-dim)', marginBottom: 6,
  display: 'inline-flex', alignItems: 'center', gap: 5,
};

export function Field({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label style={labelStyle}>
      {children}
      {hint && <InfoTip text={hint} />}
    </label>
  );
}

// ─── Aviso ámbar (operaciones con riesgo) ──────────────────────────

export function WarnBox({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: 12, background: 'var(--warning-bg, #f59e0b18)', border: '1px solid var(--warning,#f59e0b)55',
        borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.8125rem', lineHeight: 1.5,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Discos libres + lista seleccionable ───────────────────────────

const TB = 1024 ** 4;
export function fmtTB(n: number): string { return `${(n / TB).toFixed(n >= TB ? 1 : 2)} TB`; }

export interface AvailDisk { by_id: string; size_bytes: number; model: string }

export function useAvailableDisks(): AvailDisk[] {
  const demo = useStorageStore((s) => s.zfs_demo);
  const disksStore = useStorageStore((s) => s.disks);
  return demo
    ? DEMO_AVAILABLE_DISKS
    : disksStore.filter((d) => !d.pool).map((d) => ({ by_id: d.serial ? `/dev/disk/by-id/${d.serial}` : d.device, size_bytes: d.size_bytes, model: d.model }));
}

export function DiskPickList({
  disks,
  picked,
  onToggle,
  emptyText = 'No hay discos libres disponibles.',
}: {
  disks: AvailDisk[];
  picked: string[];
  onToggle: (id: string) => void;
  emptyText?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {disks.length === 0 && <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>{emptyText}</div>}
      {disks.map((d) => {
        const sel = picked.includes(d.by_id);
        return (
          <label key={d.by_id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 10,
            border: `1px solid ${sel ? 'var(--mod-storage, var(--accent))' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          }}>
            <input type="checkbox" checked={sel} onChange={() => onToggle(d.by_id)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{d.model}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>{d.by_id}</div>
            </div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>{fmtTB(d.size_bytes)}</span>
          </label>
        );
      })}
    </div>
  );
}
