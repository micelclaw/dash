import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useSidebarStore } from '@/stores/sidebar.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useAuthStore } from '@/stores/auth.store';
import { useIsMobile, useIsCompact } from '@/hooks/use-media-query';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { useWebSocket } from '@/hooks/use-websocket';
import { useNotificationStore } from '@/stores/notification.store';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { CommandPalette } from './CommandPalette';

export function Shell() {
  const { open: commandPaletteOpen, openPalette, closePalette } = useCommandPalette();
  const toggle = useSidebarStore((s) => s.toggle);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const isMobile = useIsMobile();
  const isCompact = useIsCompact();
  const location = useLocation();
  const connect = useWebSocketStore((s) => s.connect);
  const disconnect = useWebSocketStore((s) => s.disconnect);
  const tokens = useAuthStore((s) => s.tokens);
  const isChatPage = location.pathname === '/chat';

  // Auto-collapse on compact screens, auto-expand when viewport goes wide
  const prevCompactRef = useRef(isCompact);
  useEffect(() => {
    if (isMobile) return;
    const wasCompact = prevCompactRef.current;
    prevCompactRef.current = isCompact;

    if (isCompact && !wasCompact) {
      // Just entered compact → auto-collapse once
      setCollapsed(true);
    } else if (!isCompact && wasCompact) {
      // Left compact → restore user preference
      const { userCollapsed } = useSidebarStore.getState();
      setCollapsed(userCollapsed);
    }
  }, [isCompact, isMobile, setCollapsed]);

  // Connect WebSocket on mount
  useEffect(() => {
    if (tokens?.accessToken) {
      connect(tokens.accessToken);
    }
    return () => disconnect();
  }, [tokens?.accessToken, connect, disconnect]);

  // Keyboard shortcut: Cmd+B toggle sidebar (Cmd+K handled by useCommandPalette)
  useKeyboard([
    { key: 'b', meta: true, handler: toggle },
  ]);

  // Notification event listeners
  const addNotification = useNotificationStore((s) => s.addNotification);
  const syncEvent = useWebSocket('sync.*');
  const emailEvent = useWebSocket('email.*');
  const agentEvent = useWebSocket('agent.*');
  const digestEvent = useWebSocket('digest.*');
  const systemEvent = useWebSocket('system.*');
  const approvalEvent = useWebSocket('approval.*');

  useEffect(() => {
    if (!syncEvent) return;
    if (syncEvent.event === 'sync.completed') {
      addNotification({
        type: 'sync',
        title: `Sync completed: ${syncEvent.data.provider as string}`,
      });
    } else if (syncEvent.event === 'sync.error') {
      addNotification({
        type: 'system',
        title: `Sync failed: ${syncEvent.data.provider as string}`,
        action: { label: 'Settings', route: '/settings?section=sync' },
      });
    }
  }, [syncEvent, addNotification]);

  useEffect(() => {
    if (!emailEvent) return;
    const count = (emailEvent.data.count as number) ?? 1;
    const from = emailEvent.data.from as string;
    addNotification({
      type: 'email',
      title: `${count} new email${count > 1 ? 's' : ''} from ${from}`,
      action: { label: 'Open', route: '/mail' },
    });
  }, [emailEvent, addNotification]);

  useEffect(() => {
    if (!agentEvent) return;
    const agent = agentEvent.data.agent as string;
    const summary = agentEvent.data.summary as string;
    const route = agentEvent.data.route as string | undefined;
    addNotification({
      type: 'agent_action',
      title: `${agent}: ${summary}`,
      action: route ? { label: 'View', route } : undefined,
    });
  }, [agentEvent, addNotification]);

  useEffect(() => {
    if (!digestEvent) return;
    if (digestEvent.event === 'digest.ready') {
      addNotification({
        type: 'digest',
        title: digestEvent.data.summary as string,
        action: { label: 'Open', route: '/chat' },
      });
    } else if (digestEvent.event === 'digest.urgent') {
      addNotification({
        type: 'digest',
        title: digestEvent.data.summary as string,
        action: digestEvent.data.route ? { label: 'View', route: digestEvent.data.route as string } : undefined,
      });
    }
  }, [digestEvent, addNotification]);

  useEffect(() => {
    if (!systemEvent) return;
    addNotification({
      type: 'system',
      title: systemEvent.data.message as string,
    });
  }, [systemEvent, addNotification]);

  useEffect(() => {
    if (!approvalEvent) return;
    addNotification({
      type: 'approval',
      title: `Approval needed: ${approvalEvent.data.summary as string}`,
      action: { label: 'Review', route: approvalEvent.data.route as string | undefined },
    });
  }, [approvalEvent, addNotification]);

  return (
    <TooltipProvider>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
        {/* Desktop sidebar */}
        {!isMobile && (
          <Sidebar onOpenCommandPalette={openPalette} />
        )}

        {/* Mobile sidebar drawer */}
        {isMobile && (
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" style={{ padding: 0, width: 280 }}>
              <Sidebar onOpenCommandPalette={openPalette} forceExpanded />
            </SheetContent>
          </Sheet>
        )}

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <TopBar onOpenCommandPalette={openPalette} />

          {/* Content + BottomBar */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Outlet />
            </div>
            {!isChatPage && <BottomBar />}
          </div>
        </div>

        {/* Command Palette */}
        <CommandPalette open={commandPaletteOpen} onClose={closePalette} />
      </div>
    </TooltipProvider>
  );
}
