import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Line } from 'recharts';
import ts from 'typescript';
import { createServer } from 'vite';
import { buildAccountSeriesParams, createFetchAccountSeries, fetchAccountSeriesData } from './account-series.js';
import type { FinanceAccountSeries } from '../../../stores/finance-personal.store.js';

function extractResumenAccountSeriesWiring(source: string): { cards: number; lineBuilders: number } {
  const file = ts.createSourceFile('ResumenTab.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let cards = 0;
  let lineBuilders = 0;
  let owner = '';
  const visit = (node: ts.Node): void => {
    const previousOwner = owner;
    if (ts.isFunctionDeclaration(node) && node.name) owner = node.name.text;
    if (owner === 'ResumenTab' && ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === 'AccountSeriesChartCard') {
      cards += 1;
    }
    if (owner === 'AccountBalanceChart' && ts.isCallExpression(node) && node.expression.getText(file) === 'buildAccountSeriesLines') {
      lineBuilders += 1;
    }
    ts.forEachChild(node, visit);
    owner = previousOwner;
  };
  visit(file);
  return { cards, lineBuilders };
}

function extractStoreAccountSeriesDelegations(source: string): number {
  const file = ts.createSourceFile('finance-personal.store.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let delegations = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node)
      && node.name.getText(file) === 'fetchAccountSeries'
      && node.initializer.getText(file) === 'fetchFinanceAccountSeries'
    ) delegations += 1;
    ts.forEachChild(node, visit);
  };
  visit(file);
  return delegations;
}

describe('serialización del rango account-series', () => {
  it('envía únicamente from/to definidos con los nombres del contrato REST', () => {
    assert.deepEqual(buildAccountSeriesParams({ from: '2026-01-01', to: '2026-12-31' }), {
      from: '2026-01-01',
      to: '2026-12-31',
    });
    assert.deepEqual(buildAccountSeriesParams({ from: '2026-01-01' }), { from: '2026-01-01' });
  });

  it('no fabrica parámetros cuando el store usa los defaults del servidor', () => {
    assert.equal(buildAccountSeriesParams(), undefined);
    assert.equal(buildAccountSeriesParams({}), undefined);
  });

  it('usa el endpoint real y devuelve únicamente data del envelope', async () => {
    const calls: unknown[][] = [];
    const client = {
      get: async <T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> => {
        calls.push([path, params]);
        return { data: { base_currency: 'EUR', dates: [], accounts: [] } } as T;
      },
    };
    const data = await fetchAccountSeriesData<{ base_currency: string; dates: string[]; accounts: unknown[] }>(client, {
      from: '2026-01-01', to: '2026-12-31',
    });
    assert.deepEqual(calls, [[
      '/finance/summary/account-series',
      { from: '2026-01-01', to: '2026-12-31' },
    ]]);
    assert.deepEqual(data, { base_currency: 'EUR', dates: [], accounts: [] });
  });

  it('el store real delega en la acción de producción y la factory conserva el contrato HTTP', async () => {
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
    const { fetchFinanceAccountSeries, useFinancePersonalStore } = await vite.ssrLoadModule('/src/stores/finance-personal.store.ts');
    assert.equal(useFinancePersonalStore.getState().fetchAccountSeries, fetchFinanceAccountSeries);

    const calls: unknown[][] = [];
    const action = createFetchAccountSeries<FinanceAccountSeries>({
      get: async <T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> => {
        calls.push([path, params]);
        return { data: { base_currency: 'USD', dates: [], accounts: [] } } as T;
      },
    });
    assert.deepEqual(await action({ from: '2026-08-01', to: '2026-08-07' }), {
      base_currency: 'USD', dates: [], accounts: [],
    });
    assert.deepEqual(calls, [[
      '/finance/summary/account-series',
      { from: '2026-08-01', to: '2026-08-07' },
    ]]);

    const source = readFileSync(new URL('../../../stores/finance-personal.store.ts', import.meta.url), 'utf8');
    assert.equal(extractStoreAccountSeriesDelegations(source), 1);
    const mutant = source.replace(
      'fetchAccountSeries: fetchFinanceAccountSeries,',
      'fetchAccountSeries: async () => ({ base_currency: "", dates: [], accounts: [] }),',
    );
    assert.notEqual(mutant, source, 'el mutante debe desconectar la acción real del store');
    assert.equal(extractStoreAccountSeriesDelegations(mutant), 0);
    await vite.close();
  });

  it('Resumen compone la serie dentro de ChartCard y genera una Line real por cuenta', async () => {
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
    const { AccountBalanceChart, AccountSeriesChartCard, buildAccountSeriesLines, ChartCard } =
      await vite.ssrLoadModule('/src/modules/finance/personal/ResumenTab.tsx');
    const series: FinanceAccountSeries = {
      base_currency: 'EUR',
      dates: ['2026-08-07'],
      accounts: [{ account_id: 'bank', name: 'Banco', type: 'asset', values: ['42.00'] }],
    };
    const card = AccountSeriesChartCard({ series, title: 'Last 90 days' });
    assert.equal(card.type, ChartCard);
    assert.match(String(card.props.title), /Account balances over time.*EUR/);
    assert.equal(card.props.children.type, AccountBalanceChart);
    assert.equal(card.props.children.props.series, series);

    const lines = buildAccountSeriesLines(series.accounts);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.type, Line);
    assert.equal(lines[0]?.props.dataKey, 'bank');

    const source = readFileSync(new URL('./ResumenTab.tsx', import.meta.url), 'utf8');
    assert.deepEqual(extractResumenAccountSeriesWiring(source), { cards: 1, lineBuilders: 1 });
    const withoutCard = source.replace('<AccountSeriesChartCard ', '<div ');
    const withoutLines = source.replace('{buildAccountSeriesLines(series.accounts)}', '{null}');
    assert.notEqual(withoutCard, source, 'el mutante debe retirar la tarjeta del Resumen');
    assert.notEqual(withoutLines, source, 'el mutante debe desconectar las líneas de AccountBalanceChart');
    assert.equal(extractResumenAccountSeriesWiring(withoutCard).cards, 0);
    assert.equal(extractResumenAccountSeriesWiring(withoutLines).lineBuilders, 0);
    await vite.close();
  });
});
