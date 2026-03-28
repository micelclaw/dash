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

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Clock, GitBranch, FileText, ChevronDown, ChevronRight, Calendar, Users, MessageSquare } from 'lucide-react';
import { api } from '@/services/api';

interface TemporalSignal {
  current_event: { id: string; title: string; ends_at: string } | null;
  next_event: { id: string; title: string; starts_at: string; minutes_until: number } | null;
  time_of_day: string;
  day_type: string;
}

interface RelationalSignal {
  hot_contacts: Array<{ id: string; name: string; heat_score: number }>;
  hot_entities: Array<{ id: string; name: string; type: string; mention_count: number }>;
  active_threads: Array<{ platform: string; channel: string; message_count: number }>;
}

interface ContextSummary {
  summary: string;
}

export function ContextSignals() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [temporal, setTemporal] = useState<TemporalSignal | null>(null);
  const [relational, setRelational] = useState<RelationalSignal | null>(null);
  const [summary, setSummary] = useState<ContextSummary | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const loadPanel = async (panel: string) => {
    if (expanded === panel) {
      setExpanded(null);
      return;
    }
    setExpanded(panel);
    setLoading(prev => ({ ...prev, [panel]: true }));
    try {
      if (panel === 'temporal') {
        const res = await api.get<{ data: TemporalSignal }>('/context/temporal');
        setTemporal(res.data ?? null);
      } else if (panel === 'relational') {
        const res = await api.get<{ data: RelationalSignal }>('/context/relational');
        setRelational(res.data ?? null);
      } else if (panel === 'summary') {
        const res = await api.get<{ data: ContextSummary }>('/context/summary');
        setSummary(res.data ?? null);
      }
    } catch {
      // optional endpoint
    }
    setLoading(prev => ({ ...prev, [panel]: false }));
  };

  const panels = [
    { id: 'temporal', label: 'Temporal', icon: Clock },
    { id: 'relational', label: 'Relational', icon: GitBranch },
    { id: 'summary', label: 'Summary', icon: FileText },
  ];

  const renderTemporal = () => {
    if (!temporal) return <div className="text-[11px] text-[var(--text-muted)] py-2">No temporal data</div>;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          <Clock size={10} className="text-[var(--text-muted)] flex-shrink-0" />
          <span className="text-[var(--text)]">{temporal.time_of_day} · {temporal.day_type}</span>
        </div>
        {temporal.current_event && (
          <div className="flex items-center gap-2 text-[11px]">
            <Calendar size={10} className="text-amber-400 flex-shrink-0" />
            <button
              onClick={() => navigate(`/calendar?id=${temporal.current_event!.id}`)}
              className="text-[var(--text)] hover:text-[var(--accent)] hover:underline text-left"
            >
              Now: {temporal.current_event.title}
            </button>
          </div>
        )}
        {temporal.next_event && (
          <div className="flex items-center gap-2 text-[11px]">
            <Calendar size={10} className="text-[var(--text-muted)] flex-shrink-0" />
            <button
              onClick={() => navigate(`/calendar?id=${temporal.next_event!.id}`)}
              className="text-[var(--text)] hover:text-[var(--accent)] hover:underline text-left"
            >
              Next: {temporal.next_event.title}
              <span className="text-[var(--text-muted)] ml-1">in {temporal.next_event.minutes_until}min</span>
            </button>
          </div>
        )}
        {!temporal.current_event && !temporal.next_event && (
          <div className="text-[11px] text-[var(--text-muted)]">No upcoming events</div>
        )}
      </div>
    );
  };

  const renderRelational = () => {
    if (!relational) return <div className="text-[11px] text-[var(--text-muted)] py-2">No relational data</div>;
    const contacts = relational.hot_contacts ?? [];
    const entities = relational.hot_entities ?? [];
    const threads = relational.active_threads ?? [];
    if (contacts.length === 0 && entities.length === 0 && threads.length === 0) {
      return <div className="text-[11px] text-[var(--text-muted)] py-2">No active relationships</div>;
    }
    return (
      <div className="space-y-1.5">
        {contacts.slice(0, 3).map(c => (
          <div key={c.id} className="flex items-center gap-2 text-[11px]">
            <Users size={10} className="text-[var(--text-muted)] flex-shrink-0" />
            <button
              onClick={() => navigate(`/contacts?id=${c.id}`)}
              className="text-[var(--text)] hover:text-[var(--accent)] hover:underline text-left"
            >
              {c.name}
            </button>
            <span className="text-[var(--text-muted)]">{Math.round(c.heat_score * 100)}%</span>
          </div>
        ))}
        {entities.slice(0, 3).map(e => (
          <div key={e.id} className="flex items-center gap-2 text-[11px]">
            <GitBranch size={10} className="text-[var(--text-muted)] flex-shrink-0" />
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-graph', { detail: { entityId: e.id } }))}
              className="text-[var(--text)] hover:text-[var(--accent)] hover:underline text-left"
            >
              {e.name}
            </button>
            <span className="text-[var(--text-muted)]">{e.type} · {e.mention_count} mentions</span>
          </div>
        ))}
        {threads.slice(0, 3).map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <MessageSquare size={10} className="text-[var(--text-muted)] flex-shrink-0" />
            <span className="text-[var(--text)]">{t.channel}</span>
            <span className="text-[var(--text-muted)]">{t.platform} · {t.message_count} msgs</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {panels.map(panel => {
        const Icon = panel.icon;
        const isOpen = expanded === panel.id;
        const isLoading = loading[panel.id];
        return (
          <div key={panel.id}>
            <button
              onClick={() => loadPanel(panel.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] border-b border-[var(--border)]"
            >
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Icon size={12} />
              {panel.label}
            </button>
            {isOpen && (
              <div className="px-3 py-2 border-b border-[var(--border)]">
                {isLoading ? (
                  <div className="text-[11px] text-[var(--text-muted)] py-2">Loading...</div>
                ) : panel.id === 'temporal' ? (
                  renderTemporal()
                ) : panel.id === 'relational' ? (
                  renderRelational()
                ) : panel.id === 'summary' && summary?.summary ? (
                  <div className="text-[11px] text-[var(--text-dim)] whitespace-pre-wrap py-1">
                    {summary.summary}
                  </div>
                ) : (
                  <div className="text-[11px] text-[var(--text-muted)] py-2">No summary available</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
