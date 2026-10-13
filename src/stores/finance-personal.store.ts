/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// ─── Finance Personal store (nativo) ─────────────────────────────────
// Estado de la lente Personal (cuentas/movimientos/categorías/resumen) sobre las
// rutas REST nativas /finance/* (F1). Distinto de finance.store.ts (estado de los
// contenedores embebidos Firefly/SolidInvoice).

import { create } from 'zustand';
import { api } from '@/services/api';
import { createFetchAccountSeries } from '@/modules/finance/personal/account-series';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type MovementKind = 'expense' | 'income' | 'transfer';

export interface FinanceAccount {
  id: string;
  name: string;
  type: AccountType;
  subtype: string | null;
  currency: string;
  is_active: boolean;
  balance: string; // saldo derivado (string numeric)
  metadata?: Record<string, unknown> | null;
}

export interface FinanceCategory {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  parent_id: string | null;
  color: string | null;
  icon: string | null;
}

export interface FinancePosting {
  id: string;
  account_id: string;
  debit: string | null;
  credit: string | null;
  amount_base: string;
  currency: string;
  category_id: string | null;
  memo: string | null;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  description: string | null;
  source: string;
  /** != null si el asiento lo materializó una regla recurrente (0247) → badge "Recurrente". */
  recurring_rule_id?: string | null;
  postings: FinancePosting[];
}

/** Cadencia de un movimiento recurrente. */
export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface FinanceSummary {
  period: { from: string; to: string };
  net_worth: string;
  available: string;
  expenses_period: string;
  income_period: string;
  by_type: Record<string, string>;
}

/** Punto de la serie de evolución (patrimonio y disponible acumulados por fecha). */
export interface FinanceSeriesPoint {
  date: string; // 'YYYY-MM-DD'
  net_worth: string;
  available: string;
  income: string; // ingreso del día (no acumulado) — barra verde del Resumen
  expense: string; // gasto del día (no acumulado) — barra roja del Resumen
}

/** Serie densa de saldos acumulados, alineada por fecha, para una línea por cuenta. */
export interface FinanceAccountSeries {
  base_currency: string;
  dates: string[];
  accounts: Array<{
    account_id: string;
    name: string;
    type: 'asset' | 'liability';
    values: string[];
  }>;
}

/** Total de gasto (o ingreso) por categoría en un periodo. */
export interface FinanceCategoryTotal {
  category_id: string | null;
  name: string | null;
  color: string | null;
  icon: string | null;
  total: string;
}

/** Opciones de rango para las series del resumen. */
export interface FinanceSeriesOpts {
  from?: string;
  to?: string;
  interval?: 'day' | 'week' | 'month';
}

/** Acción de producción enlazada al cliente real; el store delega por identidad. */
export const fetchFinanceAccountSeries = createFetchAccountSeries<FinanceAccountSeries>(api);

/** Opciones para el desglose por categoría. */
export interface FinanceByCategoryOpts {
  from?: string;
  to?: string;
  kind?: 'expense' | 'income';
}

/**
 * Estado de un presupuesto mensual por categoría: el importe asignado, lo gastado
 * en el mes (del ledger, vía getSpendByCategory) y lo que queda. `period` = cadencia
 * (de momento 'monthly'). Los campos de categoría vienen denormalizados del backend.
 */
export interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  category_color: string | null;
  category_icon: string | null;
  amount: string;   // importe presupuestado (numeric como string)
  spent: string;    // gastado en el mes (numeric como string)
  remaining: string; // amount - spent (numeric como string)
  period: string;   // 'monthly'
}

export interface CreateBudgetInput {
  category_id: string;
  amount: string;
  period?: string;
}

/** Objetivo de ahorro (users.settings.finance_goals). Meta: importe + fecha + ahorrado. */
export interface SavingsGoal {
  id: string;
  name: string;
  target: number;   // importe objetivo
  deadline: string | null; // 'YYYY-MM-DD' o null
  saved: number;    // ahorrado hasta ahora → progreso = saved/target
}

