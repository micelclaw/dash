import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildAllFilesSearchRoute, readSearchRouteState } from '../search/search-route-state.ts';

const read = (file: string) => readFileSync(file, 'utf8');

test('DR5: global-file route preserves q and restores file scope after a deep-link/reload', () => {
  assert.equal(buildAllFilesSearchRoute(''), '/search?domains=file');
  assert.equal(buildAllFilesSearchRoute(' report '), '/search?q=report&domains=file');
  assert.deepEqual(readSearchRouteState(new URLSearchParams('q=report&domains=file')), { query: 'report', domains: ['file'] });
});

test('DR5: real Drive UI is wired to a single global link while its own search remains contextual', () => {
  const toolbar = read('src/modules/drive/DriveToolbar.tsx');
  const view = read('src/modules/drive/views/MyDriveView.tsx');
  const hook = read('src/modules/drive/hooks/use-drive.ts');
  const searchPage = read('src/modules/search/SearchPage.tsx');
  assert.match(toolbar, /onSearchAllFiles\(localSearch\)/);
  assert.match(view, /navigate\(buildAllFilesSearchRoute\(query\)\)/);
  assert.match(hook, /parent_folder:\s*currentPath/);
  assert.match(hook, /search:\s*search \|\| undefined/);
  assert.match(searchPage, /readSearchRouteState\(searchParams\)/);
  assert.match(searchPage, /routeStateKey/);
  assert.match(searchPage, /\}, \[routeStateKey\]\);/);
  assert.match(searchPage, /onChange=\{e => setQuery\(e\.target\.value\)\}/);
  assert.match(searchPage, /next\.set\('domains', domains\.join\(','\)\)/);
  assert.equal((toolbar.match(/aria-label="Search all files"/g) ?? []).length, 1, 'one global-search control, not a duplicated search surface');
});
