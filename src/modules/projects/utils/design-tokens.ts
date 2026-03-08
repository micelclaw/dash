// ─── Layout ──────────────────────────────────────────

export const COLUMN_WIDTH = 280;
export const COLUMN_GAP = 12;
export const CARD_PADDING = 10;
export const CARD_GAP = 8;
export const BOARD_PADDING = 16;

// ─── Priority colors ────────────────────────────────

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  none: '#6b7280',
};

export const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

// ─── Card aging ──────────────────────────────────────

export function getCardAgeOpacity(updatedAt: string, daysToAge: number): number {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays >= daysToAge) return 0.4;
  if (ageDays >= daysToAge / 2) return 0.7;
  return 1;
}

// ─── Position gap ────────────────────────────────────

export const POSITION_GAP = 1000;
