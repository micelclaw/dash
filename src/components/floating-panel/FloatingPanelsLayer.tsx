/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useRef } from 'react';
import { Calculator as CalculatorIcon, ArrowLeftRight, Timer, Mic } from 'lucide-react';
import { useFloatingPanelsStore, type PanelId } from '@/stores/floating-panels.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { useBackGuard } from '@/hooks/use-back-guard';
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
  const closePanel = useFloatingPanelsStore((s) => s.closePanel);
  const isMobile = useIsMobile();

  const entries = Array.from(panels.entries()).filter(([, p]) => !p.minimized);
  const anyOpen = entries.length > 0;

  // Botón "atrás" de Android/navegador cierra el overlay del tool (antes no hacía nada:
  // los paneles son un store global, no rutas, así que el back navegaba por debajo y el
  // overlay seguía encima). Se cierran todos los paneles visibles. Solo en móvil (donde el
  // panel es overlay a pantalla completa). Mecanismo compartido en useBackGuard.
  const visibleIdsRef = useRef<PanelId[]>([]);
  visibleIdsRef.current = entries.map(([id]) => id);
  useBackGuard(anyOpen, () => visibleIdsRef.current.forEach((id) => closePanel(id)), isMobile);

  if (!anyOpen) return null;

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
