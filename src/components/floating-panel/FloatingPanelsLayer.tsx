import { Calculator as CalculatorIcon, ArrowLeftRight, Timer, Mic } from 'lucide-react';
import { useFloatingPanelsStore, type PanelId } from '@/stores/floating-panels.store';
import { FloatingPanel } from './FloatingPanel';
import { Calculator } from '@/modules/tools/calculator/Calculator';
import { Converter } from '@/modules/tools/converter/Converter';
import { PomodoroTimer } from '@/modules/tools/pomodoro/PomodoroTimer';
import { VoiceRecorder } from '@/modules/tools/voice-recorder/VoiceRecorder';

const PANEL_META: Record<PanelId, { title: string; icon: React.ReactNode }> = {
  calculator:       { title: 'Calculator',      icon: <CalculatorIcon size={14} style={{ color: 'var(--mod-tools)' }} /> },
  converter:        { title: 'Converter',       icon: <ArrowLeftRight size={14} style={{ color: 'var(--mod-tools)' }} /> },
  pomodoro:         { title: 'Pomodoro',        icon: <Timer size={14} style={{ color: 'var(--mod-tools)' }} /> },
  'voice-recorder': { title: 'Voice Recorder',  icon: <Mic size={14} style={{ color: 'var(--mod-tools)' }} /> },
};

const PANEL_CONTENT: Record<PanelId, React.ReactNode> = {
  calculator:       <Calculator />,
  converter:        <Converter />,
  pomodoro:         <PomodoroTimer />,
  'voice-recorder': <VoiceRecorder />,
};

export function FloatingPanelsLayer() {
  const panels = useFloatingPanelsStore((s) => s.panels);

  if (panels.size === 0) return null;

  const entries = Array.from(panels.entries()).filter(([, p]) => !p.minimized);
  if (entries.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 250,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {entries.map(([id]) => {
          const meta = PANEL_META[id];
          return (
            <FloatingPanel key={id} id={id} title={meta.title} icon={meta.icon}>
              {PANEL_CONTENT[id]}
            </FloatingPanel>
          );
        })}
      </div>
    </div>
  );
}
