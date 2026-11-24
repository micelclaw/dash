export interface UsageTurnReference {
  session_key: string;
  session_id: string;
  session_family_key?: string;
  run_id: string;
  message_id: string;
}

type TokenMeasurement =
  | { value: number; method: 'reported' }
  | { value: number; method: 'estimated'; estimator: string }
  | { value: null; method: 'unavailable' };

type CostMeasurement =
  | { value: string; currency: string; method: 'known-zero' | 'reported' | 'estimated' }
  | { value: null; currency: null; method: 'unknown' };

export interface ConversationTurnUsage {
  version: 2;
  turn: UsageTurnReference;
  coverage: 'complete' | 'partial' | 'unavailable';
  inferences: {
    inference_id: string;
    producer_origin: 'openclaw' | 'core';
    source_role: 'canonical' | 'mirror';
    operation: 'generation' | 'embedding' | 'extraction' | 'other';
    observation: 'pending' | 'completed' | 'unavailable';
    tokens: Record<'total_tokens' | 'input' | 'output' | 'cache_read' | 'cache_write', TokenMeasurement>;
    cost: CostMeasurement;
  }[];
}

// The API must authorize access and supply the row's concrete native turn.
// The transcript's local row ID, role and text are not native attribution.
export function usageForTurn(usage: ConversationTurnUsage, expected: UsageTurnReference) {
  const { turn } = usage;
  if (usage.version !== 2 || turn.session_key !== expected.session_key ||
    turn.session_id !== expected.session_id || turn.run_id !== expected.run_id ||
    turn.message_id !== expected.message_id || turn.session_family_key !== expected.session_family_key) return undefined;

  return {
    coverage: usage.coverage,
    inferences: usage.inferences.filter(item => item.source_role === 'canonical'),
  };
}
