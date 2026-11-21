import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasWidgetNeedsGrantDecision, shouldFetchNativeCanvasBoard, useNativeCanvasBoardStore } from './native-canvas-board.store.ts';

test('native Canvas refetches after an invalidation but not during a load or a visible error', () => {
  assert.equal(shouldFetchNativeCanvasBoard(undefined), true);
  assert.equal(shouldFetchNativeCanvasBoard({ board: null, loading: false, error: null, revision: 4, epoch: 0 }), true);
  assert.equal(shouldFetchNativeCanvasBoard({ board: null, loading: true, error: null, revision: 4, epoch: 0 }), false);
  assert.equal(shouldFetchNativeCanvasBoard({ board: null, loading: false, error: 'denied', revision: 4, epoch: 0 }), false);
  assert.equal(shouldFetchNativeCanvasBoard({ board: { revision: 4, epoch: 0 }, loading: false, error: null, revision: 4, epoch: 0 }), false);
});

test('revocation purges previews and leaves a terminal error instead of retrying the board', () => {
  const conversationId = 'conversation-revoked';
  useNativeCanvasBoardStore.setState({
    byConversation: new Map([[conversationId, { board: { revision: 3, epoch: 0 }, loading: false, error: null, revision: 3, epoch: 0 }]]),
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
    epoch: 1,
  });
  assert.equal(shouldFetchNativeCanvasBoard(state.byConversation.get(conversationId)), false);
});

test('grant controls are visible only while the Gateway decision is pending', () => {
  assert.equal(canvasWidgetNeedsGrantDecision({ grant_state: 'pending', declared: { tools: ['health'] } }), true);
  assert.equal(canvasWidgetNeedsGrantDecision({ grant_state: 'granted', declared: { tools: ['health'] } }), false);
  assert.equal(canvasWidgetNeedsGrantDecision({ grant_state: 'rejected', declared: { tools: ['health'] } }), false);
  assert.equal(canvasWidgetNeedsGrantDecision({ declared: { tools: ['health'] } }), false);
});


test('a late board response cannot resurrect permissions after downgrade, clear, or revocation', () => {
  const chat = 'epoch-board'; const store = useNativeCanvasBoardStore.getState();
  store.setBoard(chat, { revision: 1, can_edit: true });
  const oldEpoch = store.setLoading(chat);
  store.invalidate(chat);
  const newEpoch = store.setLoading(chat);
  store.setBoard(chat, { revision: 2, can_edit: false }, newEpoch);
  store.setBoard(chat, { revision: 3, can_edit: true }, oldEpoch);
  assert.equal(useNativeCanvasBoardStore.getState().byConversation.get(chat)?.board?.can_edit, false);
  store.clear(chat); store.setBoard(chat, { revision: 4, can_edit: true }, newEpoch);
  assert.equal(useNativeCanvasBoardStore.getState().byConversation.get(chat)?.board, null);
  const afterClear = store.setLoading(chat); store.revoke(chat);
  store.setBoard(chat, { revision: 5, can_edit: true }, afterClear);
  assert.equal(useNativeCanvasBoardStore.getState().byConversation.get(chat)?.board, null);
});
