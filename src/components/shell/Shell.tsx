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

import { useEffect, useRef, useState } from 'react';
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
import { useChatStore } from '@/stores/chat.store';
import { useClipboardStore } from '@/stores/clipboard.store';
import { useFloatingPanelsStore } from '@/stores/floating-panels.store';
import { useTheme } from '@/hooks/use-theme';
import { useHeartbeat } from '@/hooks/use-heartbeat';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { CommandPalette } from './CommandPalette';
import { UrgentAlertModal } from '@/components/UrgentAlertModal';
import { FloatingPanelsLayer } from '@/components/floating-panel/FloatingPanelsLayer';
import { MinimizedPanelsTray } from '@/components/floating-panel/MinimizedPanelsTray';
import { ServiceDrainListener } from '@/components/ui/ServiceDrainNotification';
import { useServiceEvents } from '@/hooks/use-service-status';
import { useServicesStore } from '@/stores/services.store';
import { VideoOverlay } from '@/components/player/VideoOverlay';
import { DownloadDialog } from '@/components/player/DownloadDialog';
import { usePlayerStore } from '@/stores/player.store';

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

  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);

  // Apply user theme + accent from settings
  useTheme();

  // Context heartbeat — sends module/idle state to backend every 30s
  useHeartbeat();

  // Service lifecycle WS events
  useServiceEvents();

  // Fetch services on mount
  const fetchServices = useServicesStore((s) => s.fetchServices);
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

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

  // ─── Context heartbeat (every 30s) ──────────────────────
  const send = useWebSocketStore((s) => s.send);
  useEffect(() => {
    let lastActivity = Date.now();
    const onActivity = () => { lastActivity = Date.now(); };
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity > 5 * 60_000; // 5min idle
      const pathParts = location.pathname.split('/').filter(Boolean);
      const currentModule = pathParts[0] || 'dashboard';
      send('context.heartbeat', { module: currentModule, idle });
    }, 30_000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [send, location.pathname]);

  // Keyboard shortcuts
  const toggleClipboard = useClipboardStore((s) => s.togglePanel);
  const togglePanel = useFloatingPanelsStore((s) => s.togglePanel);
  useKeyboard([
    { key: 'b', meta: true, handler: toggle },
    { key: 'v', ctrl: true, shift: true, handler: toggleClipboard },
    { key: 'c', ctrl: true, shift: true, handler: () => togglePanel('calculator') },
    { key: 'u', ctrl: true, shift: true, handler: () => togglePanel('converter') },
    { key: 'p', ctrl: true, shift: true, handler: () => togglePanel('pomodoro') },
  ]);

  // Notification event listeners
  const addNotification = useNotificationStore((s) => s.addNotification);
  const syncEvent = useWebSocket('sync.*');
  const emailEvent = useWebSocket('email.*');
  const agentEvent = useWebSocket('agent.*');
  const digestEvent = useWebSocket('digest.*');
  const systemEvent = useWebSocket('system.*');
  const approvalEvent = useWebSocket('approval.*');
  const clipboardEvent = useWebSocket('clipboard.*');
  const processEvent = useWebSocket('process.*');
  const photoWorkerEvent = useWebSocket('photo.worker.*');
  const changeEvent = useWebSocket('change.*');
  const mediaEvent = useWebSocket('media.download.*');

  useEffect(() => {
    if (!syncEvent) return;
    if (syncEvent.event === 'sync.completed') {
      const created = (syncEvent.data.created as number) ?? 0;
      // Only notify if there are genuinely NEW items — skip updates-only syncs
      if (created > 0) {
        const domainBreakdown = syncEvent.data.domain_breakdown as Record<string, { created?: number }> | undefined;
        const primaryDomain = domainBreakdown
          ? Object.entries(domainBreakdown).find(([, v]) => (v.created ?? 0) > 0)?.[0]
            ?? Object.keys(domainBreakdown)[0]
          : undefined;
        const domainTypeMap: Record<string, 'email' | 'calendar' | 'contacts' | 'sync'> = {
          emails: 'email', events: 'calendar', contacts: 'contacts',
        };
        const notifType = (primaryDomain && domainTypeMap[primaryDomain]) ?? 'sync';

        // Deep link for single-record notifications
        const singleRecord = syncEvent.data.single_record as { domain: string; id: string } | null;
        const domainRouteMap: Record<string, string> = {
          emails: '/mail', events: '/calendar', contacts: '/contacts',
          notes: '/notes', files: '/drive', diary_entries: '/diary',
        };
        const action = singleRecord
          ? { label: 'View', route: `${domainRouteMap[singleRecord.domain] ?? '/'}?id=${singleRecord.id}` }
          : undefined;

        addNotification({
          type: notifType,
          title: (syncEvent.data.title as string) ?? `Sync completed: ${syncEvent.data.provider as string}`,
          action,
        });
      }
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
  const handleDigestEnriched = useDigestStore((s) => s.handleDigestEnriched);
  const setDigestPanelOpen = useDigestStore((s) => s.setPanelOpen);

  useEffect(() => {
    if (!digestEvent) return;
    if (digestEvent.event === 'digest.ready') {
      handleDigestReady(digestEvent.data);

      const alertLevel = digestEvent.data.alert_level as string;
      toast(alertLevel === 'URGENT' ? 'Urgent Briefing' : 'New Briefing', {
        description: digestEvent.data.summary as string,
        duration: alertLevel === 'URGENT' ? 10000 : 5000,
        action: {
          label: 'Open Briefing',
          onClick: () => setDigestPanelOpen(true),
        },
      });
    } else if (digestEvent.event === 'digest.urgent') {
      handleDigestUrgent(digestEvent.data);

      addNotification({
        type: 'digest',
        title: 'Urgent briefing available',
        action: { label: 'Open Briefing', callback: 'openBriefing' },
      });

      toast.warning('Urgent Alert', {
        description: digestEvent.data.summary as string,
        duration: 10000,
      });
    } else if (digestEvent.event === 'digest.enriched') {
      handleDigestEnriched(digestEvent.data);
    }
  }, [digestEvent, addNotification, handleDigestReady, handleDigestUrgent, handleDigestEnriched, setDigestPanelOpen]);

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

    if (approvalEvent.event === 'approval.new') {
      addNotification({
        type: 'approval',
        title: `Approval needed: ${approvalEvent.data.summary as string}`,
        action: { label: 'Review', route: '/approvals' },
      });

      // Inject approval card into active chat conversation
      const chatState = useChatStore.getState();
      const activeConvId = chatState.activeConversationId;
      if (activeConvId) {
        chatState.addMessage({
          id: `approval-${approvalEvent.data.id as string}`,
          conversation_id: activeConvId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          approval: {
            id: approvalEvent.data.id as string,
            operation: approvalEvent.data.operation as string,
            summary: approvalEvent.data.summary as string,
            level: approvalEvent.data.level as number,
            expires_at: approvalEvent.data.expires_at as string,
            status: 'pending',
          },
        });
      }
    } else if (approvalEvent.event === 'approval.resolved') {
      // Update inline approval card status
      useChatStore.getState().updateApprovalStatus(
        approvalEvent.data.id as string,
        approvalEvent.data.status as 'approved' | 'rejected' | 'expired',
      );
    } else if (approvalEvent.event === 'approval.executed') {
      // Auto-execute result: inject as a system message in the active chat
      const chatState = useChatStore.getState();
      const activeConvId = chatState.activeConversationId;
      if (activeConvId) {
        chatState.addMessage({
          id: `approval-exec-${approvalEvent.data.id as string}`,
          conversation_id: activeConvId,
          role: 'assistant',
          content: approvalEvent.data.message as string,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (approvalEvent.event === 'approval.agent_response') {
      // Agent's follow-up response after approval notification
      const chatState = useChatStore.getState();
      const activeConvId = chatState.activeConversationId;
      if (activeConvId && approvalEvent.data.text) {
        chatState.addMessage({
          id: `approval-agent-${Date.now()}`,
          conversation_id: activeConvId,
          role: 'assistant',
          content: approvalEvent.data.text as string,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Refresh pending count on any approval event
    fetchPendingCount();
  }, [approvalEvent, addNotification, fetchPendingCount]);

  // Clipboard events
  const addClipboardEntry = useClipboardStore((s) => s.addEntry);

  useEffect(() => {
    if (!clipboardEvent) return;
    if (clipboardEvent.event === 'clipboard.new') {
      addClipboardEntry(clipboardEvent.data as any);
      toast('New clipboard entry', {
        description: (clipboardEvent.data.content as string)?.slice(0, 60),
        duration: 3000,
      });
    }
  }, [clipboardEvent, addClipboardEntry]);

  // Process events
  useEffect(() => {
    if (!processEvent) return;
    if (processEvent.event === 'process.failure') {
      const name = processEvent.data.name as string;
      toast.error(`Process failed: ${name}`, { duration: 5000 });
      addNotification({
        type: 'system',
        title: `Process failed: ${name}`,
        action: { label: 'View', route: '/processes' },
      });
    }
  }, [processEvent, addNotification]);

  // Photo worker events
  useEffect(() => {
    if (!photoWorkerEvent) return;
    if (photoWorkerEvent.event === 'photo.worker.complete') {
      const count = photoWorkerEvent.data.photos_processed as number;
      toast.success(`Photo processing complete: ${count} photos`);
    } else if (photoWorkerEvent.event === 'photo.worker.error') {
      const error = photoWorkerEvent.data.error as string;
      toast.error(`Photo worker error: ${error}`, { duration: 5000 });
    }
  }, [photoWorkerEvent]);

  // Media download events
  useEffect(() => {
    if (!mediaEvent) return;
    if (mediaEvent.event === 'media.download.complete') {
      toast.success(`Download complete: ${mediaEvent.data.title}`);
      usePlayerStore.getState().fetchDownloads();
    } else if (mediaEvent.event === 'media.download.error') {
      toast.error(`Download failed: ${mediaEvent.data.error}`, { duration: 5000 });
      usePlayerStore.getState().fetchDownloads();
    }
  }, [mediaEvent]);

  // Listen for CommandPalette "Download Media" action
  useEffect(() => {
    const handler = () => setDownloadDialogOpen(true);
    window.addEventListener('claw:open-download-dialog', handler);
    return () => window.removeEventListener('claw:open-download-dialog', handler);
  }, []);

  // Individual change notifications (agent/background sources)
  useEffect(() => {
    if (!changeEvent) return;
    const domain = changeEvent.data.domain as string;
    const summary = changeEvent.data.summary as string;
    const source = changeEvent.data.source as string;

    const DOMAIN_ROUTE: Record<string, string> = {
      notes: '/notes', emails: '/mail', events: '/calendar',
      contacts: '/contacts', diary_entries: '/diary', files: '/drive',
      bookmarks: '/bookmarks',
    };

    const route = DOMAIN_ROUTE[domain];
    const sourceLabel = source === 'agent_primary' ? 'Agent' : 'Background';

    addNotification({
      type: 'change',
      title: `${sourceLabel}: ${summary}`,
      action: route ? { label: 'View', route } : undefined,
    });
  }, [changeEvent, addNotification]);

  return (
    <TooltipProvider>
      <div style={{ position: 'fixed', inset: 0, display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>
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
            <div style={{ flex: 1, overflow: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <Outlet />
            </div>
            {!isChatPage && <BottomBar />}
          </div>
        </div>

        {/* Command Palette */}
        <CommandPalette open={commandPaletteOpen} onClose={closePalette} />

        {/* Urgent Digest Alert Modal */}
        <UrgentAlertModal />

        {/* Floating tool panels */}
        <FloatingPanelsLayer />
        <MinimizedPanelsTray />

        {/* Service lifecycle drain notifications */}
        <ServiceDrainListener />

        {/* Video overlay (media player) */}
        <VideoOverlay />

        {/* Media download dialog */}
        {downloadDialogOpen && <DownloadDialog onClose={() => setDownloadDialogOpen(false)} />}
      </div>
    </TooltipProvider>
  );
}
