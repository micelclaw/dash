/** Shared Office application and chip palette. */
export const OFFICE_COLORS = {
  documents: '#3b82f6',
  spreadsheets: '#22c55e',
  presentations: '#eab308',
  pdf: '#ef4444',
  databases: '#a855f7',
} as const;

export function officeColor(id?: string): string | undefined {
  return id && Object.prototype.hasOwnProperty.call(OFFICE_COLORS, id) ? OFFICE_COLORS[id as keyof typeof OFFICE_COLORS] : undefined;
}
