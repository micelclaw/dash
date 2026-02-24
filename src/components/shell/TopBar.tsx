import { useLocation } from 'react-router';
import { Menu, Search, Newspaper } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { BriefingPanel } from '@/components/BriefingPanel';
import { useSidebarStore } from '@/stores/sidebar.store';
import { useDigestStore } from '@/stores/digest.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { MODULES } from '@/config/modules';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth.store';

function BriefingButton() {
  const unreadCount = useDigestStore((s) => s.unreadCount);
  const panelOpen = useDigestStore((s) => s.panelOpen);
  const setPanelOpen = useDigestStore((s) => s.setPanelOpen);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        style={{
          position: 'relative',
          background: 'none', border: 'none',
          cursor: 'pointer', color: panelOpen ? 'var(--amber)' : 'var(--text-dim)',
          padding: 4, display: 'flex',
        }}
      >
        <Newspaper size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -4,
            minWidth: 14, height: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--amber)', color: '#06060a',
            borderRadius: 7, fontSize: '0.5625rem',
            fontWeight: 700, fontFamily: 'var(--font-sans)',
            padding: '0 3px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <BriefingPanel />
    </div>
  );
}

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
        <BriefingButton />
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