export interface MovementInput {
  kind: MovementKind;
  account_id: string;
  amount: string;
  date: string;
  category_id?: string | null;
  to_account_id?: string | null;
  description?: string | null;
  /** Si viene, el backend crea una regla recurrente y materializa desde `date` hasta hoy. */
  recurrence?: { interval: RecurrenceInterval };
}

export interface CreateCategoryInput {
  name: string;
  kind: 'income' | 'expense';
  /** Emoji o glifo corto (campo `icon` del backend). */
  icon?: string;
  /** Color en hex (`#rrggbb`) para la pastilla de la categoría. */
  color?: string;
}

interface TxFilters { account_id?: string; category_id?: string; date_from?: string; date_to?: string }

// Mes activo de los presupuestos ('YYYY-MM'). Se recuerda fuera del estado para que
// las acciones de mutación re-consulten el mismo mes que se está viendo.
let activeBudgetMonth: string | undefined;

interface FinancePersonalState {
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
  txTotal: number;
  summary: FinanceSummary | null;
  budgets: Budget[];
  selectedAccountId: string | null;
  loading: boolean;
  error: string | null;

  fetchAccounts: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchTransactions: (filters?: TxFilters) => Promise<void>;
  fetchSummary: () => Promise<void>;
  /** Resumen acotado a un periodo (net_worth/available siguen siendo all-time). Devuelve; no muta el store. */
  fetchSummaryRange: (opts?: { from?: string; to?: string }) => Promise<FinanceSummary>;
  /** Movimientos recientes del periodo (ordenados date desc). Devuelve la lista; no muta el store. */
  fetchRecentTransactions: (opts?: { from?: string; to?: string; limit?: number }) => Promise<FinanceTransaction[]>;
  /** Serie de evolución (patrimonio/disponible acumulados). Devuelve los puntos; no muta el store. */
  fetchSeries: (opts?: FinanceSeriesOpts) => Promise<FinanceSeriesPoint[]>;
  /** Saldos acumulados por cuenta, alineados con la serie agregada. */
  fetchAccountSeries: (opts?: FinanceSeriesOpts) => Promise<FinanceAccountSeries>;
  /** Total por categoría del periodo (gasto por defecto). Devuelve la lista; no muta el store. */
  fetchSpendByCategory: (opts?: FinanceByCategoryOpts) => Promise<FinanceCategoryTotal[]>;
  refreshAll: () => Promise<void>;
  setSelectedAccount: (id: string | null) => void;

  createMovement: (input: MovementInput) => Promise<void>;
  /** Importa un lote de movimientos (forma simple D13). Las filas inválidas no abortan el lote. */
  importTransactions: (rows: MovementInput[]) => Promise<{ created: number; failed: { index: number; error: string }[] }>;
  createAccount: (data: { name: string; type: AccountType; subtype?: string; currency?: string }) => Promise<FinanceAccount>;
  /** Edita una cuenta-monedero (nombre/tipo/subtipo/divisa/activa). Refresca la lista. */
  updateAccount: (id: string, data: { name?: string; type?: AccountType; subtype?: string | null; currency?: string; is_active?: boolean }) => Promise<FinanceAccount>;
  /** Borra (soft-delete) una cuenta. Refresca la lista. */
  deleteAccount: (id: string) => Promise<void>;
  createCategory: (data: CreateCategoryInput) => Promise<FinanceCategory>;
  /** Edita una categoría (nombre/emoji/color). Refresca la lista. */
  updateCategory: (id: string, data: { name?: string; icon?: string | null; color?: string | null }) => Promise<FinanceCategory>;
  /** Borra (soft-delete) una categoría. Refresca la lista. */
  deleteCategory: (id: string) => Promise<void>;
  reverseTransaction: (id: string) => Promise<void>;
  /** Edición "blanda" de un movimiento (concepto/categoría) — no toca el ledger. */
  updateMovementMetadata: (id: string, data: { description?: string | null; categoryId?: string | null }) => Promise<void>;
  /** Edición completa: concepto/categoría in situ; importe/cuenta/fecha → reversar+recrear. */
  editMovement: (oldTx: FinanceTransaction, input: MovementInput) => Promise<void>;

