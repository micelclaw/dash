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

// ─── useOpencodeStream — Studio v2 BuildPhase chat state ────────────
//
// Subscribes to `studio.opencode.*` WS events for one project, builds
// up a chat-shaped `messages[]` from token + tool_use + tool_result
// events, tracks the current tool, recent file edits, totals, and a
// 2-min watchdog. Hydrates from /build/messages on mount + backfills
// recent events on (re)connect via /build/recent-events.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useStudioStore,
  type StudioBuildMessageRow,
  type StudioBuildRecentEvent,
  type StudioChecklistItem,
  type StudioOpencodeMode,
} from '@/stores/studio.store';
import { toast } from 'sonner';
import { useWebSocketStore } from '@/stores/websocket.store';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export type ToolStatus = 'pending' | 'running' | 'completed' | 'error';

export interface ChatToolPart {
  type: 'tool';
  callId: string;
  tool: string;
  status: ToolStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt: number;
  completedAt?: number;
  ms?: number;
}

export interface ChatTextPart {
  type: 'text';
  text: string;
}

export type ChatPart = ChatTextPart | ChatToolPart;

export interface ChatMessage {
  /** Stable id. For live messages the OpenCode message id; for the
   *  "in-progress" pseudo-bubble before message_complete fires we use
   *  a synthetic id keyed by streamId. */
  id: string;
  role: ChatRole;
  parts: ChatPart[];
  tokensInput?: number;
  tokensOutput?: number;
  createdAt: number;
  /** True while we're still receiving deltas for this message. */
  streaming?: boolean;
}

export interface FileEdit {
  path: string;
  ts: number;
}

export type StreamStatus = 'idle' | 'running' | 'aborted' | 'failed' | 'loading';

export interface OpencodeStreamState {
  status: StreamStatus;
  messages: ChatMessage[];
  /** Most recent file edits, deduped by path with the latest ts. */
  recentEdits: FileEdit[];
  /** Last 50 completed tool calls in order, for the activity feed. */
  toolHistory: ChatToolPart[];
  /** Tool currently running, if any. */
  activeTool: ChatToolPart | null;
  /** Human-readable verb for the active state ("editing api/items.route.mjs…"). */
  activitySummary: string | null;
  error: string | null;
  /** Watchdog: ms since last event arrived; null when not running. */
  silentForMs: number | null;
  /** Cumulative input+output tokens across all messages we know about. */
  tokensUsed: number;
  /** Count of completed assistant turns. */
  turnsUsed: number;
  /**
   * True once the initial `refreshMessages()` has settled (success or
   * error). Consumers waiting to decide "is there an active session?"
   * should check this AND `messages.length === 0 && status !== 'running'`
   * — without it, an empty-during-fetch state looks identical to a
   * truly empty session.
   */
  hydrated: boolean;
  /** Build checklist items, kept in sync with the backend via the
   *  initial fetch + `studio.opencode.checklist_updated` WS events. */
  checklist: StudioChecklistItem[];
  /** OC session mode: 'plan' while the agent is drafting the plan +
   *  checklist, 'build' after the user approves. `null` when there is
   *  no active build session. Hydrated via `/build/state` on mount and
   *  flipped live by `studio.opencode.mode_changed` WS events. */
  mode: StudioOpencodeMode | null;
}

interface OpencodeStreamApi extends OpencodeStreamState {
  refreshFiles: () => void;
  refreshMessages: () => Promise<void>;
  refreshChecklist: () => Promise<void>;
  /** Push an optimistic user-role bubble. Used by BuildChat.send() so
   *  the user sees their message instantly, before the WS roundtrip.
   *  The optim message gets a synthetic id (`optim-…`); when the real
   *  `studio.opencode.user_message_added` event arrives with matching
   *  text, the optim is rebranded with the canonical OC message id. */
  pushUserMessage: (text: string) => string;
}

const RECENT_EDITS_MAX = 50;
const TOOL_HISTORY_MAX = 50;
const SILENT_THRESHOLD_MS = 120_000;

interface WsEnvelope {
  event: string;
  data?: Record<string, unknown>;
}

