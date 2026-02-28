import { getHeatTier, HEAT_COLORS } from '@/types/intelligence';

interface HeatBadgeProps {
  score: number;
  size?: number;
}

export function HeatBadge({ score, size = 8 }: HeatBadgeProps) {
  if (!score || score <= 0) return null;

  const tier = getHeatTier(score);
  const color = HEAT_COLORS[tier];

  return (
    <span
      title={`Heat: ${(score * 100).toFixed(0)}% (${tier})`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}
