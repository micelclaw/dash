interface RankingSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  disabled?: boolean;
}

export function RankingSlider({ label, value, onChange, color, disabled }: RankingSliderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: disabled ? 0.4 : 1 }}>
      <span style={{
        fontSize: '0.6875rem',
        color: 'var(--text-dim)',
        width: 64,
        flexShrink: 0,
        fontFamily: 'var(--font-sans)',
      }}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={e => onChange(Number(e.target.value) / 100)}
        disabled={disabled}
        style={{
          flex: 1,
          accentColor: color,
          height: 4,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      />
      <span style={{
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
        width: 28,
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {(value * 100).toFixed(0)}
      </span>
    </div>
  );
}
