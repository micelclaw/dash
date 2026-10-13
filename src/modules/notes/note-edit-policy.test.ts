import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteEditPolicy } from './note-edit-policy';
const connected = { provider: 'notion-notes', label: 'Notion', state: 'synced' as const, owner: true,
  content_edit: 'structured_required' as const, write_certified: false, local_metadata_editable: true };
test('local notes remain editable; a source badge is not a sync authority', () => {
  assert.deepEqual(noteEditPolicy({ sync: null }), { bodyReadOnly: false, metadataReadOnly: false });
  assert.equal(noteEditPolicy(null).bodyReadOnly, true);
});
test('connected content never enters whole-body autosave, even after write certification', () => {
  for (const write_certified of [false, true]) {
    const policy = noteEditPolicy({ sync: { ...connected, write_certified } });
    assert.equal(policy.bodyReadOnly, true); assert.equal(policy.metadataReadOnly, false);
  }
});
test('shared connected readers cannot edit local metadata or remote content', () => {
  assert.equal(noteEditPolicy({ sync: { ...connected, owner: false, local_metadata_editable: false }, _shared_permission: 'write' }).metadataReadOnly, true);
  assert.equal(noteEditPolicy({ sync: null, _shared_permission: 'read' }).bodyReadOnly, true);
  assert.equal(noteEditPolicy({ sync: null, _shared_permission: 'write' }).bodyReadOnly, false);
});
test('a preserved OneNote native view cannot be silently converted after disconnect', () => {
  const policy = noteEditPolicy({ sync: null, content_format: 'html', content: '<div data-note-native-view="onenote"><p>Preserved</p></div>' });
  assert.equal(policy.bodyReadOnly, true);
  assert.equal(policy.metadataReadOnly, false);
});
