import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductivityTransport } from './transport';
import { UnconfirmedWriteError } from './write-outcome';

test('a lost RPC write response is ambiguous and is never replayed by the transport', async () => {
 let calls = 0;
 const transport = createProductivityTransport(async () => { calls++; throw Error('Synthetic lost response'); });
 await assert.rejects(transport.call('notes', 'update', { id: 'synthetic-note' }), UnconfirmedWriteError);
 await assert.rejects(transport.call('notes', 'update', { id: 'synthetic-note', content: 'A changed draft must not replay the pending write' }), UnconfirmedWriteError);
 assert.equal(calls, 1);
});
test('an untyped MCP error cannot confirm a write; deferred results keep their no-replay state', async () => {
 const transport = createProductivityTransport(async () => ({ isError: true, structuredContent: { ui_version: 'productivity/v1', outcome: 'confirmed', data: {} } }));
 await assert.rejects(transport.call('notes', 'update', {}), UnconfirmedWriteError);
 const deferred = createProductivityTransport(async () => ({ isError: true, structuredContent: { ui_version: 'productivity/v1', outcome: 'approval_pending', data: null } }));
 await assert.rejects(deferred.call('notes', 'update', {}), UnconfirmedWriteError);
});
test('only an explicit committed outcome permits a write to finish', async () => {
 for (const outcome of [undefined, 'queued', 'provider_pending', 'approval_pending']) {
  const transport = createProductivityTransport(async () => ({ structuredContent: { ui_version: 'productivity/v1', outcome, data: {} } }));
  await assert.rejects(transport.call('emails', 'save_draft', {}), UnconfirmedWriteError);
 }
 const transport = createProductivityTransport(async () => ({ structuredContent: { ui_version: 'productivity/v1', outcome: 'confirmed', data: { id: 'draft' } } }));
 assert.deepEqual((await transport.call('emails', 'save_draft', {})).data, { id: 'draft' });
});
