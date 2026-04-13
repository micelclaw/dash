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

// ─── useStudioStream — subscribes to studio.generation.* WS events ──
//
// Mirrors the chat-bridge streaming pattern: a single hook that
// accumulates tokens for a specific (project, phase) pair and exposes
// the live state to the UI. The reducer keeps the latest streamId so
// stale events from a previous (cancelled) generation are ignored.
//
// HARDENING:
//   - Tokens that arrive BEFORE we see a `start` event are not dropped.
//     We adopt the first token's `stream_id` as the active stream.
//     This protects against the rare ordering race where the WS bus
//     delivers `studio.generation.token` before `studio.generation.start`
//     (the backend now uses setImmediate to avoid this, but the frontend
//     needs the defence too in case of dev hot-reloads or reconnects).
//
//   - Incremental parser for the `<!-- DOC_BODY_END -->` and
//     `<!-- PENDING_QUESTIONS_*-->` sentinels. As soon as the model
//     finishes emitting the questions JSON, the panel can render them
//     in real time without waiting for the post-stream refetch.
//
//   - Optional debug buffer (last 50 events) gated by
//     `localStorage.studioDebugStream === '1'`. Used by the
//     `StreamDebugOverlay` component to diagnose streaming issues.

import { useEffect, useRef, useState } from 'react';
import { useWebSocketStore } from '@/stores/websocket.store';
import type { StudioPendingQuestion } from '@/stores/studio.store';

export type StudioStreamStatus =
  | 'idle'
  | 'starting'
  | 'streaming'
  | 'done'
  | 'error'
  | 'cancelled';

export interface StudioStreamState {
  status: StudioStreamStatus;
  streamId: string | null;
  /** Raw accumulated text — includes all sentinels. */
  text: string;
  /**
   * The doc body extracted from `<!-- DOC_BODY_START -->...END -->` if
   * present in `text`. Falls back to `text` (without questions block)
   * when the sentinel block hasn't been emitted yet, so the markdown
   * viewer always has *something* coherent to render during streaming.
   */
  displayBody: string;
  /**
   * Questions parsed in real time from the
   * `<!-- PENDING_QUESTIONS_START -->...END -->` JSON block as soon as
   * the closing sentinel arrives. `null` while the block is still
   * being written or has not appeared yet.
   */
  streamingQuestions: StudioPendingQuestion[] | null;
  tokensUsed: number;
  model: string | null;
  error: string | null;
}

interface StudioStreamEventData {
  stream_id?: string;
  project_id?: string;
  phase?: string;
  token?: string;
  full_text?: string;
  model?: string;
  tokens_used?: number;
  error?: string;
  started_at?: string;
}

interface DebugEvent {
  ts: number;
  event: string;
  stream_id: string | null;
  text_len: number;
  data_keys: string[];
}

const INITIAL: StudioStreamState = {
  status: 'idle',
  streamId: null,
  text: '',
  displayBody: '',
  streamingQuestions: null,
  tokensUsed: 0,
  model: null,
  error: null,
};

// Sentinel constants — must match
// `core/src/studio/llm/structured-output.ts`.
const DOC_BODY_START = '<!-- DOC_BODY_START -->';
const DOC_BODY_END = '<!-- DOC_BODY_END -->';
const QUESTIONS_START = '<!-- PENDING_QUESTIONS_START -->';
const QUESTIONS_END = '<!-- PENDING_QUESTIONS_END -->';

const DEBUG_BUFFER_LIMIT = 50;

export interface StudioStreamDebugInfo {
  enabled: boolean;
  events: DebugEvent[];
  activeStreamId: string | null;
}

/**
 * Subscribe to streaming events for a single (project, phase) pair.
 * Returns the live state plus a `reset()` callback and (when debug is
 * enabled via localStorage) a `debug()` accessor for the overlay.
 */
