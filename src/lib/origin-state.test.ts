import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeOriginUpdate, originIdentityChanged } from './origin-state';
import { syncAffectsDomain } from './origin-refresh';
const previous = { id: 'card', source: 'caldav', connector_id: 'own', origins: [{ provider_slug: 'google', label: 'Google Tasks' }],
  external_payload: { own: { title: 'Before' } } };
test('ordinary updates preserve origins; changed connector references invalidate them', () => {
  const ordinary = mergeOriginUpdate(previous, { title: 'After', completed_at: null });
  assert.deepEqual(ordinary.origins, previous.origins);
  assert.equal(originIdentityChanged(previous, { source: 'caldav' }), false);
  assert.equal(originIdentityChanged(previous, { external_payload: { own: { title: 'After' } } }), false);
  const changed = mergeOriginUpdate(previous, { connector_id: 'other' });
  assert.equal(changed.origins, undefined);
  assert.equal(originIdentityChanged(previous, { external_payload: { other: {} } }), true);
  const enriched = mergeOriginUpdate(previous, { connector_id: 'other', origins: [{ provider_slug: 'synology', label: 'Synology' }] });
  assert.equal(enriched.origins?.[0]?.provider_slug, 'synology');
});
test('sync completion is filtered by connector and affected domain; cancellations do not refresh', () => {
  const event = { connector_id: 'own', domain_breakdown: { events: { created: 0, updated: 2 }, emails: { created: 0, updated: 0 } } };
  assert.equal(syncAffectsDomain(event, ['events'], ['own']), true);
  assert.equal(syncAffectsDomain(event, ['events'], ['other']), false);
  assert.equal(syncAffectsDomain(event, ['emails']), false);
  assert.equal(syncAffectsDomain({ ...event, cancelled: true }, ['events']), false);
});
