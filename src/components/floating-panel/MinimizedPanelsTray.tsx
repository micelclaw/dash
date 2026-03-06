import { Calculator, ArrowLeftRight, Timer, Mic } from 'lucide-react';
import { useFloatingPanelsStore, type PanelId } from '@/stores/floating-panels.store';

const PANEL_ICONS: Record<PanelId, { icon: React.ReactNode; label: string }> = {
  calculator:       { icon: <Calculator size={16} />,      label: 'Calculator' },
  converter:        { icon: <ArrowLeftRight size={16} />,  label: 'Converter' },
  pomodoro:         { icon: <Timer size={16} />,           label: 'Pomodoro' },
  'voice-recorder': { icon: <Mic size={16} />,            label: 'Voice Recorder' },
};

export function MinimizedPanelsTray() {
  const panels = useFloatingPanelsStore((s) => s.panels);
  const restorePanel = useFloatingPanelsStore((s) => s.restorePanel);

  const minimized = Array.from(panels.entries()).filter(([, p]) => p.minimized);
  if (minimized.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 52,
        right: 12,
        zIndex: 251,
        display: 'flex',
        gap: 4,
      }}
    >
      {minimized.map(([id]) => {
        const meta = PANEL_ICONS[id];
        return (
          <button
            key={id}
            onClick={() => restorePanel(id)}
            title={meta.label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              color: 'var(--mod-tools)',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--card)'; }}
          >
            {meta.icon}
          </button>
        );
      })}
    </div>
  );
}
