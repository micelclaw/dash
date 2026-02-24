const AGENT_PALETTE = [
  '#d4a017', // amber
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#64748b', // slate
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function getAgentColor(name: string, customColor?: string): string {
  if (customColor) return customColor;
  const index = hashString(name) % AGENT_PALETTE.length;
  return AGENT_PALETTE[index]!;
}
