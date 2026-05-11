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

// ─── Studio doc-phase generation streams — global store ─────────────
//
// `studio.generation.*` WebSocket events used to be handled inside
// the per-component `useStudioStream` hook. That meant unmounting a
// DocPhaseLayout (e.g. clicking a different pill in the pipeline)
// removed the WS handler — any token / done event arriving while the
// user was on another phase was silently dropped. When the user
// returned, the hook restarted at `idle` with an empty doc.
//
// This module owns the streaming state at the application level:
//   - One reducer keyed by `${projectId}:${phase}`.
//   - A single global subscription mounted once in `Shell.tsx` via
//     `useStudioGenerationStreamsSubscription()`.
//   - `useStudioGenerationStream(projectId, phase)` is a thin Zustand
//     selector that the existing `useStudioStream` hook re-exports.
//
// State shape and reducer behaviour are a 1:1 port of the original
// hook, so downstream components see no API change.

import { useEffect } from 'react';
import { create } from 'zustand';
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
  text: string;
  displayBody: string;
  reasoning: string;
  streamingQuestions: StudioPendingQuestion[] | null;
  tokensUsed: number;
  model: string | null;
  error: string | null;
}

export interface StudioStreamDebugEvent {
  ts: number;
  event: string;
  stream_id: string | null;
  text_len: number;
  data_keys: string[];
}

export interface StudioStreamDebugInfo {
  enabled: boolean;
  events: StudioStreamDebugEvent[];
  activeStreamId: string | null;
}

interface StudioStreamEventData {
  stream_id?: string;
  project_id?: string;
  phase?: string;
  token?: string;
  full_text?: string;
  full_reasoning?: string;
  model?: string;
  tokens_used?: number;
  error?: string;
  started_at?: string;
}

const INITIAL: StudioStreamState = {
  status: 'idle',
  streamId: null,
  text: '',
  displayBody: '',
  reasoning: '',
  streamingQuestions: null,
  tokensUsed: 0,
  model: null,
  error: null,
};

// Sentinel constants — must match `core/src/studio/llm/structured-output.ts`.
const DOC_BODY_START = '<!-- DOC_BODY_START -->';
const DOC_BODY_END = '<!-- DOC_BODY_END -->';
const QUESTIONS_START = '<!-- PENDING_QUESTIONS_START -->';
const QUESTIONS_END = '<!-- PENDING_QUESTIONS_END -->';

const DEBUG_BUFFER_LIMIT = 50;

function streamKey(projectId: string, phase: string): string {
  return `${projectId}:${phase}`;
}

function debugEnabled(): boolean {
  return typeof window !== 'undefined'
    && window.localStorage?.getItem?.('studioDebugStream') === '1';
}

interface StreamsStoreState {
  streams: Record<string, StudioStreamState>;
  /** Active stream id per (project, phase) — used to drop stale events. */
  activeStreamIds: Record<string, string | null>;
  /** Debug ring buffer per (project, phase). */
  debug: Record<string, StudioStreamDebugEvent[]>;

  applyEvent: (event: { event: string; data: StudioStreamEventData }) => void;
  resetStream: (projectId: string, phase: string) => void;
  getStream: (projectId: string, phase: string) => StudioStreamState;
  getDebug: (projectId: string, phase: string) => StudioStreamDebugInfo;
}

