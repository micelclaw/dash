import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAllFilesSearchRoute, readSearchRouteState } from './search-route-state.ts';

test('Drive global-file search preserves the trimmed query and forces file scope', () => {
  assert.equal(
    buildAllFilesSearchRoute('  quarterly report  '),
    '/search?q=quarterly+report&domains=file',
  );
});

test('search route state clears stale store values when URL fields are absent', () => {
  assert.deepEqual(readSearchRouteState(new URLSearchParams()), {
    query: '',
    domains: [],
  });
  assert.deepEqual(
    readSearchRouteState(new URLSearchParams('q=invoice&domains=file%2Cphoto')),
    { query: 'invoice', domains: ['file', 'photo'] },
  );
});