  /** Estado de los presupuestos del mes indicado ('YYYY-MM'; por defecto, mes en curso). */
  fetchBudgets: (month?: string) => Promise<void>;
  createBudget: (input: CreateBudgetInput) => Promise<Budget>;
  updateBudget: (id: string, data: { amount: string }) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  /** Objetivos de ahorro (users.settings.finance_goals). Devuelven la lista; no mutan el store. */
  fetchGoals: () => Promise<SavingsGoal[]>;
  saveGoals: (goals: SavingsGoal[]) => Promise<SavingsGoal[]>;
}

/**
 * Fuentes cuyo asiento lo escribe el USUARIO → se puede editar importe/cuenta (el dash
 * reversa y recrea). El resto (`document` = factura/cobro/pago/COGS, `reversal`,
 * `closing`, `opening`) los construye el Core y llevan patas del mayor (AR/AP/IVA…):
 * reversarlos y recrear un movimiento suelto dejaría el cobro huérfano de su factura
 * —el `finance_payments` sigue vivo pero su asiento ya no— así que solo se editan
 * concepto y categoría. Allow-list a propósito: una fuente nueva nace bloqueada.
 */
const USER_EDITABLE_SOURCES = new Set(['manual', 'import', 'recurring', 'rule']);

/**
 * Subtipos de CUENTA-MONEDERO: exactamente los que ofrece el diálogo de cuenta del dash
 * (`CuentaDialog` → asset: bank/cash/savings/other · liability: credit_card/loan/other).
 * Una cuenta de activo/pasivo con OTRO subtipo (o sin subtipo) es del MAYOR aunque el
 * listado la traiga: amortización acumulada (280/281), inmovilizado (206/213), HP
 * acreedora por Sociedades (4752), Organismos de la SS (476), capital social (100)…
 * Esos asientos —amortización, Impuesto de Sociedades, Seguridad Social, aportación de
 * capital, alta de inmovilizado— son de SISTEMA con fuente `manual`, así que la allow-list
 * de fuentes no los detiene: sin esta segunda puerta el dash ofrecía editarlos reversando+
 * recreando, y eso deja huérfano lo que cuelga del asiento (p.ej.
 * `inventory_depreciation_snapshots` apunta al asiento de la amortización) o pierde la pata
 * del mayor al recrearlo contra la cuenta de gasto por defecto. Allow-list a propósito: un
 * subtipo nuevo nace bloqueado.
 */
const WALLET_SUBTYPES = new Set(['bank', 'cash', 'savings', 'credit_card', 'loan', 'other']);

/**
 * Reconstruye los campos de un MOVIMIENTO (kind/cuenta/importe/categoría/concepto/fecha)
 * a partir de su asiento, para prerrellenar el editor. `simple` = movimiento estándar
 * (income/expense de 1 cuenta-monedero, o transferencia de 2) → se puede editar importe/
 * cuenta; si es complejo (cobro/asiento multi-pata), solo concepto/categoría.
 */
