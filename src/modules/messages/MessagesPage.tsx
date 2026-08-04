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

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router';
import { MessageCircle, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWebSocket } from '@/hooks/use-websocket';
import { SplitPane } from '@/components/shared/SplitPane';
import { ChannelSidebar } from './ChannelSidebar';
import { MessageThread } from './MessageThread';
import { useChannels } from './hooks/use-channels';
import { useChannelMessages } from './hooks/use-channel-messages';
import { useSendMessage } from './hooks/use-send-message';
import { usePlatformCapabilitiesStore } from '@/stores/platform-capabilities.store';
import { ChannelConfigModal } from '@/components/settings/sections/ChannelConfigModal';
import { NewChatDialog } from '@/components/settings/sections/NewChatDialog';
import { platformMeta } from '@/config/messaging-platforms';
import { refreshChannel } from '@/services/messages.service';
import type { Message } from '@/services/messages.service';

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(searchParams.get('platform'));
  const [search, setSearch] = useState('');

  const { channels, loading: channelsLoading, refetch: refetchChannels } = useChannels({
    platform: platformFilter ?? undefined,
  });
  const {
    messages, loading: msgsLoading, loadingOlder, hasMore, error: msgsError,
    loadOlder, refetch: refetchMessages, appendOptimistic,
  } = useChannelMessages(selectedChannelId, selectedPlatform);
  const { send, sending } = useSendMessage();
  const sendingRef = useRef(false);
  const syncCompleted = useWebSocket('sync.completed');

  const refreshCaps = usePlatformCapabilitiesStore((s) => s.refresh);
  const capsByPlatform = usePlatformCapabilitiesStore((s) => s.byPlatform);
  /** Selector de chats abierto desde Messages (el mismo de Channel Observers). */
  const [picker, setPicker] = useState<{ connectorId: string; connectorType: string; platform: string } | null>(null);

  const handleAddChats = useCallback((platform: string) => {
    const cap = capsByPlatform[platform];
    const connectorId = cap?.connector?.id;
    if (!connectorId) {
      toast.error(`${platform} isn’t connected yet — connect it in Settings → Channel Observers`);
      return;
    }
    setPicker({ connectorId, connectorType: platformMeta(platform).connectorType ?? '', platform });
  }, [capsByPlatform]);

  /** "Escribir a un contacto nuevo": abre el diálogo con el identificador que pida la plataforma. */
  const [newChat, setNewChat] = useState<{ platform: string; label: string; kind: 'phone' | 'username' | 'phone_or_username' } | null>(null);
  const handleStartChat = useCallback((platform: string) => {
    const cap = capsByPlatform[platform];
    if (!cap?.start_chat) return;
    setNewChat({ platform, label: platformMeta(platform).label, kind: cap.start_chat.kind });
  }, [capsByPlatform]);
  // Un chat recién iniciado aún NO tiene mensajes → no está en `channels`; sin esto,
  // el efecto "el chat desapareció" (más abajo) lo deseleccionaría al instante.
  const justStartedRef = useRef<string | null>(null);

  const capByPlatform = usePlatformCapabilitiesStore((s) => s.byPlatform);

  // Platform capabilities drive ComposeBar send gating. ALWAYS refetch fresh on
  // mount + on window focus — never rely on a possibly-stale cached value (a
  // capability fetched while Core was reloading could carry a transient
  // can_send=false and would otherwise stick, blocking the composer).
  useEffect(() => {
    refreshCaps();
    const onFocus = () => refreshCaps();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refreshCaps]);

  // Real-time: refetch when a sync completes that includes message changes.
  useEffect(() => {
    if (!syncCompleted) return;
    const breakdown = syncCompleted.data?.domain_breakdown as
      | Record<string, { created?: number; updated?: number }>
      | undefined;
    if (!breakdown?.messages) return;
    const { created = 0, updated = 0 } = breakdown.messages;
    if (created === 0 && updated === 0) return;

    refetchChannels();
    refreshCaps();
    if (selectedChannelId && !sendingRef.current) refetchMessages();
  }, [syncCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first channel if none selected.
  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0]!.platform_channel_id);
      setSelectedPlatform(channels[0]!.platform);
    }
  }, [channels, selectedChannelId]);

  // Si el chat seleccionado desaparece (lo borraron) → limpiar selección.
  useEffect(() => {
    if (!selectedChannelId || channels.length === 0) return;
    const stillThere = channels.some(
      (c) => c.platform_channel_id === selectedChannelId && c.platform === selectedPlatform,
    );
    if (stillThere) { justStartedRef.current = null; return; } // ya es un chat listado
    // Chat recién iniciado (sin mensajes aún) → mantenerlo abierto hasta que el
    // backfill / primer envío lo haga aparecer en la lista.
    if (justStartedRef.current === selectedChannelId) return;
    setSelectedChannelId(null);
    setSelectedPlatform(null);
  }, [channels, selectedChannelId, selectedPlatform]);

  // I-A: al abrir un chat, refresca ESA sala (mensajes/adjuntos nuevos + recibos
  // de lectura para el doble check). On-demand, una sala; si trae algo, recarga.
  // Y mientras el chat sigue abierto, un refresco periódico ligero (20s) mantiene
  // media (que el plugin trae como fila vacía) y el doble check al día.
  useEffect(() => {
    if (!selectedChannelId || !selectedPlatform) return;
    let cancelled = false;
    const doRefresh = () =>
      refreshChannel(selectedPlatform, selectedChannelId)
        .then((r) => { if (!cancelled && (r.imported > 0 || r.read_marked > 0)) refetchMessages(); })
        .catch(() => { /* best-effort */ });
    doRefresh();
    const interval = setInterval(doRefresh, 20_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedChannelId, selectedPlatform]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback poll every 5s — primary updates come via sync.completed.
  useEffect(() => {
    const interval = setInterval(() => {
      refetchChannels();
      if (selectedChannelId && !sendingRef.current) refetchMessages();
    }, 5_000);
    return () => clearInterval(interval);
  }, [refetchChannels, refetchMessages, selectedChannelId]);

  function handleSelectChannel(channelId: string, platform: string) {
    setSelectedChannelId(channelId);
    setSelectedPlatform(platform);
    // Refresh capabilities so the composer reflects the real send state for the
    // freshly-selected platform (self-heals any stale can_send).
    refreshCaps();
  }

  function handlePlatformFilter(platform: string | null) {
    setPlatformFilter(platform);
    setSearchParams(platform ? { platform } : {});
    if (platform && selectedPlatform && selectedPlatform !== platform) {
      setSelectedChannelId(null);
      setSelectedPlatform(null);
    }
  }

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedPlatform || !selectedChannelId) return;

      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        platform: selectedPlatform,
        platform_channel_id: selectedChannelId,
        channel_name: null,
        direction: 'sent',
        sender_name: 'You',
        content,
        content_type: 'text',
        sent_at: new Date().toISOString(),
        thread_id: null,
        pending: true,
      };
      appendOptimistic(optimistic);

      sendingRef.current = true;
      const result = await send(selectedPlatform, selectedChannelId, content);
      sendingRef.current = false;

      // El error REAL del backend, no un genérico: "Signal is not configured —
      // reconnect it…" orienta; "Failed to send message" deja a ciegas.
      if (!result.message) toast.error(result.error ?? 'Failed to send message');
      refetchMessages();
    },
    [selectedPlatform, selectedChannelId, send, appendOptimistic, refetchMessages],
  );

  const activeChannel = channels.find(
    (c) => c.platform_channel_id === selectedChannelId && c.platform === selectedPlatform,
  );
  const activeCapability = selectedPlatform ? capByPlatform[selectedPlatform] : undefined;
  const noChannels = !channelsLoading && channels.length === 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <SplitPane defaultSizes={[28, 72]} minSizes={[220, 300]} id="messages-split">
        <ChannelSidebar
          channels={channels}
          selectedChannelId={selectedChannelId}
          platformFilter={platformFilter}
          search={search}
          onSelectChannel={handleSelectChannel}
          onPlatformFilter={handlePlatformFilter}
          onSearchChange={setSearch}
          onAddChats={handleAddChats}
          onStartChat={handleStartChat}
          onRefetch={refetchChannels}
        />

        {selectedChannelId && selectedPlatform ? (
          <MessageThread
            channelId={selectedChannelId}
            channelName={activeChannel?.channel_name ?? selectedChannelId}
            platform={selectedPlatform}
            capability={activeCapability}
            messages={messages}
            loading={msgsLoading}
            loadingOlder={loadingOlder}
            hasMore={hasMore}
            error={msgsError}
            onLoadOlder={loadOlder}
            onSend={handleSend}
            sending={sending}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 12 }}>
            <MessageCircle size={32} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: '0.875rem' }}>
              {channelsLoading ? 'Loading channels...' : noChannels ? 'No conversations yet' : 'Select a conversation'}
            </span>
            {noChannels && (
              <Link
                to="/settings/observers"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', background: 'var(--amber)', color: '#000',
                  borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none',
                }}
              >
                <Settings2 size={14} /> Connect a channel
              </Link>
            )}
          </div>
        )}
      </SplitPane>

      {/* MISMO selector que en Settings → Channel Observers (un solo componente,
          no una copia): elegir qué chats se sincronizan desde donde los miras. */}
      {picker && (
        <ChannelConfigModal
          connectorId={picker.connectorId}
          connectorType={picker.connectorType}
          platform={picker.platform}
          onClose={() => setPicker(null)}
          onSaved={() => {
            setPicker(null);
            refreshCaps();
            refetchChannels();
          }}
        />
      )}

      {/* Escribir a un contacto nuevo → crea el chat + lo abre al instante. */}
      {newChat && (
        <NewChatDialog
          platform={newChat.platform}
          platformLabel={newChat.label}
          kind={newChat.kind}
          onClose={() => setNewChat(null)}
          onStarted={(ch) => {
            setNewChat(null);
            justStartedRef.current = ch.channel_id;
            setSelectedPlatform(ch.platform);
            setSelectedChannelId(ch.channel_id);
            setPlatformFilter(ch.platform);
            setSearchParams(ch.platform ? { platform: ch.platform } : {});
            refetchChannels();
            refreshCaps();
          }}
        />
      )}
    </div>
  );
}
