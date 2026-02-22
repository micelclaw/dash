import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useSidebarStore } from '@/stores/sidebar.store';
import { MODULES } from '@/config/modules';
import { SidebarItem } from './SidebarItem';
import { SidebarGroup } from './SidebarGroup';
import { ConnectionStatus } from './ConnectionStatus';
import { UserFooter } from './UserFooter';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidebarProps {
  onOpenCommandPalette: () => void;
}

export function Sidebar({ onOpenCommandPalette }: SidebarProps) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const navigate = useNavigate();

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
      {/* Logo */}
      <button
        onClick={() => navigate('/chat')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 48,
          padding: collapsed ? '0' : '0 16px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span style={{ fontSize: 20 }}>🐾</span>
        {!collapsed && (
          <span style={{ fontSize: '1rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Micelclaw
          </span>
        )}
      </button>

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
                onAction={mod.id === 'search' ? onOpenCommandPalette : undefined}
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
