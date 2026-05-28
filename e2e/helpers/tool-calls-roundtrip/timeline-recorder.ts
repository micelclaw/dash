/**
 * Records timestamped events during the tool-calls-roundtrip test.
 * Used by the report writer to emit a chronological table.
 */

export type EventSource =
  | 'user'           // user-driven action (submit, click)
  | 'dash'           // dash UI level (page navigation, sidebar)
  | 'DB'             // a row appeared in DB
  | 'JSONL'          // file-system discovery (not events themselves)
  | 'sidebar'        // sidebar update
  | 'system'         // test harness
  | 'OC:Francis'     // Francis's OpenClaw JSONL event (assistant turn, toolCall, toolResult)
  | 'OC:Sentinel'    // Sentinel's OpenClaw JSONL event
  | 'WS:dash'        // a WebSocket event received by the dash
  | 'DOM'            // a DOM mutation in the dash (new bubble, pill rendered)
  | 'Mirror'         // mirror service activity (pass started, rows inserted)
  | 'screenshot';    // a screenshot was just captured

export interface TimelineEvent {
  /** ms since recorder start. */
  delta: number;
  source: EventSource;
  description: string;
  /** Optional structured metadata: tool_id, screenshot index, role, etc. */
  meta?: Record<string, unknown>;
}

export class TimelineRecorder {
  private readonly startedAt: number;
  private readonly events: TimelineEvent[] = [];

  constructor() {
    this.startedAt = Date.now();
  }

  record(source: EventSource, description: string, meta?: Record<string, unknown>): void {
    this.events.push({
      delta: Date.now() - this.startedAt,
      source,
      description,
      meta,
    });
  }

  all(): readonly TimelineEvent[] {
    return this.events;
  }

  /** Max observed lag between two event sources, ms. */
  maxLag(from: EventSource, to: EventSource, matcher: (a: TimelineEvent, b: TimelineEvent) => boolean): number | null {
    let max: number | null = null;
    for (const a of this.events) {
      if (a.source !== from) continue;
      let best: number | null = null;
      for (const b of this.events) {
        if (b.source !== to) continue;
        if (b.delta < a.delta) continue;
        if (!matcher(a, b)) continue;
        const lag = b.delta - a.delta;
        if (best === null || lag < best) best = lag;
      }
      if (best !== null && (max === null || best > max)) max = best;
    }
    return max;
  }

  elapsed(): number {
    return Date.now() - this.startedAt;
  }
}
