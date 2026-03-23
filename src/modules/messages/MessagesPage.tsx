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
import { useSearchParams } from 'react-router';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SplitPane } from '@/components/shared/SplitPane';
import { ChannelSidebar } from './ChannelSidebar';
import { MessageThread } from './MessageThread';
import { useChannels } from './hooks/use-channels';
import { useChannelMessages } from './hooks/use-channel-messages';
import { useSendMessage } from './hooks/use-send-message';

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(
    searchParams.get('platform'),
  );
  const [search, setSearch] = useState('');

  const { channels, loading: channelsLoading, refetch: refetchChannels } = useChannels({
    platform: platformFilter ?? undefined,
  });
  const { messages, loading: msgsLoading, hasMore, loadMore, refetch: refetchMessages, appendMessage } = useChannelMessages(selectedChannelId);
  const { send, sending } = useSendMessage();
  const sendingRef = useRef(false);

  // Auto-select first channel if none selected
  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0]!.platform_channel_id);
      setSelectedPlatform(channels[0]!.platform);
    }
  }, [channels, selectedChannelId]);

  // Poll for new messages every 5s (simple real-time until WS events)
  // Skip message refetch while a send is in-flight to preserve optimistic message
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
  }

  function handlePlatformFilter(platform: string | null) {
    setPlatformFilter(platform);
    if (platform) {
      setSearchParams({ platform });
    } else {
      setSearchParams({});
    }
    // Deselect if current channel doesn't match new filter
    if (platform && selectedPlatform && selectedPlatform !== platform) {
      setSelectedChannelId(null);
      setSelectedPlatform(null);
    }
  }

  const handleSend = useCallback(async (content: string) => {
    if (!selectedPlatform || !selectedChannelId) return;

    // Optimistic: show message immediately
    const optimistic: any = {
      id: `optimistic-${Date.now()}`,
      platform: selectedPlatform,
      platform_channel_id: selectedChannelId,
      direction: 'sent',
      sender_name: 'You',
      content,
      content_type: 'text',
      sent_at: new Date().toISOString(),
    };
    appendMessage(optimistic);

    sendingRef.current = true;
    const result = await send(selectedPlatform, selectedChannelId, content);
    sendingRef.current = false;

    if (!result) {
      toast.error('Failed to send message');
    }
    // Always refetch: replaces optimistic with real DB message, or removes it on failure
    refetchMessages();
  }, [selectedPlatform, selectedChannelId, send, appendMessage, refetchMessages]);

  // Find the active channel info
  const activeChannel = channels.find(
    c => c.platform_channel_id === selectedChannelId && c.platform === selectedPlatform
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <SplitPane defaultSizes={[28, 72]} minSizes={[220, 300]} id="messages-split">
        {/* Left: Channel list */}
        <ChannelSidebar
          channels={channels}
          selectedChannelId={selectedChannelId}
          platformFilter={platformFilter}
          search={search}
          onSelectChannel={handleSelectChannel}
          onPlatformFilter={handlePlatformFilter}
          onSearchChange={setSearch}
        />

        {/* Right: Thread or empty state */}
        {selectedChannelId && selectedPlatform ? (
          <MessageThread
            channelName={activeChannel?.channel_name ?? selectedChannelId}
            platform={selectedPlatform}
            messages={messages}
            loading={msgsLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onSend={handleSend}
            sending={sending}
          />
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text-muted)',
            gap: 12,
          }}>
            <MessageCircle size={32} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: '0.875rem' }}>
              {channelsLoading ? 'Loading channels...' : 'Select a conversation'}
            </span>
          </div>
        )}
      </SplitPane>
    </div>
  );
}
