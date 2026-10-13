import type { ToolCallRecord, ToolRunState } from '@/types/chat';

function object(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** One decoder for REST, ledger, stream.done and reconnect. Never promote raw I/O to a snapshot. */
export function normalizeToolCallRecord(value: unknown): ToolCallRecord | undefined {
  if (!object(value) || typeof value.id !== 'string' || typeof value.tool !== 'string') return undefined;
  const status = value.status === 'completed' || value.status === 'complete' ? 'success' : value.status === 'failed' ? 'error' : value.status;
  const presentation = object(value.presentation) && value.presentation.version === 1 && object(value.presentation.technical)
    && object(value.presentation.technical.metadata) && typeof value.presentation.summary === 'string'
    && typeof value.presentation.title === 'string' && (value.presentation.action_label === undefined || typeof value.presentation.action_label === 'string')
    && typeof value.presentation.tool_name === 'string' && typeof value.presentation.domain === 'string'
    && typeof value.presentation.result_kind === 'string' && typeof value.presentation.technical.truncated === 'boolean'
    && ['normal', 'technical_only'].includes(String(value.presentation.visibility))
    && ['pending','running','approval','success','empty','error'].includes(String(value.presentation.state))
    && [0,1,2,3].includes(Number(value.presentation.approval_level))
    && Array.isArray(value.presentation.facts) && value.presentation.facts.every(f => object(f) && typeof f.label === 'string' && ['string','number','boolean'].includes(typeof f.value))
    && Array.isArray(value.presentation.items) && value.presentation.items.every(i => object(i) && typeof i.title === 'string')
    && (value.presentation.module_link === undefined || typeof value.presentation.module_link === 'string')
    ? value.presentation as unknown as ToolCallRecord['presentation'] : undefined;
  return {
    id: value.id, tool: value.tool,
    status: typeof status === 'string' && ['pending', 'running', 'approval', 'success', 'empty', 'error'].includes(status) ? status as ToolRunState : undefined,
    summary: typeof value.summary === 'string' ? value.summary : undefined,
    input: typeof value.input === 'string' || object(value.input) ? value.input : undefined,
    output: typeof value.output === 'string' ? value.output : undefined,
    output_present: typeof value.output_present === 'boolean' ? value.output_present : undefined,
    metadata: object(value.metadata) ? value.metadata : undefined,
    text_offset: typeof value.text_offset === 'number' ? value.text_offset : undefined,
    sequence_index: typeof value.sequence_index === 'number' ? value.sequence_index : undefined,
    run_id: typeof value.run_id === 'string' ? value.run_id : undefined,
    started_at: typeof value.started_at === 'string' ? value.started_at : undefined,
    completed_at: typeof value.completed_at === 'string' ? value.completed_at : undefined,
    duration_ms: typeof value.duration_ms === 'number' ? value.duration_ms : undefined,
    presentation, presentation_version: typeof value.presentation_version === 'number' ? value.presentation_version : undefined,
    entity_refs: Array.isArray(value.entity_refs) ? value.entity_refs.filter(object)
      .filter(r => typeof r.id === 'string' && typeof r.type === 'string')
      .map(r => ({ id: r.id as string, type: r.type as string, title: typeof r.title === 'string' ? r.title : null })) : undefined,
  };
}

export function normalizeToolCallRecords(value: unknown): ToolCallRecord[] {
  return Array.isArray(value) ? value.map(normalizeToolCallRecord).filter((v): v is ToolCallRecord => !!v) : [];
}

/** Merge committed snapshots of the same durable row. A replay with absent
 * I/O cannot erase evidence already delivered by the backend. */
export function mergeLedgerToolRecord(previous: ToolCallRecord, incoming: ToolCallRecord): ToolCallRecord {
  if (previous.id !== incoming.id || previous.tool !== incoming.tool
    || previous.run_id && incoming.run_id && previous.run_id !== incoming.run_id) return previous;
  const previousResult = previous.output_present === true || previous.presentation?.technical.output_present === true;
  const incomingResult = incoming.output_present === true || incoming.presentation?.technical.output_present === true;
  const preserveResult = previousResult && !incomingResult;
  // Operation/title/summary may depend on input (Workshop list vs create).
  // Keeping only technical.input would still regress those derived labels.
  const preserveInputSnapshot = previous.input !== undefined && incoming.input === undefined
    && !incomingResult && previous.status === incoming.status
    && incoming.presentation?.technical.error === undefined && incoming.metadata?.error_available !== true
    && (previous.metadata?.terminal_reason ?? previous.presentation?.technical.metadata.terminal_reason)
      === (incoming.metadata?.terminal_reason ?? incoming.presentation?.technical.metadata.terminal_reason)
    && (previous.metadata?.attempt_phase ?? previous.presentation?.technical.metadata.attempt_phase)
      === (incoming.metadata?.attempt_phase ?? incoming.presentation?.technical.metadata.attempt_phase);
  const previousTerminal = ['success', 'empty', 'error'].includes(previous.status ?? '');
  const incomingProvisional = ['pending', 'running', 'approval'].includes(incoming.status ?? '');
  const preserveState = preserveResult || preserveInputSnapshot || previousTerminal && incomingProvisional;
  const selected = preserveState ? previous.presentation ?? incoming.presentation : incoming.presentation ?? previous.presentation;
  const input = previous.input ?? incoming.input;
  const technicalInput = previous.presentation?.technical.input ?? incoming.presentation?.technical.input;
  const presentation = selected ? { ...selected, technical: { ...selected.technical,
    input: technicalInput ?? selected.technical.input } } : undefined;
  return { ...previous, ...incoming,
    status: preserveState ? previous.status : incoming.status ?? previous.status,
    input, output: preserveResult ? previous.output : incoming.output ?? previous.output,
    output_present: previousResult || incomingResult ? true : incoming.output_present ?? previous.output_present,
    metadata: preserveResult ? { ...incoming.metadata, ...previous.metadata } : { ...previous.metadata, ...incoming.metadata },
    summary: preserveState ? previous.summary ?? incoming.summary : incoming.summary ?? previous.summary,
    text_offset: previous.text_offset ?? incoming.text_offset, sequence_index: previous.sequence_index ?? incoming.sequence_index,
    run_id: previous.run_id ?? incoming.run_id, entity_refs: incoming.entity_refs ?? previous.entity_refs,
    presentation, presentation_version: presentation?.version ?? incoming.presentation_version ?? previous.presentation_version,
    started_at: previous.started_at ?? incoming.started_at, completed_at: incoming.completed_at ?? previous.completed_at,
    duration_ms: preserveInputSnapshot ? previous.duration_ms ?? incoming.duration_ms : incoming.duration_ms ?? previous.duration_ms,
  };
}