export function useOpencodeStream(
  projectId: string | null | undefined,
  initialStatus: StreamStatus = 'idle',
): OpencodeStreamApi {
  const client = useWebSocketStore((s) => s.client);
  const fetchBuildMessages = useStudioStore((s) => s.fetchBuildMessages);
  const fetchBuildRecentEvents = useStudioStore((s) => s.fetchBuildRecentEvents);
  const fetchBuildChecklist = useStudioStore((s) => s.fetchBuildChecklist);
  const fetchBuildState = useStudioStore((s) => s.fetchBuildState);

  const [status, setStatus] = useState<StreamStatus>(initialStatus);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentEdits, setRecentEdits] = useState<FileEdit[]>([]);
  const [toolHistory, setToolHistory] = useState<ChatToolPart[]>([]);
  const [activeTool, setActiveTool] = useState<ChatToolPart | null>(null);
  const [activitySummary, setActivitySummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [silentForMs, setSilentForMs] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [checklist, setChecklist] = useState<StudioChecklistItem[]>([]);
  const [mode, setMode] = useState<StudioOpencodeMode | null>(null);

  // Refs we mutate from the WS callback without re-rendering on every
  // token. The state setters above only fire when we want a paint.
  const lastSeqRef = useRef<number>(0);
  const lastEventTsRef = useRef<number>(Date.now());
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  // Track ids that have ever transitioned to `done`, so the hitos
  // banner ('🎉 first test/endpoint/...') fires exactly once per
  // newly-completed item AND respects refresh hydration (already-done
  // items at mount are seeded into the set so we don't re-toast on
  // every page load).
  const seenDoneRef = useRef<Set<string>>(new Set());

  // ─── hydrate from DB on project change ──────────────────────────
  const refreshMessages = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    try {
      const rows = await fetchBuildMessages(projectId);
      const hydratedMessages = rowsToChatMessages(rows);
      setMessages(hydratedMessages);
      // Seed toolHistory from persisted tool parts so the Activity
      // feed isn't stuck on "(waiting for first action…)" after a
      // page refresh / fresh mount. Without this, toolHistory only
      // grows from LIVE tool_result WS events; hydrated tools show
      // up in the chat (via parts) but never in the feed.
      const seededTools: ChatToolPart[] = [];
      for (const m of hydratedMessages) {
        for (const p of m.parts) {
          if (p.type !== 'tool') continue;
          const tp = p as ChatToolPart;
          if (tp.status === 'completed' || tp.status === 'error') seededTools.push(tp);
        }
      }
      if (seededTools.length > 0) {
        // Keep insertion order (hydratedMessages are oldest→newest).
        // Slice to TOOL_HISTORY_MAX so we never exceed the cap.
        setToolHistory(seededTools.slice(-TOOL_HISTORY_MAX));
      }
    } catch (err) {
      // 404/410 are normal for non-v2 projects; surface other errors.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/410|NOT_V2|PROJECT_NOT_FOUND/i.test(msg)) setError(msg);
    } finally {
      setHydrated(true);
    }
  }, [projectId, fetchBuildMessages]);

  // Checklist refresh — reads the project's persisted build checklist
  // and seeds the `seenDoneRef` so already-done items don't re-fire
  // the hitos banner on every refresh.
  const refreshChecklist = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    try {
      const items = await fetchBuildChecklist(projectId);
      setChecklist(items);
      const seen = new Set<string>();
      for (const it of items) if (it.status === 'done') seen.add(it.id);
      seenDoneRef.current = seen;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/410|NOT_V2|PROJECT_NOT_FOUND/i.test(msg)) {
        // checklist is optional — never block on its load
        // eslint-disable-next-line no-console
        console.warn('[studio] checklist refresh failed:', msg);
      }
    }
  }, [projectId, fetchBuildChecklist]);

  // Build state hydration — single fetch on project change so the mode
  // badge and plan-approval banner can render before any WS event lands.
  const refreshState = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    try {
      const s = await fetchBuildState(projectId);
      setMode(s.mode);
    } catch {
      // /build/state isn't critical — silent failure leaves mode=null
      // and the UI degrades to "no badge / no banner".
    }
  }, [projectId, fetchBuildState]);

  useEffect(() => {
    if (!projectId) return;
    setMessages([]);
    setRecentEdits([]);
    setToolHistory([]);
    setActiveTool(null);
    setActivitySummary(null);
    setError(null);
    setHydrated(false);
    setChecklist([]);
    setMode(null);
    seenDoneRef.current = new Set();
    void refreshMessages();
    void refreshChecklist();
    void refreshState();
  }, [projectId, refreshMessages, refreshChecklist, refreshState]);

  // ─── backfill recent events on (re)connect ─────────────────────
  useEffect(() => {
    if (!projectId || !client) return;
    let cancelled = false;
    void (async () => {
      try {
        const since = lastSeqRef.current;
        const result = await fetchBuildRecentEvents(projectId, since);
        if (cancelled) return;
        if (result.truncated && since !== 0) {
          // We lost the gap — re-hydrate from DB to be safe.
          await refreshMessages();
        }
        for (const e of result.events) applyEvent(e);
        lastSeqRef.current = Math.max(lastSeqRef.current, result.current_seq);
      } catch {
        // Bridge may not be up yet (boot race). Live events will
        // catch us up once they start flowing.
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, client, fetchBuildRecentEvents]);

  // ─── live WS subscription ──────────────────────────────────────
  useEffect(() => {
    if (!projectId || !client) return;
    const handle = (raw: WsEnvelope) => {
      const data = raw.data ?? {};
      if (data.project_id !== projectId) return;
      lastEventTsRef.current = Date.now();
      setSilentForMs(null);
      const seq = typeof data.seq === 'number' ? data.seq : null;
      if (seq !== null && seq > lastSeqRef.current) lastSeqRef.current = seq;
      applyEvent({
        seq: seq ?? lastSeqRef.current,
        event: raw.event,
        data,
        ts: typeof data.ts === 'number' ? data.ts : Date.now(),
      });
    };
    const unsub = client.on('studio.opencode.*', handle);
    return () => { unsub(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, client]);

  // ─── watchdog: tick once a second while running ────────────────
  useEffect(() => {
    if (status !== 'running') {
      setSilentForMs(null);
      return;
    }
    const id = setInterval(() => {
      const elapsed = Date.now() - lastEventTsRef.current;
      setSilentForMs(elapsed >= SILENT_THRESHOLD_MS ? elapsed : null);
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // ─── event reducer (closure-stable; mutates state via setters) ──
  function applyEvent(ev: StudioBuildRecentEvent): void {
    switch (ev.event) {
      case 'studio.opencode.token':
        appendTokenDelta(ev.data);
        break;
      case 'studio.opencode.tool_use':
        applyToolUse(ev.data);
        setStatus((prev) => (prev === 'aborted' || prev === 'failed' ? prev : 'running'));
        break;
      case 'studio.opencode.tool_result':
        applyToolResult(ev.data);
        break;
      case 'studio.opencode.message_updated':
        applyMessageUpdated(ev.data);
        break;
      case 'studio.opencode.message_complete':
        applyMessageComplete(ev.data);
        break;
      case 'studio.opencode.file_edit':
        applyFileEdit(ev.data);
        break;
      case 'studio.opencode.idle':
        setActiveTool(null);
        setActivitySummary(null);
        setStatus((prev) => (prev === 'aborted' || prev === 'failed' ? prev : 'idle'));
        break;
      case 'studio.opencode.aborted':
        setStatus('aborted');
        setActiveTool(null);
        setActivitySummary(null);
        break;
      case 'studio.opencode.error': {
        const err = (ev.data.error as { message?: string } | string | undefined);
        const msg = typeof err === 'string' ? err : err?.message ?? 'Unknown error';
        setError(msg);
        setStatus('failed');
        setActiveTool(null);
        setActivitySummary(null);
        break;
      }
      case 'studio.opencode.checklist_updated':
        applyChecklistUpdated(ev.data);
        break;
      case 'studio.opencode.mode_changed': {
        const m = ev.data.mode;
        if (m === 'plan' || m === 'build') setMode(m);
        break;
      }
      case 'studio.opencode.user_message_added':
        applyUserMessageAdded(ev.data);
        break;
    }
  }

  function applyUserMessageAdded(d: Record<string, unknown>): void {
    const messageId = String(d.message_id ?? '');
    if (!messageId) return;
    const partsRaw = Array.isArray(d.parts) ? (d.parts as unknown[]) : [];
    const parts = convertOcParts(partsRaw);
    const text = parts
      .filter((p): p is ChatTextPart => p.type === 'text')
      .map((p) => p.text)
      .join('\n')
      .trim();
    setMessages((prev) => {
      // Already in the array by real id? Skip (duplicate event).
      if (prev.some((m) => m.id === messageId)) return prev;
      // Look for a recent optim user bubble with matching text to
      // rebrand. 5s window — if the user fired the same message twice
      // we only rebrand the most recent optim, the older stays.
      const cutoff = Date.now() - 5_000;
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        const m = next[i];
        if (!m || m.role !== 'user') continue;
        if (!m.id.startsWith('optim-')) continue;
        if (m.createdAt < cutoff) break;
        const mText = m.parts
          .filter((p): p is ChatTextPart => p.type === 'text')
          .map((p) => p.text)
          .join('\n')
          .trim();
        if (mText === text) {
          next[i] = { ...m, id: messageId };
          return next;
        }
      }
      // No optim to rebrand — push fresh.
      next.push({
        id: messageId,
        role: 'user',
        parts,
        createdAt: Date.now(),
      });
      return next;
    });
  }

  function applyChecklistUpdated(data: Record<string, unknown>): void {
    const items = (data.items as StudioChecklistItem[] | undefined) ?? [];
    setChecklist(items);
    // Hitos: if an item just transitioned to `done` AND we haven't
    // toasted it yet, fire a single toast describing it. Conservative
    // matching: only fire on the FIRST item of each broad category
    // (tests, endpoints, UI, DB).
    for (const it of items) {
      if (it.status !== 'done') continue;
      if (seenDoneRef.current.has(it.id)) continue;
      seenDoneRef.current.add(it.id);
      const text = (it.text ?? '').toLowerCase();
      if (/test/.test(text)) {
        toast.success(`🎉 First test passing — ${truncate(it.text, 60)}`);
      } else if (/(endpoint|route|\b(get|post|put|patch|delete)\b)/.test(text)) {
        toast.success(`✓ Endpoint listo — ${truncate(it.text, 60)}`);
      } else if (/(table|schema|migration|database|\bdb\b)/.test(text)) {
        toast.success(`✓ Schema listo — ${truncate(it.text, 60)}`);
      } else {
        toast.success(`✓ ${truncate(it.text, 80)}`);
      }
    }
  }

  function appendTokenDelta(d: Record<string, unknown>): void {
    const delta = (d.delta as string | undefined) ?? (d.text as string | undefined) ?? '';
    if (!delta) return;
    setStatus((prev) => (prev === 'aborted' || prev === 'failed' ? prev : 'running'));
    setActivitySummary('thinking…');
    setMessages((prev) => {
      const next = [...prev];
      // Append to the last assistant message that's streaming, or
      // push a fresh streaming bubble.
      const last = next.length > 0 ? next[next.length - 1] : undefined;
      if (last && last.role === 'assistant' && last.streaming) {
        const lastTextIdx = lastIdx(last.parts, (p) => p.type === 'text');
        const newParts = [...last.parts];
        if (lastTextIdx === -1) {
          newParts.push({ type: 'text', text: delta });
        } else {
          const tp = newParts[lastTextIdx] as ChatTextPart;
          newParts[lastTextIdx] = { type: 'text', text: tp.text + delta };
        }
        next[next.length - 1] = { ...last, parts: newParts };
      } else {
        next.push({
          id: `live-${Date.now()}`,
          role: 'assistant',
          parts: [{ type: 'text', text: delta }],
          createdAt: Date.now(),
          streaming: true,
        });
      }
      return next;
    });
  }

  function applyToolUse(d: Record<string, unknown>): void {
    const callId = String(d.call_id ?? d.callId ?? '');
    const tool = String(d.tool ?? '');
    if (!callId || !tool) return;
    const state = (d.state as { status?: string; input?: unknown }) ?? {};
    const status = (state.status === 'running' ? 'running' : 'pending') as ToolStatus;
    const part: ChatToolPart = {
      type: 'tool',
      callId,
      tool,
      status,
      input: state.input,
      startedAt: Date.now(),
    };
    setActiveTool(part);
    setActivitySummary(verbForTool(tool, state.input));
    setMessages((prev) => {
      const next = [...prev];
      const last = next.length > 0 ? next[next.length - 1] : undefined;
      if (!last || last.role !== 'assistant' || !last.streaming) {
        next.push({
          id: `live-${Date.now()}`,
          role: 'assistant',
          parts: [part],
          createdAt: Date.now(),
          streaming: true,
        });
        return next;
      }
      // Update or add the tool part keyed by callId.
      const existingIdx = lastIdx(last.parts, (p) => p.type === 'tool' && (p as ChatToolPart).callId === callId);
      const newParts = [...last.parts];
      if (existingIdx === -1) newParts.push(part);
      else newParts[existingIdx] = { ...(newParts[existingIdx] as ChatToolPart), ...part };
      next[next.length - 1] = { ...last, parts: newParts };
      return next;
    });
  }

  function applyToolResult(d: Record<string, unknown>): void {
    const callId = String(d.call_id ?? d.callId ?? '');
    const tool = String(d.tool ?? '');
    if (!callId) return;
    const state = (d.state as { status?: string; output?: unknown; error?: string; input?: unknown }) ?? {};
    const status = (state.status === 'error' ? 'error' : 'completed') as ToolStatus;
    let finalised: ChatToolPart | null = null;
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        const m = next[i];
        if (!m || m.role !== 'assistant') continue;
        const idx = lastIdx(m.parts, (p) => p.type === 'tool' && (p as ChatToolPart).callId === callId);
        if (idx === -1) continue;
        const prevPart = m.parts[idx] as ChatToolPart;
        const completedAt = Date.now();
        finalised = {
          ...prevPart,
          status,
          output: state.output ?? prevPart.output,
          error: state.error ?? prevPart.error,
          input: prevPart.input ?? state.input,
          completedAt,
          ms: completedAt - prevPart.startedAt,
        };
        const newParts = [...m.parts];
        newParts[idx] = finalised;
        next[i] = { ...m, parts: newParts };
        break;
      }
      return next;
    });
    if (finalised) {
      const f = finalised as ChatToolPart;
      setToolHistory((prev) => [...prev.slice(-(TOOL_HISTORY_MAX - 1)), f]);
    }
    setActiveTool((prev) => (prev?.callId === callId ? null : prev));
    setActivitySummary(null);
    if (state.status === 'error' && tool) setError(state.error ?? `Tool ${tool} failed`);
  }

  function applyMessageUpdated(d: Record<string, unknown>): void {
    // Capture tokens from `info.tokens` when present so the header
    // stat strip stays current. We don't reconcile the streaming
    // bubble's text against info — token deltas already feed it.
    const info = d.message as
      | { id?: string; tokens?: { input?: number; output?: number } }
      | undefined;
    if (!info?.id || !info.tokens) return;
    const inp = info.tokens.input ?? 0;
    const out = info.tokens.output ?? 0;
    setMessages((prev) => {
      const next = prev.slice();
      const idx = next.findIndex((m) => m.id === info.id);
      if (idx === -1) {
        // Streaming bubble may still have its synthetic id — try to
        // match by streaming flag and rebrand with the real id.
        for (let i = next.length - 1; i >= 0; i -= 1) {
          const m = next[i];
          if (m && m.streaming && m.role === 'assistant') {
            next[i] = { ...m, id: info.id ?? m.id, tokensInput: inp, tokensOutput: out };
            return next;
          }
        }
        return next;
      }
      const target = next[idx];
      if (!target) return next;
      next[idx] = { ...target, tokensInput: inp, tokensOutput: out };
      return next;
    });
  }

  function applyMessageComplete(d: Record<string, unknown>): void {
    const messageId = String(d.message_id ?? '');
    setMessages((prev) => {
      const next = [...prev];
      // Mark the last streaming bubble as final and rebrand its id.
      for (let i = next.length - 1; i >= 0; i -= 1) {
        const m = next[i];
        if (!m || !m.streaming) continue;
        next[i] = { ...m, streaming: false, id: messageId || m.id };
        break;
      }
      return next;
    });
    setActiveTool(null);
    setActivitySummary(null);
  }

  function applyFileEdit(d: Record<string, unknown>): void {
    const file = String(d.file ?? '');
    if (!file) return;
    setRecentEdits((prev) => {
      // Dedupe by path; latest ts wins; keep last RECENT_EDITS_MAX.
      const filtered = prev.filter((e) => e.path !== file);
      return [...filtered, { path: file, ts: Date.now() }].slice(-RECENT_EDITS_MAX);
    });
  }

  // ─── exposed API ───────────────────────────────────────────────
  const refreshFiles = useCallback(() => {
    // Bumps recentEdits with a synthetic ts so consumers re-key tree.
    setRecentEdits((prev) => [...prev]);
  }, []);

  const pushUserMessage = useCallback((text: string): string => {
    const id = `optim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: 'user',
        parts: [{ type: 'text', text }],
        createdAt: Date.now(),
      },
    ]);
    return id;
  }, []);

  // Counters derived from messages so consumers don't re-implement.
  const { tokensUsed, turnsUsed } = useMemo(() => {
    let tokens = 0;
    let turns = 0;
    for (const m of messages) {
      tokens += (m.tokensInput ?? 0) + (m.tokensOutput ?? 0);
      if (m.role === 'assistant' && !m.streaming) turns += 1;
    }
    return { tokensUsed: tokens, turnsUsed: turns };
  }, [messages]);

  return useMemo<OpencodeStreamApi>(() => ({
    status,
    messages,
    recentEdits,
    toolHistory,
    activeTool,
    activitySummary,
    error,
    silentForMs,
    tokensUsed,
    turnsUsed,
    hydrated,
    checklist,
    mode,
    refreshFiles,
    refreshMessages,
    refreshChecklist,
    pushUserMessage,
  }), [status, messages, recentEdits, toolHistory, activeTool, activitySummary, error, silentForMs, tokensUsed, turnsUsed, hydrated, checklist, mode, refreshFiles, refreshMessages, refreshChecklist, pushUserMessage]);
}

// ─── helpers ────────────────────────────────────────────────────────

function lastIdx<T>(arr: T[], pred: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const item = arr[i];
    if (item !== undefined && pred(item)) return i;
  }
  return -1;
}

function verbForTool(tool: string, input: unknown): string {
  // Best-effort summary for the "Builder is …" indicator.
  const i = (input ?? {}) as Record<string, unknown>;
  switch (tool) {
    case 'read': return `reading ${truncate(String(i.filePath ?? i.file ?? ''))}`;
    case 'write':
    case 'edit': return `editing ${truncate(String(i.filePath ?? i.file ?? ''))}`;
    case 'glob': return `searching for files`;
    case 'grep': return `searching contents`;
    case 'mount_project': return `mounting routes`;
    case 'run_migration': return `applying SQL migration`;
    case 'seed': return `seeding sandbox`;
    case 'truncate_tables': return `clearing tables`;
    case 'call_sandbox_api': return `calling ${String(i.method ?? 'GET')} ${truncate(String(i.path ?? ''))}`;
    case 'run_tests': return `running tests`;
    case 'read_doc': return `reading docs/${String(i.name ?? '')}`;
    case 'list_routes': return `listing mounted routes`;
    case 'mark_progress': return `marking progress`;
    default: return `running ${tool}`;
  }
}

function truncate(s: string, max = 32): string {
  if (s.length <= max) return s;
  return '…' + s.slice(-max + 1);
}

function rowsToChatMessages(rows: StudioBuildMessageRow[]): ChatMessage[] {
  return rows.map((r) => ({
    id: r.opencode_message_id,
    role: r.role as ChatRole,
    parts: Array.isArray(r.parts) ? convertOcParts(r.parts as unknown[]) : [],
    tokensInput: r.tokens_input ?? undefined,
    tokensOutput: r.tokens_output ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

/**
 * Convert OpenCode-shaped parts (as persisted in `studio_build_messages.parts`)
 * to the dash's `ChatPart` shape. The two diverge mainly on tool parts:
 *   OC:    { type:'tool', tool, callID, state:{ status, input, output, time:{start,end}, error } }
 *   Dash:  { type:'tool', tool, callId, status, input, output, startedAt, completedAt, ms, error }
 * Without this normalization, hydrated tool parts have no `status` field, so
 * `toolHistory` seeding skips them and the Activity feed stays empty after refresh.
 */
function convertOcParts(parts: unknown[]): ChatPart[] {
  const out: ChatPart[] = [];
  for (const raw of parts) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    if (p.type === 'text' && typeof p.text === 'string') {
      out.push({ type: 'text', text: p.text });
      continue;
    }
    if (p.type === 'tool') {
      const state = (p.state ?? {}) as { status?: string; input?: unknown; output?: unknown; error?: string; time?: { start?: number; end?: number } };
      const start = state.time?.start ?? 0;
      const end = state.time?.end;
      const status: ToolStatus =
        state.status === 'completed' ? 'completed'
        : state.status === 'error' ? 'error'
        : state.status === 'running' ? 'running'
        : 'pending';
      out.push({
        type: 'tool',
        callId: String(p.callID ?? p.callId ?? ''),
        tool: String(p.tool ?? ''),
        status,
        input: state.input,
        output: state.output,
        error: state.error,
        startedAt: start,
        completedAt: end,
        ms: end && start ? end - start : undefined,
      });
      continue;
    }
    // step-start, step-finish, reasoning, etc. — drop, the dash doesn't render them.
  }
  return out;
}
