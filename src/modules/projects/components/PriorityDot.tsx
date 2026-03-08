const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  none: '#6b7280',
};

export function PriorityDot({ priority }: { priority: string }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.none,
        flexShrink: 0,
        marginTop: 4,
      }}
    />
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const labels: Record<string, string> = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    none: 'None',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        color: PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.none,
      }}
    >
      <PriorityDot priority={priority} />
      {labels[priority] ?? priority}
    </span>
  );
}