export function useStudioStream(projectId: string, phase: string) {
  const [state, setState] = useState<StudioStreamState>(INITIAL);
  const client = useWebSocketStore((s) => s.client);
  // Latest streamId we have seen — used to ignore stale events
  const activeStreamRef = useRef<string | null>(null);

  // Debug instrumentation: a ring buffer of recent events. Mounted as
  // a ref (no re-renders). The overlay reads it via the returned
  // accessor. Activated by `localStorage.studioDebugStream === '1'`.
  const debugRef = useRef<DebugEvent[]>([]);
  const debugEnabled = typeof window !== 'undefined'
    && window.localStorage?.getItem?.('studioDebugStream') === '1';

  useEffect(() => {
    if (!client) return;

    const handle = (event: { event: string; data: StudioStreamEventData }) => {
      const data = event.data ?? {};
      if (data.project_id !== projectId || data.phase !== phase) return;

      // Push to debug buffer FIRST so even dropped events are visible
      if (debugEnabled) {
        debugRef.current.push({
          ts: Date.now(),
          event: event.event,
          stream_id: data.stream_id ?? null,
          text_len: 0, // filled below for token events
          data_keys: Object.keys(data),
        });
        if (debugRef.current.length > DEBUG_BUFFER_LIMIT) {
          debugRef.current.shift();
        }
      }

      switch (event.event) {
        case 'studio.generation.start':
          activeStreamRef.current = data.stream_id ?? null;
          setState({
            status: 'starting',
            streamId: data.stream_id ?? null,
            text: '',
            displayBody: '',
            streamingQuestions: null,
            tokensUsed: 0,
            model: null,
            error: null,
          });
          break;

        case 'studio.generation.token': {
          // HARDENING: if we somehow received a token before any
          // `start` event (event reorder, hot reload, etc.), adopt
          // the token's stream_id as the active stream. This recovers
          // the early-token-loss scenario.
          if (activeStreamRef.current === null && data.stream_id) {
            activeStreamRef.current = data.stream_id;
          }
          if (data.stream_id !== activeStreamRef.current) return;
          const t = data.token ?? '';
          setState((prev) => {
            const nextText = prev.text + t;
            const parsed = parseIncrementalSentinels(nextText);
            return {
              ...prev,
              status: 'streaming',
              streamId: prev.streamId ?? data.stream_id ?? null,
              text: nextText,
              displayBody: parsed.body,
              streamingQuestions: parsed.questions ?? prev.streamingQuestions,
            };
          });
          break;
        }

        case 'studio.generation.done': {
          if (data.stream_id !== activeStreamRef.current) return;
          const finalText = data.full_text ?? '';
          const parsed = parseIncrementalSentinels(finalText);
          setState({
            status: 'done',
            streamId: data.stream_id ?? null,
            text: finalText,
            displayBody: parsed.body || finalText,
            streamingQuestions: parsed.questions,
            tokensUsed: data.tokens_used ?? 0,
            model: data.model ?? null,
            error: null,
          });
          break;
        }

        case 'studio.generation.error': {
          if (data.stream_id !== activeStreamRef.current) return;
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: data.error ?? 'Generation failed',
          }));
          break;
        }

        case 'studio.generation.cancelled': {
          if (data.stream_id !== activeStreamRef.current) return;
          setState((prev) => ({ ...prev, status: 'cancelled' }));
          break;
        }
      }
    };

    const unsub = client.on('studio.generation.*', handle);
    return unsub;
  }, [client, projectId, phase, debugEnabled]);

  function reset() {
    activeStreamRef.current = null;
    debugRef.current = [];
    setState(INITIAL);
  }

  function debug(): StudioStreamDebugInfo {
    return {
      enabled: debugEnabled,
      events: [...debugRef.current],
      activeStreamId: activeStreamRef.current,
    };
  }

  return { state, reset, debug };
}

// ─── Incremental sentinel parser ────────────────────────────────────
//
// Runs on every token batch. Cheap regex/indexOf — no external deps.
// Returns:
//   body      — the doc body if DOC_BODY_END seen, otherwise everything
//               outside the questions block (or all of `text` if no
//               sentinels at all).
//   questions — the parsed PendingQuestion[] if QUESTIONS_END seen and
//               the JSON parses, otherwise `null`.

function parseIncrementalSentinels(text: string): {
  body: string;
  questions: StudioPendingQuestion[] | null;
} {
  // 1. Doc body extraction
  let body: string;
  const bodyStart = text.indexOf(DOC_BODY_START);
  const bodyEnd = text.indexOf(DOC_BODY_END);
  if (bodyStart >= 0 && bodyEnd > bodyStart) {
    body = text.slice(bodyStart + DOC_BODY_START.length, bodyEnd).trim();
  } else if (bodyStart >= 0) {
    // Started writing the body but not finished — show what we have
    // so the user sees real-time progress
    body = text.slice(bodyStart + DOC_BODY_START.length).trim();
  } else {
    // No DOC_BODY sentinels at all yet — strip the questions block if
    // it's somehow already there (rare ordering)
    const qStart = text.indexOf(QUESTIONS_START);
    body = qStart >= 0 ? text.slice(0, qStart).trim() : text;
  }

  // 2. Questions extraction
  let questions: StudioPendingQuestion[] | null = null;
  const qStart = text.indexOf(QUESTIONS_START);
  const qEnd = text.indexOf(QUESTIONS_END);
  if (qStart >= 0 && qEnd > qStart) {
    const jsonRaw = text
      .slice(qStart + QUESTIONS_START.length, qEnd)
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      const parsed: unknown = JSON.parse(jsonRaw);
      if (parsed && typeof parsed === 'object') {
        const arr = (parsed as { questions?: unknown }).questions;
        if (Array.isArray(arr)) {
          questions = arr.filter((q) => q && typeof q === 'object') as StudioPendingQuestion[];
        }
      }
    } catch {
      // Mid-stream JSON probably has trailing junk — wait for next batch
    }
  }

  return { body, questions };
}
