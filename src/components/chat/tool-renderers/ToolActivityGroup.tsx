/** Copyright (c) 2026 Micelclaw (Víctor García Valdunciel). */
import { useId, useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronRight } from 'lucide-react';
import type { ToolCallRecord } from '@/types/chat';
import { ProgressiveToolBlock, getToolPresentation } from './ProgressiveToolBlock';
import { SpawnToolBlock } from './SpawnToolBlock';
import { classify } from '@/config/tool-rendering';

export function ToolActivityGroup({ tools, onOpenTechnicalCanvas }: { tools: ToolCallRecord[]; onOpenTechnicalCanvas?: (value: { title: string; content: string }) => void }) {
  // Una delegación es un hito de conversación, no telemetría secundaria. Al
  // coincidir con otras calls en el mismo segmento (p.ej. sessions_list), se
  // mantiene visible y el resto continúa agrupado como actividad técnica.
  const delegatedTools = useMemo(() => tools.filter((tool) => classify(tool.tool).renderer === 'spawn'), [tools]);
  const activityTools = useMemo(() => tools.filter((tool) => classify(tool.tool).renderer !== 'spawn'), [tools]);
  const presentations = useMemo(() => activityTools.map(getToolPresentation), [activityTools]);
  const forceOpen = presentations.some((p) => p.state === 'error' || p.state === 'approval');
  const [open, setOpen] = useState(false);
  const [dismissedAutoKey, setDismissedAutoKey] = useState<string | null>(null);
  const regionId = useId();
  const autoKey = forceOpen
    ? presentations.map((presentation, index) => presentation.state === 'error' || presentation.state === 'approval'
      ? `${activityTools[index]!.id}:${presentation.state}` : null).filter(Boolean).join('|')
    : null;
  const isOpen = (autoKey != null && dismissedAutoKey !== autoKey) || open;
  const toggleOpen = () => {
    if (autoKey && dismissedAutoKey !== autoKey) {
      setDismissedAutoKey(autoKey);
      setOpen(false);
      return;
    }
    if (autoKey && dismissedAutoKey === autoKey) {
      setDismissedAutoKey(null);
      return;
    }
    setOpen((value) => !value);
  };
  if (activityTools.length === 0) {
    return <div style={{ display: 'grid', gap: 6 }}>{delegatedTools.map((tool) => <SpawnToolBlock key={tool.id} tool={tool} />)}</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {delegatedTools.map((tool) => <SpawnToolBlock key={tool.id} tool={tool} />)}
    <section style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--card)' }} aria-label={`Actividad, ${tools.length} tools`}>
      <button type="button" aria-expanded={isOpen} aria-controls={regionId} onClick={toggleOpen} style={{
        width: '100%', border: 0, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 7,
        background: 'transparent', color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
      }}>
        <Activity size={14} aria-hidden style={{ color: 'var(--text-muted)' }} />
        <strong style={{ fontSize: '0.78rem', flex: 1 }}>Actividad · {activityTools.length} tool{activityTools.length === 1 ? '' : 's'}</strong>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isOpen && <div id={regionId} style={{ borderTop: '1px solid var(--border)', padding: 7, display: 'grid', gap: 6 }}>
        {activityTools.map((tool) => <ProgressiveToolBlock key={tool.id} tool={tool} onOpenTechnicalCanvas={onOpenTechnicalCanvas} nested />)}
      </div>}
    </section>
    </div>
  );
}
