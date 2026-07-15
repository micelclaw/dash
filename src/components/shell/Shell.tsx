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
import { hasNativeNotify, startNativeNotifications, requestNativeNotifPermission } from '@/lib/native-notify';
import { useSidebarStore } from '@/stores/sidebar.store';
import { useWebSocketStore } from '@/stores/websocket.store';
import { useAuthStore } from '@/stores/auth.store';
import { useServiceUrlsStore } from '@/stores/service-urls.store';
import { useDigestStore } from '@/stores/digest.store';
import { useIsPhone, useIsCompact, useKeyboardOpen } from '@/hooks/use-media-query';
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
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomBar } from './BottomBar';
import { MobileBottomNav } from './MobileBottomNav';
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
import { useAppAccessStore } from '@/stores/app-access.store';
import { useUiModulesStore } from '@/stores/ui-modules.store';
import { useEntityTypesStore } from '@/stores/entity-types.store';
import { AppAccessGate } from '@/components/shell/AppAccessGate';
import { OnboardingBanner } from '@/components/onboarding/OnboardingBanner';
import { useStudioGenerationStreamsSubscription } from '@/modules/studio/streams/studio-generation-streams';
import { useChatStreamSubscription } from '@/hooks/use-chat-stream-subscription';
import { useChatReconcile } from '@/hooks/use-chat-reconcile';
import { useDeepLinks } from '@/hooks/use-deep-links';

