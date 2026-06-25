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

// Helpers compartidos de la lente Personal.

import type { FinanceTransaction, FinanceAccount, FinanceCategory } from '@/stores/finance-personal.store';

/** Color de acento por defecto cuando una categoría no define color. */
export const CATEGORY_FALLBACK_COLOR = 'var(--mod-finance)';

/**
 * Resuelve la "cara" visual de una categoría: su emoji (campo `icon`) y su color.
 * Devuelve valores listos para pintar — nunca `null`, así los componentes no
 * necesitan repetir el fallback.
 */
export function categoryVisual(cat: FinanceCategory | undefined | null): { emoji: string; color: string; name: string } {
  return {
    emoji: cat?.icon?.trim() || (cat?.kind === 'income' ? '💰' : '🏷️'),
    color: cat?.color?.trim() || CATEGORY_FALLBACK_COLOR,
    name: cat?.name ?? '—',
  };
}

/**
 * Convierte un color (hex `#rrggbb` o `var(--x)`) en un fondo tintado suave para
 * usar como pastilla. Con hex genera un rgba translúcido; con `var()` recurre a
 * `color-mix` (soportado por los navegadores modernos del dash).
 */
export function tintBackground(color: string, alpha = 0.16): string {
  const c = color.trim();
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const int = parseInt(m[1], 16);
    const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `color-mix(in srgb, ${c} ${Math.round(alpha * 100)}%, transparent)`;
}

export function fmtMoney(value: string | number | null | undefined, currency = 'EUR'): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Deriva la "cara" de un movimiento (2 postings) para la lista: importe firmado
 * desde la perspectiva de la cuenta del usuario, la cuenta y la categoría — sin
 * mostrar débito/haber (D13). `accounts` resuelve qué posting es la cuenta del
 * usuario (asset/liability) frente a la cuenta P&L (income/expense).
 */
export function movementFace(tx: FinanceTransaction, accounts: FinanceAccount[]) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const userPosting = tx.postings.find((p) => {
    const a = byId.get(p.account_id);
    return a && (a.type === 'asset' || a.type === 'liability');
  }) ?? tx.postings[0];
  const otherPosting = tx.postings.find((p) => p.id !== userPosting?.id) ?? tx.postings[1];
  // Para la cuenta del usuario: debit = entra (+), credit = sale (−)
  const signed = userPosting
    ? (userPosting.debit != null ? Number(userPosting.amount_base) : -Number(userPosting.amount_base))
    : 0;
  const accountName = byId.get(userPosting?.account_id ?? '')?.name ?? '—';
  const categoryId = otherPosting?.category_id ?? userPosting?.category_id ?? null;
  const isTransfer = tx.postings.length === 2 && tx.postings.every((p) => {
    const a = byId.get(p.account_id);
    return a && (a.type === 'asset' || a.type === 'liability');
  });
  // En una transferencia el dinero SALE de la cuenta con `credit` (origen) y
  // ENTRA en la del `debit` (destino). Solo se calcula cuando hay dos cuentas
  // del usuario; si no se resuelven ambos lados, se dejan undefined y el
  // consumidor recae en el texto "Transferencia".
  let transferFrom: string | undefined;
  let transferTo: string | undefined;
  if (isTransfer) {
    const fromPosting = tx.postings.find((p) => p.credit != null);
    const toPosting = tx.postings.find((p) => p.debit != null);
    if (fromPosting && toPosting) {
      transferFrom = byId.get(fromPosting.account_id)?.name ?? '—';
      transferTo = byId.get(toPosting.account_id)?.name ?? '—';
    }
  }
  return { signed, accountName, categoryId, isTransfer, transferFrom, transferTo, glyph: signed > 0 ? '⟶' : isTransfer ? '⇄' : '⟵' };
}