export const useStudioStreamsStore = create<StreamsStoreState>()((set, get) => ({
  streams: {},
  activeStreamIds: {},
  debug: {},

  applyEvent: (event) => {
    const data = event.data ?? {};
    const projectId = data.project_id;
    const phase = data.phase;
    if (!projectId || !phase) return;
    const key = streamKey(projectId, phase);

    if (debugEnabled()) {
      const buffer = get().debug[key] ?? [];
      const next = [...buffer, {
        ts: Date.now(),
        event: event.event,
        stream_id: data.stream_id ?? null,
        text_len: 0,
        data_keys: Object.keys(data),
      }];
      if (next.length > DEBUG_BUFFER_LIMIT) next.shift();
      set((s) => ({ debug: { ...s.debug, [key]: next } }));
    }

    const prev = get().streams[key] ?? INITIAL;
    let activeStream = get().activeStreamIds[key] ?? null;

    let next: StudioStreamState | null = null;

    switch (event.event) {
      case 'studio.generation.start': {
        activeStream = data.stream_id ?? null;
        next = {
          status: 'starting',
          streamId: activeStream,
          text: '',
          displayBody: '',
          reasoning: '',
          streamingQuestions: null,
          tokensUsed: 0,
          model: null,
          error: null,
        };
        break;
      }

      case 'studio.generation.token': {
        // HARDENING: adopt the first token's stream_id if we missed
        // the start event (event reorder, hot reload, store rehydration).
        if (activeStream === null && data.stream_id) {
          activeStream = data.stream_id;
        }
        if (data.stream_id !== activeStream) return;
        const t = data.token ?? '';
        const nextText = prev.text + t;
        const parsed = parseIncrementalSentinels(nextText);
        next = {
          ...prev,
          status: 'streaming',
          streamId: prev.streamId ?? data.stream_id ?? null,
          text: nextText,
          displayBody: parsed.body,
          streamingQuestions: parsed.questions ?? prev.streamingQuestions,
        };
        break;
      }

      case 'studio.generation.reasoning_token': {
        if (activeStream === null && data.stream_id) {
          activeStream = data.stream_id;
        }
        if (data.stream_id !== activeStream) return;
        const t = data.token ?? '';
        next = {
          ...prev,
          status: prev.status === 'idle' ? 'streaming' : prev.status,
          streamId: prev.streamId ?? data.stream_id ?? null,
          reasoning: prev.reasoning + t,
        };
        break;
      }

      case 'studio.generation.done': {
        // Reconciled `done` events synthesised by the backend recovery
        // path carry an artificial stream_id like `reconcile-<sid>`.
        // Adopt it unconditionally so the dash always processes them
        // even if no live stream was active in this tab.
        if (data.stream_id !== activeStream) {
          activeStream = data.stream_id ?? null;
        }
        const finalText = data.full_text ?? '';
        const parsed = parseIncrementalSentinels(finalText);
        next = {
          status: 'done',
          streamId: data.stream_id ?? null,
          text: finalText,
          displayBody: parsed.body || finalText,
          reasoning: data.full_reasoning ?? prev.reasoning,
          streamingQuestions: parsed.questions,
          tokensUsed: data.tokens_used ?? 0,
          model: data.model ?? null,
          error: null,
        };
        break;
      }

      case 'studio.generation.error': {
        if (data.stream_id !== activeStream) return;
        next = {
          ...prev,
          status: 'error',
          error: data.error ?? 'Generation failed',
        };
        break;
      }

      case 'studio.generation.cancelled': {
        if (data.stream_id !== activeStream) return;
        next = { ...prev, status: 'cancelled' };
        break;
      }

      default:
        return;
    }

    if (!next) return;
    set((s) => ({
      streams: { ...s.streams, [key]: next! },
      activeStreamIds: { ...s.activeStreamIds, [key]: activeStream },
    }));
  },

  resetStream: (projectId, phase) => {
    const key = streamKey(projectId, phase);
    set((s) => ({
      streams: { ...s.streams, [key]: INITIAL },
      activeStreamIds: { ...s.activeStreamIds, [key]: null },
      debug: { ...s.debug, [key]: [] },
    }));
  },

  getStream: (projectId, phase) => {
    return get().streams[streamKey(projectId, phase)] ?? INITIAL;
  },

  getDebug: (projectId, phase) => {
    const key = streamKey(projectId, phase);
    return {
      enabled: debugEnabled(),
      events: [...(get().debug[key] ?? [])],
      activeStreamId: get().activeStreamIds[key] ?? null,
    };
  },
}));

/**
 * Mount once at the top of the app (Shell). Subscribes to
 * `studio.generation.*` and pipes every event into the streams store.
 * Survives all phase / route changes downstream.
 */
export function useStudioGenerationStreamsSubscription(): void {
  const client = useWebSocketStore((s) => s.client);
  const applyEvent = useStudioStreamsStore((s) => s.applyEvent);

  useEffect(() => {
    if (!client) return;
    const unsub = client.on('studio.generation.*', (event: { event: string; data: StudioStreamEventData }) => {
      applyEvent(event);
    });
    return unsub;
  }, [client, applyEvent]);
}

/**
 * Reactive selector for the (project, phase) stream state.
 * Returns the same `StudioStreamState` the old useStudioStream hook
 * exposed, so consuming components don't change.
 */
export function useStudioGenerationStream(projectId: string, phase: string): StudioStreamState {
  return useStudioStreamsStore((s) => s.streams[streamKey(projectId, phase)] ?? INITIAL);
}

// ─── Incremental sentinel parser ────────────────────────────────────
//
// Identical behaviour to the previous `parseIncrementalSentinels` in
// useStudioStream.ts. Extract here because the store action needs it
// at module scope (no closure tricks).

export function parseIncrementalSentinels(text: string): {
  body: string;
  questions: StudioPendingQuestion[] | null;
} {
  let body: string;
  const bodyStart = text.indexOf(DOC_BODY_START);
  const bodyEnd = text.indexOf(DOC_BODY_END);
  if (bodyStart >= 0 && bodyEnd > bodyStart) {
    body = text.slice(bodyStart + DOC_BODY_START.length, bodyEnd).trim();
  } else if (bodyStart >= 0) {
    body = text.slice(bodyStart + DOC_BODY_START.length).trim();
  } else {
    const qStart = text.indexOf(QUESTIONS_START);
    body = qStart >= 0 ? text.slice(0, qStart).trim() : text;
  }

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
