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

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router';
import {
  ThumbsUp, ThumbsDown, X, TrendingUp, Brain, Zap, Bell,
  Clock, Lightbulb, AlertTriangle, CheckCircle, Sparkles, ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/services/api';

interface UnifiedInsight {
  id: string;
  source: 'persistent' | 'runtime';
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  body: string;
  signals?: string[];
  action?: { type: string; payload: Record<string, unknown> };
  created_at: string;
}

export interface InsightsWidgetHandle {
  refresh: () => void;
}

const INSIGHT_STYLES: Record<string, { icon: LucideIcon; color: string }> = {
  weekly_summary:        { icon: TrendingUp,     color: 'text-blue-400' },
  connection_discovered: { icon: Brain,           color: 'text-purple-400' },
  pattern_detected:      { icon: Zap,             color: 'text-amber-400' },
  reminder_suggestion:   { icon: Bell,            color: 'text-orange-400' },
  reminder:              { icon: Clock,           color: 'text-orange-400' },
  suggestion:            { icon: Lightbulb,       color: 'text-green-400' },
  alert:                 { icon: AlertTriangle,   color: 'text-red-400' },
  briefing:              { icon: TrendingUp,      color: 'text-blue-400' },
  optimization:          { icon: Zap,             color: 'text-amber-400' },
  anomaly_detected:      { icon: AlertTriangle,   color: 'text-red-400' },
  opportunity_found:     { icon: Sparkles,        color: 'text-cyan-400' },
};

const PRIORITY_BORDER: Record<string, string> = {
  high: 'border-l-red-400',
  medium: 'border-l-amber-400',
  low: 'border-l-transparent',
};

const DEFAULT_STYLE = { icon: Lightbulb, color: 'text-[var(--text-muted)]' };

export const InsightsWidget = forwardRef<InsightsWidgetHandle>(function InsightsWidget(_, ref) {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<UnifiedInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: UnifiedInsight[] }>('/insights/unified');
      const list = Array.isArray(res.data) ? res.data : [];
      setInsights(list);
    } catch {
      // pro tier — may not be available
    }
    setLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  useEffect(() => { load(); }, [load]);

  const sendFeedback = async (id: string, feedback: 'useful' | 'not_useful') => {
    try {
      await api.post(`/insights/${id}/feedback`, { feedback });
      setInsights(prev => prev.filter(i => i.id !== id));
    } catch {
      // silent
    }
  };

  const dismiss = async (id: string) => {
    try {
      await api.post(`/insights/${id}/feedback`, { feedback: 'dismiss' });
    } catch {
      // silent
    }
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const handleAction = (action: UnifiedInsight['action']) => {
    if (!action) return;
    if (action.type === 'navigate' && action.payload.route) {
      navigate(action.payload.route as string);
    }
  };

  if (loading) return null;

  if (insights.length === 0) {
    return (
      <div className="px-3 py-3 text-center">
        <CheckCircle size={14} className="text-green-400 mx-auto mb-1" />
        <div className="text-[11px] text-[var(--text-muted)]">Todo al dia</div>
      </div>
    );
  }

  const visibleCount = expanded ? 5 : 3;

  return (
    <div className="divide-y divide-[var(--border)]">
      {insights.slice(0, visibleCount).map(insight => {
        const style = INSIGHT_STYLES[insight.type] ?? DEFAULT_STYLE;
        const Icon = style.icon;
        const borderClass = PRIORITY_BORDER[insight.priority] ?? 'border-l-transparent';

        return (
          <div key={insight.id} className={`px-3 py-2.5 border-l-2 ${borderClass}`}>
            <div className="flex items-start gap-2">
              <Icon size={12} className={`${style.color} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--text)] mb-0.5">{insight.title}</div>
                {insight.body && (
                  <div className="text-[11px] text-[var(--text-dim)] line-clamp-2">{insight.body}</div>
                )}
                {insight.action && (
                  <button
                    onClick={() => handleAction(insight.action)}
                    className="text-[10px] text-[var(--accent)] hover:underline mt-0.5"
                  >
                    Abrir
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {insight.source === 'persistent' && (
                  <>
                    <button
                      onClick={() => sendFeedback(insight.id, 'useful')}
                      className="p-1 rounded hover:bg-green-500/10 text-[var(--text-muted)] hover:text-green-400"
                      title="Useful — helps train future insights"
                    >
                      <ThumbsUp size={11} />
                    </button>
                    <button
                      onClick={() => sendFeedback(insight.id, 'not_useful')}
                      className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400"
                      title="Not useful — reduces similar insights"
                    >
                      <ThumbsDown size={11} />
                    </button>
                    <button
                      onClick={() => dismiss(insight.id)}
                      className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
                      title="Dismiss this insight"
                    >
                      <X size={11} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {insights.length > 3 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-[var(--accent)] hover:bg-[var(--surface-hover)]"
        >
          <ChevronDown size={10} />
          Ver {Math.min(insights.length, 5) - 3} mas
        </button>
      )}
    </div>
  );
});
