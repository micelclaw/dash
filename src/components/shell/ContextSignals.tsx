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
import { Clock, GitBranch, FileText, ChevronDown, ChevronRight, Calendar, Users, MessageSquare, SquareKanban } from 'lucide-react';
import { api } from '@/services/api';

interface TimelineItem {
  id: string;
  title: string;
  source: 'event' | 'kanban';
  starts_at: string;
  ends_at: string | null;
  minutes_until: number;
  board?: string;
  active: boolean;
}

interface TemporalSignal {
  current_event: { id: string; title: string; ends_at: string } | null;
  next_event: { id: string; title: string; starts_at: string; minutes_until: number } | null;
  time_of_day: string;
  day_type: string;
  timeline: {
    now: TimelineItem[];
    next_hour: TimelineItem[];
    today: TimelineItem[];
    tomorrow: TimelineItem[];
  };
}

interface RelationalSignal {
  hot_contacts: Array<{ id: string; name: string; heat_score: number }>;
  hot_entities: Array<{ id: string; name: string; type: string; mention_count: number }>;
  active_threads: Array<{ platform: string; channel: string; message_count: number }>;
  recent_files: Array<{ id: string; name: string; domain: string; updated_at: string }>;
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
    { id: 'temporal', label: 'Temporal', icon: Clock, color: 'text-cyan-400', border: 'border-l-cyan-400' },
    { id: 'relational', label: 'Relational', icon: GitBranch, color: 'text-purple-400', border: 'border-l-purple-400' },
    { id: 'summary', label: 'Summary', icon: FileText, color: 'text-emerald-400', border: 'border-l-emerald-400' },
  ];

  const navigateItem = (item: TimelineItem) => {
    if (item.source === 'kanban') navigate(`/projects?card=${item.id}`);
    else navigate(`/calendar?id=${item.id}`);
  };

  const ItemIcon = ({ source, className }: { source: string; className?: string }) =>
    source === 'kanban'
      ? <SquareKanban size={10} className={className} />
      : <Calendar size={10} className={className} />;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  };

  const renderTimelineItem = (item: TimelineItem, detail: 'full' | 'medium' | 'compact' | 'minimal') => {
    const endsIn = item.ends_at ? Math.max(0, Math.round((new Date(item.ends_at).getTime() - Date.now()) / 60_000)) : null;

    return (
      <div key={`${item.source}-${item.id}`} className="flex items-start gap-2 text-[11px]">
        <ItemIcon source={item.source} className={item.active ? 'text-amber-400 flex-shrink-0 mt-0.5' : 'text-[var(--text-muted)] flex-shrink-0 mt-0.5'} />
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigateItem(item)}
            className="text-[var(--text)] hover:text-[var(--accent)] hover:underline text-left truncate block w-full"
          >
            {item.title}
          </button>
          {detail === 'full' && (
            <div className="text-[10px] text-[var(--text-muted)]">
              {item.active && endsIn !== null && `Termina en ${endsIn} min`}
              {item.active && endsIn !== null && item.board && ' · '}
              {item.board && <span className="text-[var(--text-dim)]">{item.board}</span>}
              {!item.active && item.ends_at && <span> · {formatTime(item.starts_at)} - {formatTime(item.ends_at)}</span>}
            </div>
          )}
          {detail === 'medium' && (
            <div className="text-[10px] text-[var(--text-muted)]">
              {item.minutes_until > 0 ? `en ${item.minutes_until} min` : formatTime(item.starts_at)}
              {item.board && ` · ${item.board}`}
            </div>
          )}
          {detail === 'compact' && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {formatTime(item.starts_at)}{item.board ? ` · ${item.board}` : ''}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderTemporal = () => {
    if (!temporal) return <div className="text-[11px] text-[var(--text-muted)] py-2">No temporal data</div>;

    const tl = temporal.timeline;
    const hasTimeline = tl && (tl.now?.length > 0 || tl.next_hour?.length > 0 || tl.today?.length > 0 || tl.tomorrow?.length > 0);

    return (
      <div className="space-y-2">
        {/* Time context */}
        <div className="flex items-center gap-2 text-[11px]">
          <Clock size={10} className="text-[var(--text-muted)] flex-shrink-0" />
          <span className="text-[var(--text)]">{temporal.time_of_day} · {temporal.day_type}</span>
        </div>

        {/* Now — full detail */}
        {tl?.now?.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">Ahora</div>
            {tl.now.map(item => renderTimelineItem(item, 'full'))}
          </div>
        )}

        {/* Next hour — medium detail */}
        {tl?.next_hour?.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Proxima hora</div>
            {tl.next_hour.slice(0, 3).map(item => renderTimelineItem(item, 'medium'))}
          </div>
        )}

        {/* Today (1-8h) — compact */}
        {tl?.today?.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Hoy</div>
            {tl.today.slice(0, 4).map(item => renderTimelineItem(item, 'compact'))}
          </div>
        )}

        {/* Tomorrow — minimal */}
        {tl?.tomorrow?.length > 0 && (
          <div className="space-y-0.5">
            <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Mañana</div>
            {tl.tomorrow.slice(0, 3).map(item => (
              <div key={`${item.source}-${item.id}`} className="flex items-center gap-2 text-[10px] text-[var(--text-dim)]">
                <ItemIcon source={item.source} className="text-[var(--text-muted)] flex-shrink-0" />
                <span className="truncate">{item.title}</span>
                <span className="text-[var(--text-muted)] flex-shrink-0">{formatTime(item.starts_at)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Fallback to legacy fields if no timeline data */}
        {!hasTimeline && (
          <>
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
              <div className="text-[11px] text-[var(--text-muted)]">Sin eventos proximos</div>
            )}
          </>
        )}
      </div>
    );
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.round(hours / 24)}d`;
  };

  const renderRelational = () => {
    if (!relational) return <div className="text-[11px] text-[var(--text-muted)] py-2">No relational data</div>;
    const contacts = relational.hot_contacts ?? [];
    const entities = relational.hot_entities ?? [];
    const threads = relational.active_threads ?? [];
    const recentFiles = relational.recent_files ?? [];
    if (contacts.length === 0 && entities.length === 0 && threads.length === 0 && recentFiles.length === 0) {
      return <div className="text-[11px] text-[var(--text-muted)] py-2">No active relationships</div>;
    }
    return (
      <div className="space-y-1.5">
        {recentFiles.slice(0, 3).map(f => (
          <div key={f.id} className="flex items-center gap-2 text-[11px]">
            <FileText size={10} className="text-blue-400 flex-shrink-0" />
            <button
              onClick={() => navigate(`/${f.domain}/${f.id}`)}
              className="text-[var(--text)] hover:text-[var(--accent)] hover:underline text-left truncate"
            >
              {f.name}
            </button>
            <span className="text-[var(--text-muted)] flex-shrink-0">{timeAgo(f.updated_at)}</span>
          </div>
        ))}
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
              <Icon size={12} className={panel.color} />
              <span className={isOpen ? panel.color : ''}>{panel.label}</span>
            </button>
            {isOpen && (
              <div className={`px-3 py-2 border-b border-[var(--border)] border-l-2 ${panel.border}`}>
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