export function reconstructMovement(tx: FinanceTransaction, accounts: FinanceAccount[]): {
  kind: MovementKind; accountId: string; toAccountId: string | null; amount: string;
  categoryId: string | null; description: string | null; date: string; simple: boolean;
} {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const isWallet = (p: FinancePosting) => { const a = byId.get(p.account_id); return !!a && (a.type === 'asset' || a.type === 'liability'); };
  const wallets = tx.postings.filter(isWallet);
  // ¿Alguna pata cae en una cuenta del MAYOR (activo/pasivo que no es monedero)? Entonces
  // el asiento es de sistema aunque su fuente sea `manual` → nunca estructuralmente editable.
  const touchesLedger = tx.postings.some((p) => {
    const a = byId.get(p.account_id);
    return !!a && (a.type === 'asset' || a.type === 'liability') && !WALLET_SUBTYPES.has(a.subtype ?? '');
  });
  const userOwned = USER_EDITABLE_SOURCES.has(tx.source) && !touchesLedger;
  const isTransfer = tx.postings.length === 2 && tx.postings.every(isWallet);
  if (isTransfer) {
    const from = tx.postings.find((p) => p.credit != null);
    const to = tx.postings.find((p) => p.debit != null);
    return { kind: 'transfer', accountId: from?.account_id ?? '', toAccountId: to?.account_id ?? null, amount: Number(from?.credit ?? 0).toFixed(2), categoryId: null, description: tx.description, date: tx.date, simple: userOwned };
  }
  const wallet = wallets[0];
  const other = tx.postings.find((p) => !isWallet(p));
  const isIncome = wallet?.debit != null; // dinero ENTRA a la cuenta-monedero = ingreso
  const amount = Number(wallet?.debit ?? wallet?.credit ?? 0);
  const simple = userOwned && wallets.length === 1 && tx.postings.length === 2;
  return {
    kind: isIncome ? 'income' : 'expense',
    accountId: wallet?.account_id ?? '', toAccountId: null,
    amount: amount.toFixed(2),
    categoryId: other?.category_id ?? wallet?.category_id ?? null,
    description: tx.description, date: tx.date, simple,
  };
}

