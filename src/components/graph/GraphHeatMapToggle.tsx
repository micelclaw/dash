import { Flame } from 'lucide-react';

interface GraphHeatMapToggleProps {
  active: boolean;
  onToggle: () => void;
}

export function GraphHeatMapToggle({ active, onToggle }: GraphHeatMapToggleProps) {
  return (
    <button
      onClick={onToggle}
      title={active ? 'Standard view' : 'Heat map view'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${active ? '#f43f5e' : 'var(--border)'}`,
        background: active ? 'rgba(244, 63, 94, 0.1)' : 'transparent',
        color: active ? '#f43f5e' : 'var(--text-dim)',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
      }}
    >
      <Flame size={12} />
      Heat
    </button>
  );
}
