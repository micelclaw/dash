/** Execute the exact private DTO parser, without importing API/auth or a store. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';

const sourceUrl = new URL('./global-code-mode.service.ts', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8');
const ast = ts.createSourceFile(sourceUrl.pathname, source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'snapshot');
assert.ok(declaration, 'The real DTO parser must remain identifiable');
const js = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const snapshot = new Function(js + '; return snapshot;')();
const base = { revision: 'a'.repeat(64), configured: false, presence: 'explicit', state: 'off' };

test('R1: exact three nonnegative integer counters are accepted without changing the observed state', () => {
  const value = { ...base, overrides: { agent_tools: 0, agent_models: 2, default_models: 1 } };
  const before = JSON.parse(JSON.stringify(value));
  assert.equal(snapshot(value), value);
  assert.deepEqual(value, before);
  assert.equal(Object.values(value.overrides).reduce((a, b) => a + b, 0), 3);
});
test('R1: empty, partial, extra, null, arrays and invalid counts never become zero observed exceptions', () => {
  const valid = { agent_tools: 0, agent_models: 0, default_models: 0 };
  const namedArray = Object.assign([], valid);
  const inherited = Object.assign(Object.create(valid), { unrelated_a: 0, unrelated_b: 0, unrelated_c: 0 });
  for (const overrides of [{}, { agent_tools: 0 }, { ...valid, unreviewed: 1 }, null, [], [0, 0, 0], namedArray, inherited,
    { ...valid, agent_models: -1 }, { ...valid, default_models: 0.5 }, { ...valid, agent_tools: '0' }, { ...valid, agent_models: NaN }]) {
    assert.throws(() => snapshot({ ...base, overrides }), /unknown state/);
  }
});
