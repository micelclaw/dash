/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

// Hoja "Más" del shell móvil: grid de TODOS los módulos visibles (agrupado),
// sustituye al panel lateral en móvil. Fuente: useVisibleModules (mismo gating
// que el Sidebar).
import { useNavigate } from 'react-router';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useVisibleModules } from '@/hooks/use-visible-modules';
import type { ModuleConfig } from '@/types/modules';

export function MobileMoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { ungrouped, groups } = useVisibleModules();

  const go = (path: string | null) => { if (!path) return; onOpenChange(false); navigate(path); };

  const Grid = ({ modules }: { modules: ModuleConfig[] }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
      {modules.map((m) => {
        const Icon = m.icon;
        return (
          <button key={m.id} onClick={() => go(m.path)} data-testid={`more-mod-${m.id}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text)', cursor: 'pointer', minWidth: 0,
            }}>
            <Icon size={22} style={{ color: m.color }} />
            <span style={{ fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" style={{ maxHeight: '86dvh', overflowY: 'auto', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }} data-testid="more-sheet">
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Más</div>
        <div style={{ marginTop: 12 }}>
          {ungrouped.length > 0 && <Grid modules={ungrouped} />}
          {groups.map((g) => (
            <div key={g.name}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '2px 0 8px' }}>{g.name}</div>
              <Grid modules={g.modules} />
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
