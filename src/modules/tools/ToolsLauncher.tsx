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

import { Calculator, ArrowLeftRight, Timer, Mic } from 'lucide-react';
import { useFloatingPanelsStore, type PanelId } from '@/stores/floating-panels.store';

interface ToolCard {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  panelId: PanelId;
}

// El whiteboard se movió al módulo Sketches (/sketches — sección Whiteboards).
// Tools queda como launcher de utilities; las network utilities futuras se
// añaden a este array.
const UTILITIES: ToolCard[] = [
  { id: 'calculator', label: 'Calculator', description: 'Scientific calculator', icon: <Calculator size={28} />, panelId: 'calculator' },
  { id: 'converter', label: 'Converter', description: 'Units & currency', icon: <ArrowLeftRight size={28} />, panelId: 'converter' },
  { id: 'pomodoro', label: 'Pomodoro', description: 'Timer & stopwatch', icon: <Timer size={28} />, panelId: 'pomodoro' },
  { id: 'voice-recorder', label: 'Recorder', description: 'Voice recorder', icon: <Mic size={28} />, panelId: 'voice-recorder' },
];

export function ToolsLauncher() {
  const openPanel = useFloatingPanelsStore((s) => s.openPanel);

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: 24 }}>Tools</h1>

      {/* Utilities section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12,
        }}>
          Utilities
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {UTILITIES.map((tool) => (
            <ToolCardButton key={tool.id} tool={tool} onClick={() => openPanel(tool.panelId)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolCardButton({ tool, onClick }: { tool: ToolCard; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '20px 16px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        color: 'var(--text)',
        transition: 'border-color var(--transition-fast), background var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--mod-tools)';
        (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLElement).style.background = 'var(--card)';
      }}
    >
      <div style={{ color: 'var(--mod-tools)' }}>{tool.icon}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{tool.label}</div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{tool.description}</div>
      <div style={{
        fontSize: '0.625rem', color: 'var(--text-muted)',
        padding: '2px 6px', background: 'var(--surface)',
        borderRadius: 'var(--radius-sm)', marginTop: 2,
      }}>
        Opens as panel
      </div>
    </button>
  );
}
