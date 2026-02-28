import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSidebarStore } from '@/stores/sidebar.store';
import { MODULES } from '@/config/modules';
import { SidebarItem } from './SidebarItem';
import { SidebarGroup } from './SidebarGroup';
import { ConnectionStatus } from './ConnectionStatus';
import { UserFooter } from './UserFooter';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface SidebarProps {
  onOpenCommandPalette: () => void;
  /** Force expanded mode (used in mobile drawer) */
  forceExpanded?: boolean;
}

export function Sidebar({ onOpenCommandPalette, forceExpanded }: SidebarProps) {
  const storeCollapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const navigate = useNavigate();
  const collapsed = forceExpanded ? false : storeCollapsed;

  const { ungrouped, groups } = useMemo(() => {
    const ungrouped = MODULES.filter((m) => !m.group);
    const grouped = MODULES.filter((m) => m.group);
    const groupNames = [...new Set(grouped.map((m) => m.group!))];
    const groups = groupNames.map((name) => ({
      name,
      modules: grouped.filter((m) => m.group === name),
    }));
    return { ungrouped, groups };
  }, []);

  return (
    <div
      style={{
        width: collapsed ? 56 : 240,
        minWidth: collapsed ? 56 : 240,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        transition: 'width var(--transition-slow), min-width var(--transition-slow)',
        overflow: 'hidden',
      }}
    >
      {/* Logo + toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 48,
          padding: collapsed ? '0 4px' : '0 8px 0 16px',
          justifyContent: collapsed ? 'center' : 'space-between',
          flexShrink: 0,
          gap: 4,
        }}
      >
        <button
          onClick={() => navigate('/chat')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            padding: 0,
            minWidth: 0,
          }}
        >
          <img src="/favicon.png" width={20} height={20} alt="" style={{ flexShrink: 0 }} />
          {!collapsed && (
            <span style={{ fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
              Micelclaw
            </span>
          )}
        </button>

        {/* Sidebar toggle button */}
        {!forceExpanded && (
          collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 4,
                    display: 'flex',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <PanelLeftOpen size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar (⌘B)</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={toggle}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 4,
                display: 'flex',
                borderRadius: 'var(--radius-sm)',
                transition: 'color var(--transition-fast)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              title="Collapse sidebar (⌘B)"
            >
              <PanelLeftClose size={16} />
            </button>
          )
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div style={{ padding: collapsed ? '0 4px' : '0 8px' }}>
          {/* Ungrouped items (Chat, Search) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {ungrouped.map((mod) => (
              <SidebarItem
                key={mod.id}
                module={mod}
                collapsed={collapsed}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </div>

          {/* Grouped items */}
          {groups.map((group) => (
            <SidebarGroup key={group.name} label={group.name} collapsed={collapsed}>
              {group.modules.map((mod) => (
                <SidebarItem
                  key={mod.id}
                  module={mod}
                  collapsed={collapsed}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </SidebarGroup>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div
        style={{
          flexShrink: 0,
          padding: collapsed ? '8px 4px' : '8px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <ConnectionStatus collapsed={collapsed} />
        <UserFooter collapsed={collapsed} />
      </div>
    </div>
  );
}