export const useFinancePersonalStore = create<FinancePersonalState>((set, get) => ({
  accounts: [],
  categories: [],
  transactions: [],
  txTotal: 0,
  summary: null,
  budgets: [],
  selectedAccountId: null,
  loading: false,
  error: null,

  fetchAccounts: async () => {
    const r = await api.get<{ data: FinanceAccount[] }>('/finance/accounts');
    set({ accounts: r.data });
  },
  fetchCategories: async () => {
    const r = await api.get<{ data: FinanceCategory[] }>('/finance/categories');
    set({ categories: r.data });
  },
  fetchTransactions: async (filters) => {
    const r = await api.get<{ data: FinanceTransaction[]; meta?: { total: number } }>('/finance/transactions', filters as Record<string, string | undefined>);
    set({ transactions: r.data, txTotal: r.meta?.total ?? r.data.length });
  },
  fetchSummary: async () => {
    const r = await api.get<{ data: FinanceSummary }>('/finance/summary');
    set({ summary: r.data });
  },
  fetchSummaryRange: async (opts) => {
    // El backend acepta date_from/date_to; net_worth/available los devuelve all-time
    // (no dependen del rango), solo expenses_period/income_period se acotan al periodo.
    const params = opts ? { date_from: opts.from, date_to: opts.to } : undefined;
    const r = await api.get<{ data: FinanceSummary }>('/finance/summary', params);
    return r.data;
  },
  fetchRecentTransactions: async (opts) => {
    const params: Record<string, string | number | undefined> = { date_from: opts?.from, date_to: opts?.to, limit: opts?.limit ?? 8 };
    const r = await api.get<{ data: FinanceTransaction[] }>('/finance/transactions', params);
    return r.data;
  },
  fetchSeries: async (opts) => {
    const r = await api.get<{ data: FinanceSeriesPoint[] }>('/finance/summary/series', opts as Record<string, string | undefined>);
    return r.data;
  },
  fetchAccountSeries: fetchFinanceAccountSeries,
  fetchSpendByCategory: async (opts) => {
    const r = await api.get<{ data: FinanceCategoryTotal[] }>('/finance/summary/by-category', opts as Record<string, string | undefined>);
    return r.data;
  },
  refreshAll: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([get().fetchAccounts(), get().fetchCategories(), get().fetchSummary(), get().fetchTransactions()]);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error al cargar finanzas' });
    } finally {
      set({ loading: false });
    }
  },
  setSelectedAccount: (id) => set({ selectedAccountId: id }),

  createMovement: async (input) => {
    await api.post('/finance/transactions', input);
    // refrescar saldos + resumen + lista
    await Promise.all([get().fetchAccounts(), get().fetchSummary(), get().fetchTransactions(get().selectedAccountId ? { account_id: get().selectedAccountId! } : undefined)]);
  },
  importTransactions: async (rows) => {
    const r = await api.post<{ data: { created: number; failed: { index: number; error: string }[] } }>('/finance/transactions/import', { rows });
    await get().refreshAll();
    return r.data;
  },
  createAccount: async (data) => {
    const r = await api.post<{ data: FinanceAccount }>('/finance/accounts', data);
    await get().fetchAccounts();
    return r.data;
  },
  updateAccount: async (id, data) => {
    const r = await api.patch<{ data: FinanceAccount }>(`/finance/accounts/${id}`, data);
    await get().fetchAccounts();
    return r.data;
  },
  deleteAccount: async (id) => {
    await api.delete(`/finance/accounts/${id}`);
    if (get().selectedAccountId === id) set({ selectedAccountId: null });
    await get().fetchAccounts();
  },
  createCategory: async (data) => {
    const r = await api.post<{ data: FinanceCategory }>('/finance/categories', data);
    await get().fetchCategories();
    return r.data;
  },
  updateCategory: async (id, data) => {
    const r = await api.patch<{ data: FinanceCategory }>(`/finance/categories/${id}`, data);
    await get().fetchCategories();
    return r.data;
  },
  deleteCategory: async (id) => {
    await api.delete(`/finance/categories/${id}`);
    await get().fetchCategories();
  },
  reverseTransaction: async (id) => {
    await api.post(`/finance/transactions/${id}/reverse`);
    await get().refreshAll();
  },
  updateMovementMetadata: async (id, data) => {
    await api.patch(`/finance/transactions/${id}`, {
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.categoryId !== undefined ? { category_id: data.categoryId } : {}),
    });
    await get().refreshAll();
  },
  editMovement: async (oldTx, input) => {
    const before = reconstructMovement(oldTx, get().accounts);
    // ¿Cambió algo que toca el ledger (importe/cuenta/tipo/fecha/destino)? → reversar+recrear.
    const structural =
      before.kind !== input.kind ||
      before.accountId !== input.account_id ||
      (before.toAccountId ?? null) !== (input.to_account_id ?? null) ||
      Math.abs(Number(before.amount) - Number(input.amount)) > 0.005 ||
      before.date !== input.date;
    if (structural) {
      await get().reverseTransaction(oldTx.id);
      await get().createMovement(input);
    } else {
      await get().updateMovementMetadata(oldTx.id, { description: input.description ?? null, categoryId: input.category_id ?? null });
    }
  },

  fetchBudgets: async (month) => {
    activeBudgetMonth = month;
    const r = await api.get<{ data: Budget[] }>('/finance/budgets', month ? { month } : undefined);
    set({ budgets: r.data });
  },
  createBudget: async (input) => {
    const r = await api.post<{ data: Budget }>('/finance/budgets', input);
    await get().fetchBudgets(activeBudgetMonth);
    return r.data;
  },
  updateBudget: async (id, data) => {
    await api.patch(`/finance/budgets/${id}`, data);
    await get().fetchBudgets(activeBudgetMonth);
  },
  deleteBudget: async (id) => {
    await api.delete(`/finance/budgets/${id}`);
    await get().fetchBudgets(activeBudgetMonth);
  },

  fetchGoals: async () => {
    const r = await api.get<{ data: SavingsGoal[] }>('/finance/goals');
    return r.data ?? [];
  },
  saveGoals: async (goals) => {
    const r = await api.put<{ data: SavingsGoal[] }>('/finance/goals', { goals });
    return r.data ?? [];
  },
}));
