import { useState, useRef, useEffect, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  trigger: ReactNode;
  items: ContextMenuItem[];
}

export function ContextMenu({ trigger, items }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const rawPos = useRef({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    rawPos.current = { x: e.clientX, y: e.clientY };
    setPosition({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  // Adjust position if menu overflows viewport edges
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = rawPos.current;
    if (y + rect.height > vh) y = vh - rect.height - 8;
    if (x + rect.width > vw) x = vw - rect.width - 8;
    if (y < 8) y = 8;
    if (x < 8) x = 8;
    setPosition({ x, y });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <>
      <div ref={triggerRef} onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
        {trigger}
      </div>
      {open && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 'var(--z-dropdown)',
            minWidth: 180,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '4px 0',
            animation: 'fadeIn 100ms ease',
          }}
        >
          {items.map((item, i) => {
            if (item.separator) {
              return <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
            }
            const Icon = item.icon;
            const isDanger = item.variant === 'danger';
            return (
              <button
                key={i}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    setOpen(false);
                  }
                }}
                disabled={item.disabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  height: 32,
                  padding: '0 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: item.disabled ? 'default' : 'pointer',
                  color: item.disabled ? 'var(--text-muted)' : isDanger ? 'var(--error)' : 'var(--text)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                  textAlign: 'left',
                  opacity: item.disabled ? 0.5 : 1,
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {Icon && <Icon size={14} />}
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.shortcut && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
