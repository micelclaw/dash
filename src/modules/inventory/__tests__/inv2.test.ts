import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { addCatalogView, removeCatalogView, viewsForProfile, type CatalogViewSnapshot } from '../tabs/catalog/saved-views';
import { descriptorsForCategory, sanitizeCustomFields } from '../components/category-fields';
import { moveEvidenceDownloadPath, recordCountWithOptionalEvidence } from '../components/count-evidence';

const snapshot: CatalogViewSnapshot = {
  filters: { category: 'vehicle', low_stock: true },
  view: 'grid',
  sort_key: 'name',
  sort_dir: 'desc',
  assets_only: true,
};

const INVENTORY_ROOT = fileURLToPath(new URL('../', import.meta.url));

function parse(path: string): { source: string; file: ts.SourceFile } {
  const source = readFileSync(`${INVENTORY_ROOT}${path}`, 'utf8');
  return { source, file: ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) };
}

function findWithinFunction(
  parsed: ReturnType<typeof parse>,
  functionName: string,
  predicate: (node: ts.Node) => boolean,
): ts.Node | null {
  let root: ts.FunctionDeclaration | null = null;
  parsed.file.forEachChild(node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) root = node;
  });
  assert.ok(root, `production function ${functionName} must exist`);
  let match: ts.Node | null = null;
  const visit = (node: ts.Node) => {
    if (!match && predicate(node)) match = node;
    if (!match) ts.forEachChild(node, visit);
  };
  visit(root);
  return match;
}

