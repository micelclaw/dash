import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { toast } from 'sonner';
import { useSidebarStore } from '@/stores/sidebar.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useAuthStore } from '@/stores/auth.store';
import { useDigestStore } from '@/stores/digest.store';
import { useIsMobile, useIsCompact } from '@/hooks/use-media-query';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { useWebSocket } from '@/hooks/use-websocket';
import { useNotificationStore } from '@/stores/notification.store';
import { useSecurityStore } from '@/stores/security.store';
import { useTheme } from '@/hooks/use-theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { CommandPalette } from './CommandPalette';
import { UrgentAlertModal } from '@/components/UrgentAlertModal';

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
  const wsStatus = useWebSocketStore((s) => s.status);
  const tokens = useAuthStore((s) => s.tokens);
  const refresh = useAuthStore((s) => s.refresh);
  const logout = useAuthStore((s) => s.logout);
  const isChatPage = location.pathname === '/chat';

  // Apply user theme + accent from settings
  useTheme();

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

  // Connect WebSocket on mount — proactively refresh token first
  useEffect(() => {
    if (!tokens?.accessToken) return;
    let cancelled = false;

    refresh()
      .catch(() => { /* ignore — will try with existing token */ })
      .finally(() => {
        if (cancelled) return;
        const current = useAuthStore.getState().tokens;
        if (current?.accessToken) connect(current.accessToken);
      });

    return () => { cancelled = true; disconnect(); };
  }, [tokens?.accessToken, connect, disconnect, refresh]);

  // Auto-reconnect on auth failure: refresh JWT and retry WS
  useEffect(() => {
    if (wsStatus !== 'auth_failed') return;

    refresh()
      .then(() => {
        const fresh = useAuthStore.getState().tokens;
        if (fresh?.accessToken) connect(fresh.accessToken);
      })
      .catch(() => {
        logout();
      });
  }, [wsStatus, refresh, connect, logout]);

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

  const handleDigestReady = useDigestStore((s) => s.handleDigestReady);
  const handleDigestUrgent = useDigestStore((s) => s.handleDigestUrgent);

  useEffect(() => {
    if (!digestEvent) return;
    if (digestEvent.event === 'digest.ready') {
      handleDigestReady(digestEvent.data);
      addNotification({
        type: 'digest',
        title: digestEvent.data.summary as string,
        action: { label: 'Open', route: '/chat' },
      });

      const alertLevel = digestEvent.data.alert_level as string;
      if (alertLevel === 'NORMAL' || alertLevel === 'URGENT') {
        toast(alertLevel === 'URGENT' ? 'Urgent Alert' : 'Digest', {
          description: digestEvent.data.summary as string,
          duration: alertLevel === 'URGENT' ? 10000 : 5000,
        });
      }
    } else if (digestEvent.event === 'digest.urgent') {
      handleDigestUrgent(digestEvent.data);
      addNotification({
        type: 'digest',
        title: digestEvent.data.summary as string,
        action: digestEvent.data.route ? { label: 'View', route: digestEvent.data.route as string } : undefined,
      });
      toast.warning('Urgent Alert', {
        description: digestEvent.data.summary as string,
        duration: 10000,
      });
    }
  }, [digestEvent, addNotification, handleDigestReady, handleDigestUrgent]);

  useEffect(() => {
    if (!systemEvent) return;
    addNotification({
      type: 'system',
      title: systemEvent.data.message as string,
    });
  }, [systemEvent, addNotification]);

  const fetchPendingCount = useSecurityStore((s) => s.fetchPendingCount);

  // Fetch approval pending count on mount
  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  useEffect(() => {
    if (!approvalEvent) return;
    addNotification({
      type: 'approval',
      title: `Approval needed: ${approvalEvent.data.summary as string}`,
      action: { label: 'Review', route: '/approvals' },
    });
    // Refresh pending count on any approval event
    fetchPendingCount();
  }, [approvalEvent, addNotification, fetchPendingCount]);

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

        {/* Urgent Digest Alert Modal */}
        <UrgentAlertModal />
      </div>
    </TooltipProvider>
  );
}
