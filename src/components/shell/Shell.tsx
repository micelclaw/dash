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
import { api } from '@/services/api';
import { useSidebarStore } from '@/stores/sidebar.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useAuthStore } from '@/stores/auth.store';
import { useDigestStore } from '@/stores/digest.store';
import { useIsMobile, useIsCompact } from '@/hooks/use-media-query';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { useWebSocket } from '@/hooks/use-websocket';
import { useNotificationStore } from '@/stores/notification.store';
import type { Notification } from '@/types/notifications';
import { useSecurityStore } from '@/stores/security.store';
import { useSettingsStore } from '@/stores/settings.store';
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
import { useGatewayStore } from '@/stores/gateway.store';
import { useExtractionStore } from '@/stores/extraction.store';
import { useOpenclawSchemaStore } from '@/stores/openclaw-schema.store';
import { OnboardingBanner } from '@/components/onboarding/OnboardingBanner';
import { useStudioGenerationStreamsSubscription } from '@/modules/studio/streams/studio-generation-streams';

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

  // Gateway onboarding status
  const gatewayConfigured = useGatewayStore((s) => s.configured);
  const fetchSnapshot = useGatewayStore((s) => s.fetchSnapshot);
  const fetchHealth = useGatewayStore((s) => s.fetchHealth);
  const [onboardingJustCompleted, setOnboardingJustCompleted] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const prevConfiguredRef = useRef<boolean | null>(null);

  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const loadConfigSchema = useOpenclawSchemaStore((s) => s.loadConfigSchema);

  useEffect(() => {
    fetchSnapshot();
    fetchSettings();
    // Ola 7: load OpenClaw config schema once at boot. Used by the Raw JSON
    // editor (/settings/raw) for client-side validation. Failures are silent.
    loadConfigSchema();
    // Poll Gateway health every 30s so the composite ConnectionStatus
    // and the chat input dot reflect the real Core↔Gateway state, not
    // just dash↔Core. /gateway/health is cheap (<50ms). fetchHealth
    // silently swallows errors (last-known value retained).
    const healthPoll = setInterval(() => { void fetchHealth(); }, 30_000);
    return () => clearInterval(healthPoll);
  }, [fetchSnapshot, fetchSettings, loadConfigSchema, fetchHealth]);

  // Poll every 10s while unconfigured to detect onboarding completion
  useEffect(() => {
    if (gatewayConfigured !== false) return;
    const interval = setInterval(() => fetchSnapshot(), 10_000);
    return () => clearInterval(interval);
  }, [gatewayConfigured, fetchSnapshot]);

  // Detect transition: configured false → true → trigger provisioning
  useEffect(() => {
    const prev = prevConfiguredRef.current;
    prevConfiguredRef.current = gatewayConfigured;

    if (prev === false && gatewayConfigured === true) {
      // Onboarding just completed — provision agents
      import('@/services/gateway.service').then(({ provisionAgents, syncUserProfile }) => {
        provisionAgents()
          .then((result) => {
            console.log('[onboarding] provisioned agents:', result);
            // Sync USER.md (pre-filled from DB) to all agent workspaces
            return syncUserProfile().then((sync) => {
              console.log('[onboarding] synced user profile:', sync);
            }).catch(() => { /* best-effort */ });
          })
          .then(() => setOnboardingJustCompleted(true))
          .catch((err) => {
            console.error('[onboarding] provision failed:', err);
            setOnboardingJustCompleted(true); // Still show green banner
          });
      });
    }
  }, [gatewayConfigured]);

  // Apply user theme + accent from settings
  useTheme();

  // Context heartbeat — sends module/idle state to backend every 30s
  useHeartbeat();

  // Service lifecycle WS events
  useServiceEvents();

  // Studio doc-phase generation streams — single global subscription
  // so navigating between phases doesn't drop tokens / done events.
  useStudioGenerationStreamsSubscription();

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

  // Start extraction WS listeners once (persists across navigation)
  useEffect(() => {
    useExtractionStore.getState().startListening();
  }, []);

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
  const sensorEvent = useWebSocket('sensor.*');
  const workflowEvent = useWebSocket('workflow.*');
  const notificationEvent = useWebSocket('notification.new');
  const postYieldEvent = useWebSocket('chat.post_yield_message');

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
        const domainTypeMap: Record<string, Notification['type']> = {
          emails: 'email', events: 'calendar', contacts: 'contacts',
          messages: 'messages',
        };
        const notifType: Notification['type'] = (primaryDomain && domainTypeMap[primaryDomain]) || 'sync';

        // Deep link for single-record notifications
        const singleRecord = syncEvent.data.single_record as { domain: string; id: string } | null;
        const domainRouteMap: Record<string, string> = {
          emails: '/mail', events: '/calendar', contacts: '/contacts',
          notes: '/notes', files: '/drive', diary_entries: '/diary',
          messages: '/messages',
        };
        let action: { label: string; route: string } | undefined;
        if (singleRecord) {
          if (singleRecord.domain === 'messages') {
            const provider = (syncEvent.data.provider as string) ?? '';
            action = { label: 'View', route: `/messages?platform=${provider.toLowerCase()}` };
          } else {
            action = { label: 'View', route: `${domainRouteMap[singleRecord.domain] ?? '/'}?id=${singleRecord.id}` };
          }
        } else if (primaryDomain && domainRouteMap[primaryDomain]) {
          action = { label: 'View', route: domainRouteMap[primaryDomain]! };
        }

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

    // agent.model_changed is handled inside use-agent-detail.ts (it
    // refetches the open detail in this tab). No user-facing
    // notification — the user is the one who triggered it.
    if (agentEvent.event === 'agent.model_changed') return;

    // agent.stuck_yield → parent agent waiting on aborted sub-agents.
    // Persistent toast with a "Resume" action that calls the recovery
    // endpoint to inject a synthetic wake-up message. The dash chat
    // doesn't auto-open; we just notify the user.
    if (agentEvent.event === 'agent.stuck_yield') {
      const agentId = agentEvent.data.agent_id as string;
      const agentName = agentEvent.data.agent_name as string;
      const sessionKey = agentEvent.data.session_key as string;
      const aborted = (agentEvent.data.aborted_children as Array<{ agent_name: string }>) ?? [];
      const names = aborted.map(a => a.agent_name).filter(Boolean).join(', ') || 'sus sub-agentes';
      toast.warning(`${agentName} esperando sub-agentes cancelados`, {
        description: `${names} se cancelaron sin completar. Pulsa Reanudar para que ${agentName} retome.`,
        duration: Infinity,
        id: `stuck-yield-${sessionKey}`,
        action: {
          label: 'Reanudar',
          onClick: async () => {
            try {
              const res = await api.post<{ resumed: boolean; already_resolved?: boolean }>(
                `/managed-agents/${agentId}/stuck-yield/resume`,
                { session_key: sessionKey },
              );
              if (res?.already_resolved) {
                toast.info(`${agentName} ya había retomado por su cuenta.`);
              } else {
                toast.success(`${agentName} reanudado.`);
              }
            } catch (err) {
              toast.error(`No se pudo reanudar ${agentName}: ${err instanceof Error ? err.message : 'error'}`);
            }
          },
        },
      });
      return;
    }

    // agent.stuck_yield_resolved → another tab/client cleared it; dismiss.
    if (agentEvent.event === 'agent.stuck_yield_resolved') {
      const sessionKey = agentEvent.data.session_key as string;
      toast.dismiss(`stuck-yield-${sessionKey}`);
      return;
    }

    // agent.message → user-facing notification
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

  // Post-yield messages: when a parent agent (Francis) replies to a
  // sub-agent's announce-back, that reply is generated INSIDE OpenClaw
  // after chat-bridge already returned. Core's subagent-conversation
  // mirror picks it up and broadcasts this event so the open chat tab
  // can append the reply without waiting for a manual refresh.
  useEffect(() => {
    if (!postYieldEvent) return;
    const data = postYieldEvent.data as {
      id: string;
      conversation_id: string | null;
      session_id: string;
      from_agent: string;
      text: string;
      tool_calls?: Array<Record<string, unknown>> | null;
      created_at: string;
    };
    if (!data.id || !data.conversation_id) return;
    const store = useChatStore.getState();
    // Hydrate the tool_calls from the WS payload so the chat bubble shows
    // the tool pills immediately (sessions_spawn / sessions_yield etc.).
    // Without this, the bubble appears bare until a manual refresh because
    // the local store skips the next history fetch (see loadMessages dedup).
    const toolCalls = Array.isArray(data.tool_calls) && data.tool_calls.length > 0
      ? data.tool_calls.map((t) => ({
          id: String(t.id ?? crypto.randomUUID()),
          tool: String(t.tool ?? t.name ?? 'unknown'),
          status: t.status as import('@/types/chat').ToolCallRecord['status'],
          summary: typeof t.summary === 'string' ? t.summary : undefined,
          input: (() => {
            const raw = t.input ?? t.arguments;
            if (typeof raw === 'string') return raw;
            if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
            return undefined;
          })(),
          output: typeof t.output === 'string' ? t.output : undefined,
        }))
      : undefined;
    store.addMessage({
      id: data.id,
      conversation_id: data.conversation_id,
      role: 'assistant',
      content: data.text,
      agent: data.from_agent,
      timestamp: data.created_at,
      tool_calls: toolCalls,
    });
    // Clear the "Esperando…" placeholder if it was for this conversation.
    if (store.streamingMessage?.conversationId === data.conversation_id) {
      store.setStreamingMessage(null);
    }
  }, [postYieldEvent]);

  // Sub-agent messages (from the parent's delegation): the mirror
  // emits these as new sub-agent thread rows are persisted. The dash
  // sidebar should reflect new threads in real time so the user sees
  // the Francis↔Atlas / Francis↔Sentinel conversation pop up while
  // they're delegating.
  const subagentMsgEvent = useWebSocket('chat.subagent_message');
  useEffect(() => {
    if (!subagentMsgEvent) return;
    const data = subagentMsgEvent.data as {
      id: string;
      conversation_id: string | null;
      session_id: string;
      from_agent: string;
      to_agent: string;
      role: 'user' | 'assistant';
      text: string;
      tool_calls?: Array<Record<string, unknown>> | null;
      created_at: string;
    };
    if (!data.id || !data.conversation_id) return;
    const store = useChatStore.getState();
    const toolCalls = Array.isArray(data.tool_calls) && data.tool_calls.length > 0
      ? data.tool_calls.map((t) => ({
          id: String(t.id ?? crypto.randomUUID()),
          tool: String(t.tool ?? t.name ?? 'unknown'),
          status: t.status as import('@/types/chat').ToolCallRecord['status'],
          summary: typeof t.summary === 'string' ? t.summary : undefined,
          input: (() => {
            const raw = t.input ?? t.arguments;
            if (typeof raw === 'string') return raw;
            if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
            return undefined;
          })(),
          output: typeof t.output === 'string' ? t.output : undefined,
        }))
      : undefined;
    // Append to messages map so the thread renders if opened.
    store.addMessage({
      id: data.id,
      conversation_id: data.conversation_id,
      role: data.role,
      content: data.text,
      agent: data.role === 'assistant' ? data.from_agent : undefined,
      timestamp: data.created_at,
      tool_calls: toolCalls,
    });
    // Refresh conversation list so the new thread shows in sidebar
    // with its message_count and lastMessageAt updated.
    void store.loadConversations();
  }, [subagentMsgEvent]);

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

  // Ola 5: reactive push notifications from the ClawEventBus. The Core
  // service `push-from-events.service.ts` maps bus events (built-in
  // safety net + user triggers with action `push.send`) into
  // `notification.new` frames. We just relay severity → toast style and
  // pipe the payload into the notification store (its 30-min title
  // dedup is enough to avoid spam).
  useEffect(() => {
    if (!notificationEvent || notificationEvent.event !== 'notification.new') return;
    const d = notificationEvent.data as {
      template?: string;
      title?: string;
      body?: string;
      severity?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
      action?: { label: string; route?: string };
    };
    const title = d.title ?? d.template ?? 'Notificación';
    const description = d.body;
    switch (d.severity) {
      case 'critical':
      case 'error':
        toast.error(title, { description, duration: 8000 });
        break;
      case 'warn':
        toast.warning(title, { description, duration: 6000 });
        break;
      default:
        toast(title, { description });
    }
    addNotification({
      type: 'system',
      title,
      body: description,
      action: d.action,
    });
  }, [notificationEvent, addNotification]);

  // Sensor fusion events
  useEffect(() => {
    if (!sensorEvent) return;
    if (sensorEvent.event === 'sensor.rule_triggered') {
      const ruleName = sensorEvent.data.rule_name as string;
      const actions = sensorEvent.data.actions_executed as number;
      toast(`${ruleName} activated`, {
        description: `${actions} action${actions === 1 ? '' : 's'} executed`,
        duration: 5000,
      });
      addNotification({
        type: 'system',
        title: `Rule triggered: ${ruleName}`,
        action: { label: 'View', route: '/settings/sensor-fusion' },
      });
    } else if (sensorEvent.event === 'sensor.ha_connected') {
      toast.success('Home Assistant connected');
    } else if (sensorEvent.event === 'sensor.ha_disconnected') {
      toast.error('Home Assistant disconnected');
    }
  }, [sensorEvent, addNotification]);

  // ── Workflow events ──
  useEffect(() => {
    if (!workflowEvent) return;
    import('@/stores/flows.store').then(({ useFlowsStore }) => {
      const flowsState = useFlowsStore.getState();

      if (workflowEvent.event === 'workflow.completed') {
        const name = workflowEvent.data.flow_name as string;
        toast.success(`Flow "${name}" completed`);
        flowsState.onWorkflowCompleted(workflowEvent.data as Record<string, unknown>);
      } else if (workflowEvent.event === 'workflow.failed') {
        const name = workflowEvent.data.flow_name as string;
        const error = workflowEvent.data.error as string;
        toast.error(`Flow "${name}" failed: ${error}`);
        flowsState.onWorkflowFailed(workflowEvent.data as Record<string, unknown>);
      } else if (workflowEvent.event === 'workflow.needs_approval') {
        const name = workflowEvent.data.flow_name as string;
        addNotification({
          type: 'approval',
          title: `Flow "${name}" needs approval`,
          action: { label: 'Review', route: '/flows' },
        });
        flowsState.onWorkflowNeedsApproval(workflowEvent.data as Record<string, unknown>);
      } else if (workflowEvent.event === 'workflow.started') {
        flowsState.onWorkflowStarted(workflowEvent.data as Record<string, unknown>);
      }
    });
  }, [workflowEvent, addNotification]);

  return (
    <TooltipProvider>
      <div style={{ position: 'fixed', inset: 0, display: 'flex', overflow: 'hidden', background: 'var(--bg)', paddingTop: (gatewayConfigured === false || (onboardingJustCompleted && !bannerDismissed)) ? 40 : 0 }}>
        {/* Onboarding banner */}
        {gatewayConfigured === false && !bannerDismissed && (
          <OnboardingBanner variant="unconfigured" />
        )}
        {onboardingJustCompleted && !bannerDismissed && gatewayConfigured === true && (
          <OnboardingBanner variant="completed" onDismiss={() => setBannerDismissed(true)} />
        )}

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
