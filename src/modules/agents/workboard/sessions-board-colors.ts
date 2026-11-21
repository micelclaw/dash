export const SESSION_BOARD_COLORS: Record<string, { label: string; color: string }> = {
  red: { label: 'Rojo', color: '#ef4444' }, blue: { label: 'Azul', color: '#3b82f6' }, green: { label: 'Verde', color: '#22c55e' },
  yellow: { label: 'Amarillo', color: '#eab308' }, purple: { label: 'Morado', color: '#a855f7' }, orange: { label: 'Naranja', color: '#f97316' },
  pink: { label: 'Rosa', color: '#ec4899' }, cyan: { label: 'Cian', color: '#06b6d4' },
};
export function sessionBoardColor(value: string | undefined): string | undefined {
  return value ? SESSION_BOARD_COLORS[value]?.color ?? (/^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i.test(value) ? value : undefined) : undefined;
}
