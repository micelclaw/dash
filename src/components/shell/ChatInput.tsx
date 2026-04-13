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

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { ArrowUp, ChevronUp, ChevronDown, Paperclip, X, FileText, Image as ImageIcon, File } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useModuleContext } from '@/hooks/use-module-context';
import { useVoice } from '@/hooks/use-voice';
import { useVoiceStream } from '@/hooks/use-voice-stream';
import { AgentSelector } from './AgentSelector';
import { SlashCommandMenu } from './SlashCommandMenu';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { SpeakingIndicator } from '@/components/voice/SpeakingIndicator';
import { ThinkingLevelIndicator } from './ThinkingLevelIndicator';
import { api } from '@/services/api';
import type { ChatAttachment } from '@/types/chat';

interface ChatInputProps {
  onExpand?: () => void;
  onCollapse?: () => void;
  showExpand?: boolean;
  showCollapse?: boolean;
  compactAgent?: boolean;
}

export function ChatInput({ onExpand, onCollapse, showExpand, showCollapse, compactAgent }: ChatInputProps) {
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastInputWasVoiceRef = useRef(false);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const cancelStream = useChatStore((s) => s.cancelStream);
  const isProcessing = !!streamingMessage;
  const moduleContext = useModuleContext();
  const voice = useVoice();
  const voiceStream = useVoiceStream();
  const isFullDuplex = true; // Always use streaming voice mode
  const conversationId = useChatStore((s) => s.activeConversationId);

  const uploadFile = useCallback(async (file: File): Promise<ChatAttachment | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('parent_folder', '/chat-attachments/');
      const res = await api.upload<{ data: { id: string; filename: string; mime_type: string; size_bytes: number; filepath: string } }>('/files/upload', formData);
      const d = res.data;
      let previewUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      }
      return { id: d.id, filename: d.filename, mime_type: d.mime_type, size_bytes: d.size_bytes, filepath: d.filepath, preview_url: previewUrl };
    } catch (err) {
      console.error('[chat] File upload failed:', err);
      return null;
    }
  }, []);

  const handleFileSelect = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const results = await Promise.all(Array.from(fileList).map(uploadFile));
    const successful = results.filter((r): r is ChatAttachment => r !== null);
    if (successful.length > 0) {
      setPendingFiles((prev) => [...prev, ...successful]);
    }
    setUploading(false);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadFile]);

  const removePendingFile = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed?.preview_url) URL.revokeObjectURL(removed.preview_url);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && pendingFiles.length === 0) return;
    lastInputWasVoiceRef.current = false;
    sendMessage(trimmed || '(attached files)', {
      module: moduleContext.moduleId,
      active_item: moduleContext.activeItem,
      editor_context: moduleContext.editorContext,
    }, pendingFiles.length > 0 ? pendingFiles : undefined);
    setText('');
    setPendingFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, pendingFiles, sendMessage, moduleContext]);

  const handleVoiceStop = useCallback(async () => {
    const transcript = await voice.stopRecording();
    if (transcript) {
      lastInputWasVoiceRef.current = true;
      sendMessage(transcript, {
        module: moduleContext.moduleId,
        active_item: moduleContext.activeItem,
        editor_context: moduleContext.editorContext,
      });
    }
  }, [voice, sendMessage, moduleContext]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  const handleInput = useCallback(() => {
    resizeTextarea();
  }, [resizeTextarea]);

  // Auto-resize textarea whenever text changes (covers programmatic setText from voice)
  useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  // Full-duplex: show transcript in textarea when session ends (user reviews + sends with Enter)
  const prevSessionActiveRef = useRef(false);
  useEffect(() => {
    const wasActive = prevSessionActiveRef.current;
    prevSessionActiveRef.current = voiceStream.isSessionActive;

    if (wasActive && !voiceStream.isSessionActive && isFullDuplex) {
      const trimmed = voiceStream.transcript.trim();
      if (trimmed) {
        lastInputWasVoiceRef.current = true;
        setText(trimmed);
      }
    }
  }, [voiceStream.isSessionActive, voiceStream.transcript, isFullDuplex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape' && onCollapse) {
        onCollapse();
      }
    },
    [handleSend, onCollapse],
  );

  // Space push-to-talk / full-duplex hold-to-talk: only when textarea is not focused
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      // Don't interfere with typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (isFullDuplex) {
        // Full-duplex: hold Space to stream (start on keydown, stop on keyup)
        e.preventDefault();
        if (!voiceStream.isSessionActive) {
          const convId = conversationId ?? crypto.randomUUID();
          voiceStream.startSession(convId);
        }
        return;
      }

      // Push-to-talk: hold Space to record
      if (voice.state !== 'idle' && voice.state !== 'recording') return;
      e.preventDefault();
      if (voice.state === 'idle') {
        voice.startRecording();
      }
    };

    const handleKeyUp = (e: globalThis.KeyboardEvent) => {
      if (e.code !== 'Space') return;

      if (isFullDuplex) {
        // Full-duplex: release Space ends session
        if (voiceStream.isSessionActive) {
          voiceStream.endSession();
        }
        return;
      }

      if (voice.state === 'recording') {
        handleVoiceStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [voice, voiceStream, handleVoiceStop, isFullDuplex, conversationId]);

  // TTS auto-play: when the last input was voice AND autoplay_responses is enabled
  useEffect(() => {
    const handler = (e: Event) => {
      const responseText = (e as CustomEvent).detail?.text as string;
      if (!responseText || voice.state !== 'idle') return;
      if (!lastInputWasVoiceRef.current) return;
      const autoplay = useSettingsStore.getState().settings?.voice?.autoplay_responses ?? false;
      if (!autoplay) {
        lastInputWasVoiceRef.current = false;
        return;
      }
      lastInputWasVoiceRef.current = false;
      voice.playTts(responseText);
    };
    window.addEventListener('claw:tts-autoplay', handler);
    return () => window.removeEventListener('claw:tts-autoplay', handler);
  }, [voice]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <AgentSelector compact={compactAgent} />

      <SlashCommandMenu onSelect={(cmd) => {
        sendMessage(cmd, {
          module: moduleContext.moduleId,
          active_item: moduleContext.activeItem,
          editor_context: moduleContext.editorContext,
        });
      }} />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '4px 8px',
          transition: 'border-color var(--transition-fast)',
        }}
      >
        {/* Pending file chips */}
        {pendingFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingBottom: 4 }}>
            {pendingFiles.map((f) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 6px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                  maxWidth: 180,
                }}
              >
                {f.preview_url ? (
                  <img src={f.preview_url} alt="" style={{ width: 16, height: 16, objectFit: 'cover', borderRadius: 2 }} />
                ) : f.mime_type === 'application/pdf' ? (
                  <FileText size={12} />
                ) : f.mime_type.startsWith('image/') ? (
                  <ImageIcon size={12} />
                ) : (
                  <File size={12} />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {f.filename}
                </span>
                <button
                  onClick={() => removePendingFile(f.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {uploading && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', padding: '2px 4px' }}>Uploading...</span>
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => !isProcessing && setText(e.target.value)}
          onKeyDown={isProcessing ? undefined : handleKeyDown}
          onInput={isProcessing ? undefined : handleInput}
          readOnly={isProcessing}
          placeholder={isProcessing ? 'Processing...' : 'Ask anything...'}
          rows={1}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-sans)',
            resize: 'none',
            lineHeight: 1.5,
            minHeight: 24,
            maxHeight: 200,
            overflowY: 'auto',
            padding: '2px 0',
            wordBreak: 'break-word',
          }}
        />
      </div>

      {/* Voice — full-duplex mode or push-to-talk mode */}
      {isFullDuplex ? (
        voiceStream.state === 'speaking' ? (
          <SpeakingIndicator onStop={voiceStream.stopTts} />
        ) : (
          <VoiceButton
            state={voiceStream.state === 'listening' ? 'recording' : voiceStream.state}
            duration={voiceStream.duration}
            onStart={() => {
              const convId = conversationId ?? crypto.randomUUID();
              voiceStream.startSession(convId);
            }}
            onStop={voiceStream.endSession}
          />
        )
      ) : voice.state === 'speaking' ? (
        <SpeakingIndicator onStop={voice.stopTts} />
      ) : (
        <VoiceButton
          state={voice.state}
          duration={voice.duration}
          onStart={voice.startRecording}
          onStop={handleVoiceStop}
        />
      )}

      {/* Attachment */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e.target.files)}
        accept="image/*,.pdf,.txt,.md,.csv,.json,.yaml,.yml,.xml,.html,.css,.js,.ts,.py,.sh,.sql,.log,.zip,.tar,.gz"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{
          background: 'none',
          border: 'none',
          cursor: uploading ? 'wait' : 'pointer',
          color: pendingFiles.length > 0 ? 'var(--amber)' : 'var(--text-muted)',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 'var(--radius-sm)',
          opacity: uploading ? 0.5 : 1,
        }}
      >
        <Paperclip size={18} />
      </button>

      {/* Thinking level indicator */}
      <ThinkingLevelIndicator />

      {/* Status indicator: red (processing, clickable to cancel) / green (ready) */}
      <div
        onClick={isProcessing ? cancelStream : undefined}
        title={isProcessing ? 'Click to cancel' : 'Ready'}
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          flexShrink: 0,
          background: isProcessing ? '#ef4444' : '#22c55e',
          cursor: isProcessing ? 'pointer' : 'default',
          transition: 'background 0.2s',
        }}
      />

      {/* Send button */}
      {(text.trim() || pendingFiles.length > 0) && !isProcessing && (
        <button
          onClick={handleSend}
          style={{
            background: 'var(--amber)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ArrowUp size={16} color="#06060a" />
        </button>
      )}

      {/* Expand */}
      {showExpand && (
        <button
          onClick={onExpand}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            padding: 4,
            display: 'flex',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <ChevronUp size={16} />
        </button>
      )}

      {/* Collapse */}
      {showCollapse && (
        <button
          onClick={onCollapse}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-dim)',
            padding: 4,
            display: 'flex',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <ChevronDown size={16} />
        </button>
      )}
    </div>
  );
}
