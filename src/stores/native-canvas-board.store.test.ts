import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasWidgetNeedsGrantDecision, shouldFetchNativeCanvasBoard, useNativeCanvasBoardStore } from './native-canvas-board.store.ts';

test('native Canvas refetches after an invalidation but not during a load or a visible error', () => {
  assert.equal(shouldFetchNativeCanvasBoard(undefined), true);
  assert.equal(shouldFetchNativeCanvasBoard({ board: null, loading: false, error: null, revision: 4 }), true);
  assert.equal(shouldFetchNativeCanvasBoard({ board: null, loading: true, error: null, revision: 4 }), false);
  assert.equal(shouldFetchNativeCanvasBoard({ board: null, loading: false, error: 'denied', revision: 4 }), false);
  assert.equal(shouldFetchNativeCanvasBoard({ board: { revision: 4 }, loading: false, error: null, revision: 4 }), false);
});

test('revocation purges previews and leaves a terminal error instead of retrying the board', () => {
  const conversationId = 'conversation-revoked';
  useNativeCanvasBoardStore.setState({
    byConversation: new Map([[conversationId, { board: { revision: 3 }, loading: false, error: null, revision: 3 }]]),
    previews: new Map([[conversationId, [{ documentId: 'cv_abcd1234', viewId: 'preview-1', title: 'Private' }]]]),
  });

  useNativeCanvasBoardStore.getState().revoke(conversationId);

  const state = useNativeCanvasBoardStore.getState();
  assert.equal(state.previews.has(conversationId), false);
  assert.deepEqual(state.byConversation.get(conversationId), {
    board: null,
    loading: false,
    error: 'Ya no tienes acceso a este Canvas.',
    revision: null,
  });
  assert.equal(shouldFetchNativeCanvasBoard(state.byConversation.get(conversationId)), false);
});

test('grant controls are visible only while the Gateway decision is pending', () => {
  assert.equal(canvasWidgetNeedsGrantDecision({ grant_state: 'pending', declared: { tools: ['health'] } }), true);
  assert.equal(canvasWidgetNeedsGrantDecision({ grant_state: 'granted', declared: { tools: ['health'] } }), false);
  assert.equal(canvasWidgetNeedsGrantDecision({ grant_state: 'rejected', declared: { tools: ['health'] } }), false);
  assert.equal(canvasWidgetNeedsGrantDecision({ declared: { tools: ['health'] } }), false);
});
