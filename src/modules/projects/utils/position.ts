const POSITION_GAP = 1000;

export function calculatePosition(
  items: { position: number; id: string }[],
  targetIndex: number,
  excludeId?: string,
): number {
  const filtered = excludeId ? items.filter((i) => i.id !== excludeId) : items;
  const sorted = [...filtered].sort((a, b) => a.position - b.position);

  if (sorted.length === 0) return POSITION_GAP;
  if (targetIndex <= 0) return sorted[0].position / 2;
  if (targetIndex >= sorted.length) return sorted[sorted.length - 1].position + POSITION_GAP;

  const before = sorted[targetIndex - 1].position;
  const after = sorted[targetIndex].position;
  return (before + after) / 2;
}
