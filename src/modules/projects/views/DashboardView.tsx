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

import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line,
} from 'recharts';
import { AlertTriangle, Clock } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { PRIORITY_COLORS } from '../utils/design-tokens';

const STATUS_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

export function DashboardView() {
  const cards = useProjectsStore((s) => s.cards);
  const columns = useProjectsStore((s) => s.columns);
  const selectCard = useProjectsStore((s) => s.selectCard);

  const allCards = useMemo(() => Object.values(cards).filter(c => !c.archived), [cards]);
  const columnMap = useMemo(() => new Map(Object.values(columns).map(c => [c.id, c])), [columns]);

  // ─── Cards by status (column) ──────────────────────
  const byStatus = useMemo(() => {
    const counts = new Map<string, { name: string; value: number; color: string }>();
    for (const card of allCards) {
      const col = columnMap.get(card.column_id);
      const name = col?.title ?? 'Unknown';
      const entry = counts.get(card.column_id) ?? { name, value: 0, color: col?.color || STATUS_COLORS[counts.size % STATUS_COLORS.length] };
      entry.value++;
      counts.set(card.column_id, entry);
    }
    return Array.from(counts.values());
  }, [allCards, columnMap]);

  // ─── Cards by priority ─────────────────────────────
  const byPriority = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of allCards) {
      const p = card.priority ?? 'none';
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, fill: PRIORITY_COLORS[name] ?? '#6b7280' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCards]);

  // ─── Overdue cards ─────────────────────────────────
  const overdueCards = useMemo(() => {
    const now = new Date();
    return allCards
      .filter(c => c.due_date && !c.completed_at && new Date(c.due_date) < now)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 10);
  }, [allCards]);

  // ─── Activity by week (created vs completed) ──────
  const weeklyActivity = useMemo(() => {
    const weeks = new Map<string, { week: string; created: number; completed: number }>();
    const now = new Date();

    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const weekKey = `W${getWeekNumber(d)}`;
      weeks.set(weekKey, { week: weekKey, created: 0, completed: 0 });
    }

    for (const card of allCards) {
      const createdWeek = `W${getWeekNumber(new Date(card.created_at))}`;
      if (weeks.has(createdWeek)) {
        weeks.get(createdWeek)!.created++;
      }
      if (card.completed_at) {
        const completedWeek = `W${getWeekNumber(new Date(card.completed_at))}`;
        if (weeks.has(completedWeek)) {
          weeks.get(completedWeek)!.completed++;
        }
      }
    }

    return Array.from(weeks.values());
  }, [allCards]);

  // ─── Summary stats ────────────────────────────────
  const stats = useMemo(() => {
    const total = allCards.length;
    const completed = allCards.filter(c => c.completed_at).length;
    const overdue = overdueCards.length;
    const dueSoon = allCards.filter(c => {
      if (!c.due_date || c.completed_at) return false;
      const d = new Date(c.due_date);
      const now = new Date();
      const diff = d.getTime() - now.getTime();
      return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
    }).length;
    return { total, completed, overdue, dueSoon };
  }, [allCards, overdueCards]);

  if (allCards.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 14 }}>
        No cards yet. Add cards from the Board view to see analytics.
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', height: '100%', padding: 16 }}>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Cards" value={stats.total} />
        <StatCard label="Completed" value={stats.completed} color="var(--success)" />
        <StatCard label="Overdue" value={stats.overdue} color="var(--error)" />
        <StatCard label="Due Soon" value={stats.dueSoon} color="var(--warning)" />
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* By Status Pie */}
        <Widget title="Cards by Status">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={byStatus}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
              >
                {byStatus.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: 'var(--text)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
            {byStatus.map((s) => (
              <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </Widget>

        {/* By Priority Bar */}
        <Widget title="Cards by Priority">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byPriority} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-dim)' }} width={70} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {byPriority.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Widget>

        {/* Weekly Activity */}
        <Widget title="Weekly Activity">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyActivity}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
              />
              <Bar dataKey="created" name="Created" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Widget>

        {/* Overdue cards */}
        <Widget title="Overdue Cards" icon={<AlertTriangle size={14} style={{ color: 'var(--error)' }} />}>
          {overdueCards.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No overdue cards!
            </div>
          ) : (
            <div style={{ maxHeight: 220, overflow: 'auto' }}>
              {overdueCards.map((card) => {
                const col = columnMap.get(card.column_id);
                const daysOverdue = Math.ceil((Date.now() - new Date(card.due_date!).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div
                    key={card.id}
                    onClick={() => selectCard(card.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {card.card_number != null && <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>#{card.card_number}</span>}
                      {card.title}
                    </span>
                    <span style={{ color: 'var(--error)', fontSize: 11, flexShrink: 0, marginLeft: 8 }}>
                      {daysOverdue}d overdue
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Widget>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────

function getWeekNumber(d: Date): number {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '12px 16px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  );
}

function Widget({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text)',
      }}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