function jsxNamed(name: string): (node: ts.Node) => boolean {
  return node => (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText() === name;
}

function callNamed(name: string): (node: ts.Node) => boolean {
  return node => ts.isCallExpression(node) && node.expression.getText() === name;
}

function withoutNode(parsed: ReturnType<typeof parse>, node: ts.Node): ReturnType<typeof parse> {
  // Keep the mutant syntactically valid. Deleting a call nested inside JSX can
  // send TypeScript's error-recovery parser through a very large malformed
  // subtree, making this guard hang instead of reporting the missing wiring.
  const replacement = ts.isCallExpression(node) ? 'undefined' : '<></>';
  const mutated = parsed.source.slice(0, node.getStart(parsed.file))
    + replacement
    + parsed.source.slice(node.getEnd());
  return { source: mutated, file: ts.createSourceFile(parsed.file.fileName, mutated, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) };
}

test('saved Catalog views create, apply, delete, and remain profile-isolated', () => {
  let views = addCatalogView([], 'profile-a', '  Fleet  ', snapshot, 'view-a');
  views = addCatalogView(views, 'profile-b', 'Other', { ...snapshot, filters: { tag: 'office' } }, 'view-b');
  assert.deepEqual(viewsForProfile(views, 'profile-a'), [{ id: 'view-a', profile_id: 'profile-a', name: 'Fleet', ...snapshot }]);
  assert.deepEqual(viewsForProfile(views, 'profile-a')[0]?.filters, snapshot.filters);
  views = removeCatalogView(views, 'profile-a', 'view-a');
  assert.equal(viewsForProfile(views, 'profile-a').length, 0);
  assert.equal(viewsForProfile(views, 'profile-b').length, 1);
});

test('saved views enforce name and per-profile maximum without affecting other profiles', () => {
  assert.throws(() => addCatalogView([], 'p', ' '.repeat(2), snapshot, 'x'), /1–40/);
  assert.throws(() => addCatalogView([], 'p', 'x'.repeat(41), snapshot, 'x'), /1–40/);
  let views = addCatalogView([], 'other', 'Other', snapshot, 'other');
  for (let index = 0; index < 20; index += 1) views = addCatalogView(views, 'p', `View ${index}`, snapshot, `p-${index}`);
  assert.throws(() => addCatalogView(views, 'p', 'Overflow', snapshot, 'overflow'), /at most 20/);
  assert.equal(viewsForProfile(views, 'other').length, 1);
});

test('descriptor-driven category fields cover typed create/edit and preserve Advanced fields', () => {
  assert.deepEqual(descriptorsForCategory('vehículo').map(field => field.type), ['text', 'number', 'date', 'select']);
  const createPayload = sanitizeCustomFields({ km: 12000, itv_until: '2027-01-01', note: ' garage ', empty: '' });
  assert.deepEqual(createPayload, { km: 12000, itv_until: '2027-01-01', note: 'garage' });
  const editPayload = sanitizeCustomFields({ ...createPayload, km: 12500, note: '' });
  assert.deepEqual(editPayload, { km: 12500, itv_until: '2027-01-01' });
});

test('all promised category templates expose descriptors, including aliases', () => {
  for (const category of ['vehicle', 'electronics', 'appliance', 'insurance', 'tool', 'sport']) {
    assert.ok(descriptorsForCategory(category).length > 0, `${category} must have descriptors`);
  }
  assert.deepEqual(descriptorsForCategory('seguro'), descriptorsForCategory('insurance'));
  assert.deepEqual(descriptorsForCategory('electrónica'), descriptorsForCategory('electronics'));
});

test('Inventory UI production wiring reaches saved views, typed fields, count evidence, and ledger evidence', () => {
  const cases = [
    { path: 'tabs/CatalogTab.tsx', fn: 'CatalogTab', predicate: jsxNamed('SavedViewsControl') },
    { path: 'tabs/catalog/NewItemModal.tsx', fn: 'NewItemModal', predicate: jsxNamed('CategoryFieldsForm') },
    { path: 'components/item-drawer/EditItemCard.tsx', fn: 'EditItemCard', predicate: jsxNamed('CategoryFieldsForm') },
    { path: 'components/ScannerModal.tsx', fn: 'ScannerModal', predicate: callNamed('recordCountWithOptionalEvidence') },
    { path: 'tabs/StockTab.tsx', fn: 'StockTab', predicate: callNamed('moveEvidenceDownloadPath') },
  ];

  for (const wiring of cases) {
    const production = parse(wiring.path);
    const extracted = findWithinFunction(production, wiring.fn, wiring.predicate);
    assert.ok(extracted?.getText(production.file).trim(), `${wiring.fn} wiring extraction must be non-empty`);

    // Explicit deletion mutant: removing every matching production node must trip the same guard.
    let mutant = production;
    let remaining: ts.Node | null;
    while ((remaining = findWithinFunction(mutant, wiring.fn, wiring.predicate))) {
      mutant = withoutNode(mutant, remaining);
    }
    assert.equal(
      Boolean(findWithinFunction(mutant, wiring.fn, wiring.predicate)),
      false,
      `${wiring.fn} deletion mutant survived`,
    );
  }
});

test('count without a photo records no document link', async () => {
  let uploads = 0;
  let body: Record<string, unknown> | undefined;
  await recordCountWithOptionalEvidence({
    item_id: 'item', qty_delta: 2, photo: null, uploaded_file_id: null,
    upload: async () => { uploads += 1; return 'file'; },
    remember_upload: () => {}, record: async value => { body = value; },
  });
  assert.equal(uploads, 0);
  assert.deepEqual(body, { item_id: 'item', type: 'count_fix', qty_delta: 2 });
});

test('upload failure prevents the count and a retry can upload and link the evidence', async () => {
  const photo = {} as File;
  let attempts = 0;
  let records = 0;
  let remembered: string | null = null;
  const options = {
    item_id: 'item', qty_delta: -1, photo, uploaded_file_id: null as string | null,
    upload: async () => { attempts += 1; if (attempts === 1) throw new Error('upload failed'); return 'file-7'; },
    remember_upload: (id: string) => { remembered = id; },
    record: async (body: Record<string, unknown>) => { records += 1; assert.equal(body.doc_file_id, 'file-7'); },
  };
  await assert.rejects(recordCountWithOptionalEvidence(options), /upload failed/);
  assert.equal(records, 0);
  await recordCountWithOptionalEvidence(options);
  assert.equal(remembered, 'file-7');
  assert.equal(records, 1);
  assert.equal(moveEvidenceDownloadPath(remembered), '/api/v1/files/file-7/download');
});

test('retry after a ledger failure reuses the uploaded evidence instead of duplicating it', async () => {
  const photo = {} as File;
  let uploads = 0;
  let remembered: string | null = null;
  await assert.rejects(recordCountWithOptionalEvidence({
    item_id: 'item', qty_delta: 1, photo, uploaded_file_id: null,
    upload: async () => { uploads += 1; return 'file-8'; },
    remember_upload: id => { remembered = id; },
    record: async () => { throw new Error('move failed'); },
  }), /move failed/);
  await recordCountWithOptionalEvidence({
    item_id: 'item', qty_delta: 1, photo, uploaded_file_id: remembered,
    upload: async () => { uploads += 1; return 'duplicate'; },
    remember_upload: id => { remembered = id; },
    record: async body => { assert.equal(body.doc_file_id, 'file-8'); },
  });
  assert.equal(uploads, 1);
});
