import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformKeysDeep } from '../../micelclaw-os/core/src/plugins/case-transform';
import {
  collectTurnInferenceUsage, reportedTokenMeasurements, type InferenceObservation,
} from '../../micelclaw-os/core/src/services/inference-usage-contract';
import { ConversationMessage } from '../src/modules/agents/ConversationMessage';
import type { ConversationTurnUsage } from '../src/modules/agents/conversation-usage';
import type { AgentConversation } from '../src/modules/agents/types';

const turn = {
  sessionKey: 'agent:fixture:chat', sessionId: 'incarnation-one', sessionFamilyKey: 'family',
  runId: 'run-one', messageId: 'native-message-one',
};
const common = {
  userId: 'viewer', turn, sourceRole: 'canonical', model: 'fixture', locality: 'unknown',
  observation: 'completed', producerOrigin: 'openclaw', operation: 'generation',
} as const;
const zero: InferenceObservation = {
  ...common, inferenceId: 'zero', tokens: reportedTokenMeasurements({ totalTokens: 0 }),
  cost: { method: 'known-zero', value: '0', currency: 'USD' },
};
const estimated: InferenceObservation = {
  ...common, inferenceId: 'estimate', producerOrigin: 'core', operation: 'embedding',
  tokens: { ...reportedTokenMeasurements({}), totalTokens: { value: 12, method: 'estimated', estimator: 'fixture' } },
  cost: { value: null, currency: null, method: 'unknown' },
};
const unknown: InferenceObservation = {
  ...estimated, inferenceId: 'unknown', operation: 'extraction', tokens: reportedTokenMeasurements({ input: 5 }),
};
const message: AgentConversation = {
  id: 'row-local', session_id: 'legacy-key', from_agent: 'Francis', to_agent: 'user',
  message: 'Resultado sintético', tool_calls: [], model_used: null,
  cost_usd: null, tokens_used: null, created_at: '2026-11-24T00:00:00Z',
};
const dto = collectTurnInferenceUsage('viewer', turn, [
  zero, { ...zero, producerOrigin: 'core', sourceRole: 'mirror' },
  estimated, estimated, unknown, { ...zero, userId: 'other', inferenceId: 'foreign' },
  { ...zero, turn: { ...turn, runId: 'child' }, inferenceId: 'delegated' },
]);
const data = transformKeysDeep(dto) as ConversationTurnUsage;
const markup = (reference = data.turn) => renderToStaticMarkup(
  createElement(ConversationMessage, { message, agents: [], turnUsage: { data, reference } }),
);

test('C09 renders the authorized producer v2 DTO as one line per inference', () => {
  const html = markup();
  assert.match(html, /Uso del turno · Parcial/);
  assert.match(html, /OpenClaw · Generación · 0 tokens medidos · 0 USD/);
  assert.match(html, /Core · Embeddings · 12 tokens estimados · Coste desconocido/);
  assert.match(html, /Core · Extracción · Tokens desconocidos · Coste desconocido/);
  assert.match(html, /Entrada · 5 tokens medidos \/ Salida · Tokens desconocidos/);
  assert.equal(html.match(/<li>/g)?.length, 3);
  assert(!html.includes('foreign') && !html.includes('delegated'));
});

test('C09 will not attach usage from another incarnation, run, message or family', () => {
  for (const field of ['session_id', 'session_key', 'run_id', 'message_id', 'session_family_key'] as const) {
    const html = markup({ ...data.turn, [field]: 'other' });
    assert(!html.includes('Uso del turno'));
    assert.match(html, /— tok/);
  }
});
