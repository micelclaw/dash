import { useLocation } from 'react-router';
import { Menu, Search } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useSidebarStore } from '@/stores/sidebar.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { MODULES } from '@/config/modules';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth.store';

interface TopBarProps {
  onOpenCommandPalette: () => void;
}

export function TopBar({ onOpenCommandPalette }: TopBarProps) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const user = useAuthStore((s) => s.user);

  const currentModule = MODULES.find((m) => m.path && location.pathname.startsWith(m.path));
  const ModIcon = currentModule?.icon;
  const initials = user?.display_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  return (
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        gap: 12,
      }}
    >
      {/* Left zone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {isMobile && (
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: 4,
              display: 'flex',
            }}
          >
            <Menu size={20} />
          </button>
        )}
        {ModIcon && (
          <ModIcon size={18} style={{ color: currentModule?.color, flexShrink: 0 }} />
        )}
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {currentModule?.label ?? 'Micelclaw'}
        </h2>
      </div>

      {/* Center — search button */}
      <button
        onClick={onOpenCommandPalette}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 32,
          padding: '0 12px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          transition: 'background var(--transition-fast), border-color var(--transition-fast)',
          maxWidth: 320,
          flex: '0 1 320px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--card)';
          e.currentTarget.style.borderColor = 'var(--border-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <Search size={14} />
        <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>
        <kbd
          style={{
            fontSize: '0.6875rem',
            padding: '1px 5px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
          }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Right zone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <NotificationBell />
        {!isMobile && (
          <Avatar className="h-7 w-7">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