export function Shell() {
  const { open: commandPaletteOpen, openPalette, closePalette } = useCommandPalette();
  const toggle = useSidebarStore((s) => s.toggle);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  // "App móvil" = teléfono en CUALQUIER orientación. useIsMobile es solo por ancho,
  // así que en landscape (ancho > 767) sacaba el Sidebar de módulos y la BottomBar de
  // escritorio. En teléfono la navegación de módulos vive SOLO en el botón "Más" de la
  // bottom-nav (petición del usuario) → usamos isPhone para el shell móvil.
  const isPhone = useIsPhone();
  // Con el teclado desplegado (móvil) ocultamos la nav inferior para dar más
  // espacio a la escritura (nota/evento/chat/correo…). El nav es flex-item, así
  // que al desmontarlo el contenido reclama el hueco.
  const keyboardOpen = useKeyboardOpen();
  const isCompact = useIsCompact();
  const location = useLocation();
  const connect = useWebSocketStore((s) => s.connect);
  const disconnect = useWebSocketStore((s) => s.disconnect);
  const wsStatus = useWebSocketStore((s) => s.status);
  const tokens = useAuthStore((s) => s.tokens);
  const refresh = useAuthStore((s) => s.refresh);
  const logout = useAuthStore((s) => s.logout);
  const isChatPage = location.pathname === '/chat';

  // Rutas "inmersivas": interfaces ricas de dibujo (whiteboard/Excalidraw y editor de
  // diagramas/ReactFlow) que necesitan todo el lienzo. En ellas ocultamos TopBar y la
  // nav inferior para dibujar a pantalla completa (petición móvil, aplica también en
  // escritorio). El launcher /sketches NO es inmersivo; sí sus subrutas.
  const isImmersive =
    location.pathname !== '/sketches' && location.pathname.startsWith('/sketches/');

  // Deep-links del wrapper móvil (widgets nativos → abrir ruta/registro). No-op en web.
  useDeepLinks();

  // Siembra la cookie `claw_session` en el WebView/navegador (idempotente). Los iframes
  // de servicios embebidos same-origin (Mathesar/Portainer/…) autorizan por esta cookie
  // (el navegador NO manda Authorization en la navegación de un iframe). En web ya la pone
  // el login; en la app móvil la sesión entra por device token/handoff (Bearer) y el
  // WebView puede no tenerla → sin esto los embeds darían 401. El api client adjunta el
  // Bearer y Core lo refleja a la cookie httpOnly. No-op si algo falla.
  useEffect(() => {
    api.post('/auth/session-cookie').catch(() => { /* best-effort */ });
  }, []);

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
  const refreshAppAccess = useAppAccessStore((s) => s.refresh);
  const refreshUiModules = useUiModulesStore((s) => s.refresh);
  const refreshEntityTypes = useEntityTypesStore((s) => s.refresh);

  useEffect(() => {
    fetchSnapshot();
    fetchSettings();
    // Rediseño NAS, Fase 1: cargar qué apps/módulos ve este usuario (gating del
    // Sidebar + router). Failures silenciosos → fail-open (ver app-access.store).
    void refreshAppAccess();
    // Módulos dinámicos (apps L3 instaladas servidas por Core como iframe): el
    // backend (/me/ui-modules) ya los filtra por instalada+activa+cargada+concedida.
    void refreshUiModules();
    // Tipos de entidad de apps L3 (chips de chat, p.ej. "workflow" de n8n) — se
    // mergean en ENTITY_REF_MAP/MENTION_DOMAINS (config/entity-refs.ts).
    void refreshEntityTypes();
    // Resolver de URLs de servicios por dominio (stirling.victor.claw en vez de
    // localhost:8081). Carga el catálogo una vez; failures silenciosos → respaldo.
    void useServiceUrlsStore.getState().load();
    // Ola 7: load OpenClaw config schema once at boot. Used by the Raw JSON
    // editor (/settings/raw) for client-side validation. Failures are silent.
    loadConfigSchema();
    // Poll Gateway health every 30s so the composite ConnectionStatus
    // and the chat input dot reflect the real Core↔Gateway state, not
    // just dash↔Core. /gateway/health is cheap (<50ms). fetchHealth
    // silently swallows errors (last-known value retained).
    const healthPoll = setInterval(() => { void fetchHealth(); }, 30_000);
    return () => clearInterval(healthPoll);
  }, [fetchSnapshot, fetchSettings, loadConfigSchema, fetchHealth, refreshAppAccess, refreshUiModules, refreshEntityTypes]);

  // G5: auto-resubscribe push idempotently. If permission is granted and
  // the browser still holds a sub but the backend has lost it (DB wipe,
  // 410 cleanup race, etc.), re-POST it. Pure best-effort: silent on
  // every failure path because the user already gave permission once.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const local = await reg.pushManager.getSubscription();
        if (!local) return;
        const { api } = await import('@/services/api');
        const res = await api.get<{ data: { subscriptions: Array<{ id: string; endpoint?: string }> } }>('/push/subscriptions');
        const known = (res.data.subscriptions ?? []).some((s) => s.endpoint === local.endpoint);
        if (known) return;
        const json = local.toJSON();
        await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
      } catch (err) {
        console.warn('[push] auto-resubscribe failed', err);
      }
    })();
  }, []);

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

  // Chat stream — ÚNICA suscripción global a chat.stream.* (antes vivía en
  // ChatPage/BottomBar, que se desmontan al navegar → done perdido → F5).
  // + reconciliación desde DB al reconectar/volver-a-pestaña. DB-authoritative.
  useChatStreamSubscription();
  useChatReconcile();

  // Fetch services on mount
  const fetchServices = useServicesStore((s) => s.fetchServices);
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Auto-collapse on compact screens, auto-expand when viewport goes wide
  const prevCompactRef = useRef(isCompact);
  useEffect(() => {
    if (isPhone) return;
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
  }, [isCompact, isPhone, setCollapsed]);

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
  const agentEvent = useWebSocket('agent.*');
  const digestEvent = useWebSocket('digest.*');
  const approvalEvent = useWebSocket('approval.*');
  const clipboardEvent = useWebSocket('clipboard.*');
  const processEvent = useWebSocket('process.*');
  const photoWorkerEvent = useWebSocket('photo.worker.*');
  const mediaEvent = useWebSocket('media.download.*');
  const notificationEvent = useWebSocket('notification.new');
  const postYieldEvent = useWebSocket('chat.post_yield_message');

  // (A4) La síntesis de notificaciones de `sync.*` y `email.*` se ELIMINÓ: el servidor
  // las decide desde el bus (plantillas `content.sync.*` / `content.email.received`) y
  // llegan por `notification.new`. Los frames `sync.*` siguen vivos como ESTADO — quien
  // los necesite (listas, badges) que se suscriba en su módulo.

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

    // NOTA: el resto de `agent.*` NO se convierte en notificación aquí. El bus
    // canónico reemite CADA evento de dominio como `agent.event` (data =
    // {id,type,source,target,severity,payload,...}) — leer `data.agent`/`data.summary`
    // daba "undefined: undefined" para casi todo. Las notificaciones las decide el
    // servidor y llegan por `notification.new` (arriba). Aquí solo tratamos los casos
    // interactivos (stuck_yield / model_changed).
  }, [agentEvent]);

  const handleDigestReady = useDigestStore((s) => s.handleDigestReady);
  const handleDigestUrgent = useDigestStore((s) => s.handleDigestUrgent);
  const handleDigestEnriched = useDigestStore((s) => s.handleDigestEnriched);

  useEffect(() => {
    if (!digestEvent) return;
    // (A4) Solo ESTADO: el aviso (campana en escritorio / nativa en móvil) lo emite el
    // servidor con la plantilla `content.digest.ready`. Aquí ya no se sintetiza ni se
    // hace toast — duplicaría la notificación del servidor.
    if (digestEvent.event === 'digest.ready') {
      handleDigestReady(digestEvent.data);
    } else if (digestEvent.event === 'digest.urgent') {
      handleDigestUrgent(digestEvent.data);
    } else if (digestEvent.event === 'digest.enriched') {
      handleDigestEnriched(digestEvent.data);
    }
  }, [digestEvent, handleDigestReady, handleDigestUrgent, handleDigestEnriched]);

  // (Las notificaciones de `system.*` las decide el servidor y llegan por
  // `notification.new` — el handler genérico de aquí duplicaba y mostraba el
  // `message` crudo de cualquier evento de sistema.)

  const fetchPendingCount = useSecurityStore((s) => s.fetchPendingCount);

  // Fetch approval pending count on mount
  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  useEffect(() => {
    if (!approvalEvent) return;

    // Conversación de ORIGEN de la aprobación (la rellena Core desde el sessionKey
    // de la tool-call). Enrutamos cada tarjeta/mensaje a SU chat — NO al activo —
    // para que las aprobaciones de chats distintos no se agrupen todas en uno.
    // Si no viene (aprobación de canal/cron/HTTP directo, sin chat de origen) NO
    // se inyecta en el chat: basta la notificación + la página /approvals.
    // (Nota rollout: hasta recargar el Gateway con el hook nuevo, el evento llega
    // sin conversation_id → la tarjeta vive solo en la notificación/approvals.)
    const originConvId = (approvalEvent.data.conversation_id as string | undefined) ?? null;

    if (approvalEvent.event === 'approval.new') {
      // (A4) La notificación la emite el servidor (`content.approval.new`) → aquí solo
      // la tarjeta inline del chat, que es ESTADO de la conversación, no un aviso.

      // Inject approval card into its ORIGIN conversation (addMessage routes by
      // conversation_id and bumps that conv's unread counter).
      if (originConvId) {
        useChatStore.getState().addMessage({
          id: `approval-${approvalEvent.data.id as string}`,
          conversation_id: originConvId,
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
      // Update inline approval card status (busca la tarjeta en cualquier conv).
      useChatStore.getState().updateApprovalStatus(
        approvalEvent.data.id as string,
        approvalEvent.data.status as 'approved' | 'rejected' | 'expired',
      );
    } else if (approvalEvent.event === 'approval.executed') {
      // Auto-execute result: inject as a message in its origin conversation.
      if (originConvId) {
        useChatStore.getState().addMessage({
          id: `approval-exec-${approvalEvent.data.id as string}`,
          conversation_id: originConvId,
          role: 'assistant',
          content: approvalEvent.data.message as string,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (approvalEvent.event === 'approval.agent_response') {
      // Agent's follow-up response after approval notification.
      // MODO LEDGER (`ledger_covered:true`): la fila REAL del resume la
      // persiste+emite el ledger (`chat.ledger_message`, id de DB) — pintar
      // además este texto efímero (id no-determinista) duplicaría SIEMPRE.
      if (originConvId && approvalEvent.data.text && approvalEvent.data.ledger_covered !== true) {
        useChatStore.getState().addMessage({
          id: `approval-agent-${Date.now()}`,
          conversation_id: originConvId,
          role: 'assistant',
          content: approvalEvent.data.text as string,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Refresh pending count on any approval event
    fetchPendingCount();
  }, [approvalEvent, fetchPendingCount]);

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

  // Webchat Session Ledger: mensajes assistant persistidos desde el JSONL de
  // OpenClaw para turnos que el dash NO está streameando (resume de aprobación,
  // inter-sesión, continuación tras reinicio de Core). Cada evento trae la fila
  // REAL de DB (id + tool pills + thinking) → el chat queda completo EN VIVO.
  // El Core suprime este push mientras chat-bridge streamea la conv (el done
  // entrega `messages[]`), así que aquí no hay riesgo de doble burbuja.
  const ledgerMsgEvent = useWebSocket('chat.ledger_message');
  useEffect(() => {
    if (!ledgerMsgEvent) return;
    const data = ledgerMsgEvent.data as {
      id: string;
      conversation_id: string | null;
      session_id: string;
      from_agent: string;
      text: string;
      tool_calls?: Array<Record<string, unknown>> | null;
      thinking?: string | null;
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
          text_offset: typeof t.text_offset === 'number' ? t.text_offset : undefined,
          entity_refs: Array.isArray(t.entity_refs) ? (t.entity_refs as Array<{ type: string; id: string; title: string | null }>) : undefined,
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
      thinking: data.thinking ?? undefined,
    });
    // Limpia el placeholder de yield/espera si era de esta conversación.
    if (store.streamingMessage?.conversationId === data.conversation_id) {
      store.setStreamingMessage(null);
    }
  }, [ledgerMsgEvent]);

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
    // (A4) Solo ESTADO — refrescar la lista de descargas. El aviso lo emite el servidor
    // (`content.media.completed` / `content.media.error`); el toast de aquí duplicaba.
    if (
      mediaEvent.event === 'media.download.complete' ||
      mediaEvent.event === 'media.download.error'
    ) {
      usePlayerStore.getState().fetchDownloads();
    }
  }, [mediaEvent]);

  // Listen for CommandPalette "Download Media" action
  useEffect(() => {
    const handler = () => setDownloadDialogOpen(true);
    window.addEventListener('claw:open-download-dialog', handler);
    return () => window.removeEventListener('claw:open-download-dialog', handler);
  }, []);

  // (Las notificaciones de cambios CRUD ya no se sintetizan aquí — leían
  // `change.data.summary`, que casi siempre es undefined → "Background: undefined".
  // Si se quieren como notificación, se plantillan server-side y llegan por
  // `notification.new`.)

  // Ola 5: reactive push notifications from the ClawEventBus. The Core
  // service `push-from-events.service.ts` maps bus events (built-in
  // safety net + user triggers with action `push.send`) into
  // `notification.new` frames. We just relay severity → toast style and
  // pipe the payload into the notification store (its 30-min title
  // dedup is enough to avoid spam).
  useEffect(() => {
    if (!notificationEvent || notificationEvent.event !== 'notification.new') return;
    // En el APK nativo la entrega es 100% NATIVA: el servicio ClawConnectionService
    // recibe este mismo frame por su propio WS y lo postea en la barra de Android
    // (foreground incluido). El dash NO pinta nada — ni toast ni campana (2B).
    if (hasNativeNotify()) return;
    // Servidor = fuente única: Core (`push-from-events.service.ts`) decide qué se
    // notifica y manda este frame ya construido (id/type/category/title/body/action/
    // timestamp). El dash SOLO lo pinta — no vuelve a inventar notificaciones de
    // eventos crudos del bus. `id` hace la dedupe idempotente (multi-pestaña/reconexión).
    const d = notificationEvent.data as {
      id?: string;
      template?: string;
      type?: Notification['type'];
      title?: string;
      body?: string;
      severity?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
      action?: { label: string; route?: string };
      timestamp?: string;
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
      id: d.id,
      type: d.type ?? 'system',
      title,
      body: description,
      action: d.action,
      timestamp: d.timestamp,
    });
  }, [notificationEvent, addNotification]);

  // Notificaciones NATIVAS en el APK móvil: al cargar el dash autenticado, pide el
  // permiso (API 33+) y arranca el servicio self-hosted (WS a tu box → barra de
  // Android). Entrega 100% nativa (foreground incluido): el servicio postea SIEMPRE,
  // el dash no pinta nada (ver el early-return de `notification.new`). Por eso ya no
  // se reporta el estado de foreground — no gobierna la entrega.
  useEffect(() => {
    if (!hasNativeNotify()) return;
    requestNativeNotifPermission();
    startNativeNotifications();
  }, []);

  // ── Workflow events (MicelFlow) retirados 2026-06-30 — la automatización es n8n. ──

  return (
    <TooltipProvider>
      <div className="shell-root" style={{ position: 'fixed', inset: 0, display: 'flex', overflow: 'hidden', background: 'var(--bg)', paddingTop: (gatewayConfigured === false || (onboardingJustCompleted && !bannerDismissed)) ? 40 : 0 }}>
        {/* Onboarding banner */}
        {gatewayConfigured === false && !bannerDismissed && (
          <OnboardingBanner variant="unconfigured" />
        )}
        {onboardingJustCompleted && !bannerDismissed && gatewayConfigured === true && (
          <OnboardingBanner variant="completed" onDismiss={() => setBannerDismissed(true)} />
        )}

        {/* Desktop sidebar (en móvil se sustituye por la bottom-nav de abajo).
            isPhone (no isMobile) → oculto también en landscape de teléfono. */}
        {!isPhone && (
          <Sidebar onOpenCommandPalette={openPalette} />
        )}

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {!isImmersive && <TopBar onOpenCommandPalette={openPalette} />}

          {/* Content + BottomBar */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <AppAccessGate><Outlet /></AppAccessGate>
            </div>
            {/* Móvil (teléfono, cualquier orientación): nav inferior de 5 slots
                (Hoy/Chat/+/Buscar/Más). Escritorio: la BottomBar de chat acoplada
                (salvo en /chat). En rutas inmersivas se ocultan ambas. */}
            {!isImmersive && (isPhone ? (!keyboardOpen && <MobileBottomNav />) : (!isChatPage && <BottomBar />))}
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
