import type { ToolCallRecord } from '@/types/chat';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Extract opaque handles only. All form labels, targets and authority are re-read from Core. */
export function configurationOperationHandles(tools: readonly ToolCallRecord[]): string[] {
  const ids = new Set<string>();
  for (const tool of tools) {
    if (!/(?:^|__)configuration_(?:prepare|request_credential|result)$/.test(tool.tool) && !/(?:^|__)claw_configuration$/.test(tool.tool)) continue;
    let nodes = 0;
    const visit = (value: unknown, depth: number): void => {
      if (depth > 7 || ++nodes > 1500 || ids.size >= 20) return;
      if (typeof value === 'string') {
        if (value.length > 262144) return;
        const trimmed = value.trim(); if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return;
        try { visit(JSON.parse(trimmed), depth + 1); } catch { /* Not structured tool output. */ }
        return;
      }
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(v => visit(v, depth + 1)); return; }
      const row = value as Record<string, unknown>;
      if (row.kind === 'configuration_change_v1' && typeof row.change_id === 'string' && uuid.test(row.change_id)
        && (typeof row.credential_request_id === 'string' || row.human_action_required === true)) ids.add(row.change_id);
      for (const nested of Object.values(row)) visit(nested, depth + 1);
    };
    visit(tool.output, 0); visit(tool.presentation?.technical.output, 0);
  }
  return [...ids];
}
