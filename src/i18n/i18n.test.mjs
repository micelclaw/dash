import { strict as assert } from 'node:assert';
import { after, test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const vite = await createServer({ root, configFile: false, resolve: { alias: { '@': `${root}src` } }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'silent' });
after(() => vite.close());
const { hasMessage, normalizeLocale, selectLocale, translate, validateCatalogs } = await vite.ssrLoadModule('/src/i18n/core.ts');
const { languageOptions } = await vite.ssrLoadModule('/src/i18n/languages.ts');
const { moduleGroupLabel, moduleLabel } = await vite.ssrLoadModule('/src/i18n/module-labels.ts');
const { MODULES } = await vite.ssrLoadModule('/src/config/modules.ts');
const { formatSatVB, formatXmr } = await vite.ssrLoadModule('/src/modules/crypto/shared/crypto-formatters.ts');
const { formatDateTime } = await vite.ssrLoadModule('/src/i18n/format.ts');

test('catalogs have matching keys and interpolation parameters', () => {
  assert.deepEqual(validateCatalogs(), []);
  assert.match(validateCatalogs([{ en: { a: 'Hello {name}' }, es: { a: 'Hola {other}' } }])[0], /placeholders/);
  assert.match(validateCatalogs([{ en: { a: '{count, plural, one {# item} other {# items}}' }, es: { a: '{count, plural, one {# elemento} other {# elementos}}' } }])[0], /Unsupported ICU/);
  assert.match(validateCatalogs([{ en: { a: 'Hello' }, es: {} }])[0], /Missing/);
  assert.deepEqual(validateCatalogs([{ en: { a: 'Hello {name}' }, es: { a: 'Hola {name}, bienvenido {name}' } }]), []);
  assert.equal(translate('es', 'general.today', { date: '12:00' }), 'Hoy: 12:00');
});

test('the confirmed language belongs to the current session', () => {
  assert.equal(selectLocale(true, 'paco:42', 'paco:42', 'es'), 'es');
  assert.equal(selectLocale(true, 'paco:43', 'paco:42', 'es'), 'en');
  assert.equal(selectLocale(false, 'paco:42', 'paco:42', 'es'), 'en');
  assert.equal(normalizeLocale('es-MX'), 'es');
  assert.equal(normalizeLocale('fr'), 'en');
});

test('only English and Spanish are selectable', () => {
  const options = languageOptions('No disponible');
  assert.deepEqual(options.filter((item) => !item.disabled).map((item) => item.value), ['en', 'es']);
  assert.deepEqual(options.filter((item) => item.disabled).map((item) => item.value), ['fr', 'de', 'pt', 'ja', 'zh']);
  assert.ok(options.filter((item) => item.disabled).every((item) => item.label.includes('No disponible')));
});

test('Office tabs and generated document labels exist in both languages', () => {
  for (const tab of ['documents', 'spreadsheets', 'presentations', 'pdf', 'databases']) {
    assert.equal(hasMessage(`office.tabs.${tab}`), true);
  }
  for (const type of ['docx', 'xlsx', 'pptx', 'pdf']) {
    assert.equal(hasMessage(`office.type.${type}`), true);
  }
  assert.equal(translate('es', 'office.new.creating', { type: translate('es', 'office.type.xlsx') }), 'Creando: hoja de cálculo en blanco…');
});

test('navigation translates built-in labels without changing custom app labels', () => {
  const notes = MODULES.find((item) => item.id === 'notes');
  assert.equal(moduleLabel(notes, 'es'), 'Notas');
  assert.equal(moduleLabel(notes, 'en'), 'Notes');
  assert.equal(moduleLabel({ ...notes, label: 'Mi nombre' }, 'en'), 'Mi nombre');
  assert.equal(moduleLabel({ ...notes, path: '/app/custom', label: 'Custom' }, 'es'), 'Custom');
  assert.equal(moduleGroupLabel('Productivity', 'es', [notes]), 'Productividad');
  assert.equal(moduleGroupLabel('Productivity', 'es', [notes, { ...notes, id: 'custom', label: 'App' }]), 'Productivity');
});

test('crypto display preserves fee precision and small amounts across locales', () => {
  assert.equal(formatSatVB(1.234567, 'en'), '~1.234567 sat/vB');
  assert.equal(formatSatVB(1.234567, 'es'), '~1,234567 sat/vB');
  assert.equal(formatSatVB(1e-8, 'es'), '~1e-8 sat/vB');
  assert.equal(formatXmr(100, 'en'), '100 pico');
  assert.equal(formatXmr(100, 'es'), '100 pico');
});

test('date display respects the saved date, time and timezone preferences', () => {
  const date = new Date('2026-11-16T23:05:00Z');
  assert.equal(formatDateTime(date, 'es', { timezone: 'Europe/Madrid', date_format: 'DD/MM/YYYY', time_format: '24h' }), '17/11/2026 00:05');
  assert.equal(formatDateTime(date, 'en', { timezone: 'Europe/Madrid', date_format: 'YYYY-MM-DD', time_format: '24h' }), '2026-11-17 00:05');
  assert.match(formatDateTime(date, 'en', { timezone: 'UTC', date_format: 'MM/DD/YYYY', time_format: '12h' }), /^11\/16\/2026 11:05\s*PM$/i);
  assert.equal(formatDateTime(new Date('invalid'), 'en'), '');
});

test('statically referenced i18n keys exist in both catalogs', () => {
  const missing = [];
  const visitDirectory = (dir) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, item.name);
      if (item.isDirectory()) { visitDirectory(path); continue; }
      if (!/\.tsx?$/.test(item.name) || item.name.endsWith('.test.ts')) continue;
      const text = readFileSync(path, 'utf8');
      if (!text.includes("from '@/i18n'")) continue;
      const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, item.name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && !hasMessage(node.arguments[0].text)) missing.push(`${path}: ${node.arguments[0].text}`);
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  };
  visitDirectory(join(root, 'src'));
  assert.deepEqual(missing, []);
});
