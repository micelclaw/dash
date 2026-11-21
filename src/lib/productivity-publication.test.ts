import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useChatWorkspaceStore as store } from '../stores/chat-workspace.store';
import { isProductivityLaunchCurrent, productivityHistoryPreviews, publishProductivity } from './productivity-publication';

const chat = randomUUID(), owner = randomUUID(), profile = randomUUID(), otherProfile = randomUUID();
const descriptor = (area = 'F1', erp = profile) => ({ version: 'micelclaw-productivity-preview/v1', id: randomUUID(), conversation_id: chat, area, title: 'Ensayo', resource_id: `productivity:${area}:0123456789abcdef0123456789abcdef`, erp_profile_id: area === 'notes' ? null : erp, selection: { action: area === 'notes' ? 'list' : 'summary', params: {} } });
beforeEach(() => store.setState({ owner, generation: 1, byConversation: {} }));
test('late live/history ERP descriptors keep only an inert reference and cannot open a retired panel', () => {
 const raw = descriptor();
 publishProductivity(chat, raw, otherProfile);
 const workspace = store.getState().byConversation[chat]!;
 assert.equal(workspace.panelOpen, false); assert.deepEqual(workspace.openIds, []); assert.equal(workspace.activeId, null);
 const saved = workspace.resources[raw.resource_id]!; assert.equal(saved.kind, 'productivity');
 assert.equal('context' in saved, false); assert.equal('view' in saved && saved.view, null);
 // Replaying history after returning to the matching profile is still not an automatic opening.
 publishProductivity(chat, raw, profile);
 assert.deepEqual(store.getState().byConversation[chat]!.openIds, []);
 assert.equal(store.getState().open(chat, raw.resource_id), true);
});
test('matching ERP and ordinary notes auto-open; a late mismatch never replaces the current active tab', () => {
 const notes = descriptor('notes'); publishProductivity(chat, notes, otherProfile);
 assert.equal(store.getState().byConversation[chat]!.activeId, notes.resource_id);
 const finance = descriptor(); publishProductivity(chat, finance, otherProfile);
 assert.equal(store.getState().byConversation[chat]!.activeId, notes.resource_id);
 store.setState({ byConversation: {} }); publishProductivity(chat, finance, profile);
 assert.equal(store.getState().byConversation[chat]!.activeId, finance.resource_id);
 store.getState().close(chat, finance.resource_id); publishProductivity(chat, { ...finance, id: randomUUID() }, profile);
 assert.deepEqual(store.getState().byConversation[chat]!.openIds, []);
});
test('another conversation, revoked source and inconsistent context are rejected before publication', () => {
 publishProductivity(randomUUID(), descriptor(), profile); assert.deepEqual(store.getState().byConversation, {});
 publishProductivity(chat, { ...descriptor(), erp_profile_id: null }, profile); assert.deepEqual(store.getState().byConversation, {});
 store.getState().revokeSource(chat); publishProductivity(chat, descriptor(), profile);
 assert.deepEqual(store.getState().byConversation[chat]!.resources, {});
});
test('a pending launch cannot revive a tab after reset, revalidation, close or a newer descriptor', () => {
 for (const action of ['reset', 'revalidate', 'close', 'replace', 'revoke'] as const) {
  store.setState({ byConversation: {} }); const raw = descriptor('notes'); publishProductivity(chat, raw, profile);
  const reference = store.getState().byConversation[chat]!.resources[raw.resource_id]!;
  if (reference.kind !== 'productivity') assert.fail('Missing reference');
  const epoch = store.getState().byConversation[chat]!.epoch;
  assert.equal(isProductivityLaunchCurrent(chat, reference.reference, epoch, reference.viewEpoch ?? 0), true);
  if (action === 'reset') store.getState().reset(chat);
  if (action === 'revalidate') store.getState().revalidate(chat);
  if (action === 'close') store.getState().close(chat, raw.resource_id);
  if (action === 'replace') publishProductivity(chat, { ...raw, id: randomUUID() }, profile);
  if (action === 'revoke') store.getState().revokeSource(chat);
  assert.equal(isProductivityLaunchCurrent(chat, reference.reference, epoch, reference.viewEpoch ?? 0), false, action);
 }
});
test('close/reopen and profile A-B-A never restore the invalidation version of an older pending launch', () => {
 const raw = descriptor(); publishProductivity(chat, raw, profile);
 const initial = store.getState().byConversation[chat]!.resources[raw.resource_id]!;
 if (initial.kind !== 'productivity') assert.fail('Missing reference');
 const epoch = store.getState().byConversation[chat]!.epoch;
 const oldVersion = initial.viewEpoch ?? 0;
 store.getState().close(chat, raw.resource_id); store.getState().open(chat, raw.resource_id);
 assert.equal(isProductivityLaunchCurrent(chat, initial.reference, epoch, oldVersion), false);
 const closedVersion = (store.getState().byConversation[chat]!.resources[raw.resource_id] as typeof initial).viewEpoch!;
 store.getState().invalidateProductivityProfiles(); store.getState().invalidateProductivityProfiles();
 assert.equal(isProductivityLaunchCurrent(chat, initial.reference, epoch, closedVersion), false);
 // An update with an old resource snapshot cannot decrement the monotonic version.
 store.getState().upsert(chat, initial);
 const current = store.getState().byConversation[chat]!.resources[raw.resource_id] as typeof initial;
 assert.ok(current.viewEpoch! > closedVersion);
 assert.equal(isProductivityLaunchCurrent(chat, current.reference, epoch, current.viewEpoch!), true);
});
test('history advances past an observed live descriptor after reconnect without rolling back a newer unpersisted event', () => {
 const first = descriptor('notes'); const second = { ...first, id: randomUUID(), selection: { action: 'list', params: { search: 'Segundo resultado' } } };
 const third = { ...first, id: randomUUID() };
 const message = (raw: unknown) => ({ role: 'assistant', message_metadata: { productivity_previews: [raw] } });
 const live = new Map([[`${chat}:${first.resource_id}`, first.id]]);
 assert.deepEqual(productivityHistoryPreviews(chat, [message(first), message(second)], live), [second]); assert.equal(live.size, 0);
 live.set(`${chat}:${first.resource_id}`, third.id);
 assert.deepEqual(productivityHistoryPreviews(chat, [message(first), message(second)], live), []); assert.equal(live.size, 1);
 assert.deepEqual(productivityHistoryPreviews(chat, [message(first), message(second), message(third)], live), [third]); assert.equal(live.size, 0);
});
