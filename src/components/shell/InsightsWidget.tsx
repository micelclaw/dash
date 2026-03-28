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
import { ThumbsUp, ThumbsDown, X } from 'lucide-react';
import { api } from '@/services/api';

interface Insight {
  id: string;
  insight_type: string;
  title: string;
  content: string;
  relevance_score: number;
  created_at: string;
}

export interface InsightsWidgetHandle {
  refresh: () => void;
}

export const InsightsWidget = forwardRef<InsightsWidgetHandle>(function InsightsWidget(_, ref) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: Insight[] }>('/insights');
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

  if (loading || insights.length === 0) return null;

  return (
    <div className="divide-y divide-[var(--border)]">
      {insights.slice(0, 5).map(insight => (
        <div key={insight.id} className="px-3 py-2.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--text)] mb-0.5">{insight.title}</div>
              {insight.content && (
                <div className="text-[11px] text-[var(--text-dim)] line-clamp-2">{insight.content}</div>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
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
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
