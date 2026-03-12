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

import React, { useCallback, useMemo } from 'react';
import { Calendar, CheckSquare, MessageSquare, GitBranch, Hash } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { PRIORITY_COLORS, getCardAgeOpacity } from '../utils/design-tokens';
import type { Card, CustomFieldDef } from '../types';

const OVERDUE_COLOR = 'var(--error)';

function isOverdue(dueDate: string | null, completedAt: string | null): boolean {
  if (!dueDate || completedAt) return false;
  return new Date(dueDate) < new Date();
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface KanbanCardProps {
  card: Card;
  showLabelsText?: boolean;
  showCardNumbers?: boolean;
  cardAging?: { enabled: boolean; daysToAge: number };
  commentCount?: number;
  dependencyCount?: number;
}

export const KanbanCard = React.memo(function KanbanCard({
  card,
  showLabelsText = false,
  showCardNumbers = true,
  cardAging,
  commentCount = 0,
  dependencyCount = 0,
}: KanbanCardProps) {
  const selectCard = useProjectsStore((s) => s.selectCard);
  const labels = useProjectsStore((s) => s.labels);
  const cardLabelIds = useProjectsStore((s) => s.cardLabelIds);
  const multiSelectedIds = useProjectsStore((s) => s.multiSelectedIds);
  const toggleMultiSelect = useProjectsStore((s) => s.toggleMultiSelect);
  const customFieldDefs = useProjectsStore((s) => s.customFieldDefs);

  const overdue = isOverdue(card.due_date, card.completed_at);
  const checklist = card.checklist ?? [];
  const checked = checklist.filter((c) => c.checked).length;
  const isSelected = multiSelectedIds.has(card.id);
  const cardLabels = (cardLabelIds[card.id] ?? []).map(id => labels[id]).filter(Boolean);

  // Card aging opacity
  const agingOpacity = cardAging?.enabled
    ? getCardAgeOpacity(card.updated_at, cardAging.daysToAge)
    : 1;

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      toggleMultiSelect(card.id);
      return;
    }
    selectCard(card.id);
  }, [card.id, selectCard, toggleMultiSelect]);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMultiSelect(card.id);
  }, [card.id, toggleMultiSelect]);

  // Cover rendering
  const hasCover = !!(card.cover_color || card.cover_image_id);
  const coverSize = card.cover_size ?? 'normal';

  return (
    <div
      onClick={handleClick}
      style={{
        background: coverSize === 'full' && card.cover_color
          ? card.cover_color
          : 'var(--card)',
        border: isSelected
          ? '2px solid var(--primary)'
          : '1px solid var(--border)',
        borderRadius: 6,
        cursor: 'pointer',
        borderLeft: !isSelected && card.color
          ? `3px solid ${card.color}`
          : undefined,
        transition: 'border-color 0.15s, opacity 0.3s',
        opacity: agingOpacity,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Cover strip (normal size) */}
      {hasCover && coverSize === 'normal' && (
        <div style={{
          height: 40,
          background: card.cover_color ?? 'var(--surface)',
          borderRadius: '6px 6px 0 0',
        }} />
      )}

      {/* Multi-select checkbox */}
      <div
        className="kanban-card-checkbox"
        onClick={handleCheckboxClick}
        style={{
          position: 'absolute',
          top: hasCover && coverSize === 'normal' ? 46 : 6,
          left: 6,
          width: 16,
          height: 16,
          borderRadius: 3,
          border: isSelected ? '2px solid var(--primary)' : '1.5px solid var(--border)',
          background: isSelected ? 'var(--primary)' : 'transparent',
          display: isSelected ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          cursor: 'pointer',
        }}
      >
        {isSelected && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 3.5L3.5 6L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div style={{ padding: '10px 12px' }}>
        {/* Label pills */}
        {cardLabels.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {cardLabels.map((label) => (
              showLabelsText ? (
                <span
                  key={label.id}
                  style={{
                    background: label.color + '22',
                    color: label.color,
                    fontSize: 10,
                    fontWeight: 500,
                    padding: '1px 6px',
                    borderRadius: 3,
                    lineHeight: '16px',
                  }}
                >
                  {label.name}
                </span>
              ) : (
                <span
                  key={label.id}
                  title={label.name}
                  style={{
                    width: 24,
                    height: 6,
                    borderRadius: 3,
                    background: label.color,
                  }}
                />
              )
            ))}
          </div>
        )}

        {/* Title row: priority dot + card number + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          {card.priority && card.priority !== 'none' && (
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: PRIORITY_COLORS[card.priority] ?? PRIORITY_COLORS.none,
              flexShrink: 0,
              marginTop: 4,
            }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {showCardNumbers && card.card_number != null && (
              <span style={{
                color: 'var(--text-muted)',
                fontSize: 10,
                fontWeight: 500,
                marginRight: 4,
              }}>
                #{card.card_number}
              </span>
            )}
            <span style={{
              color: coverSize === 'full' && card.cover_color ? '#fff' : 'var(--text)',
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}>
              {card.title.length > 200 ? card.title.slice(0, 200) + '…' : card.title}
            </span>
          </div>
        </div>

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {card.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text-dim)',
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 3,
                }}
              >
                {tag}
              </span>
            ))}
            {card.tags.length > 3 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                +{card.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Custom field pills (max 3, only show_on_card fields) */}
        {(() => {
          const cf = card.custom_fields as Record<string, unknown> | null;
          if (!cf) return null;
          const visibleDefs = Object.values(customFieldDefs)
            .filter(fd => fd.show_on_card && cf[fd.id] != null && cf[fd.id] !== '')
            .sort((a, b) => a.position - b.position)
            .slice(0, 3);
          if (visibleDefs.length === 0) return null;
          return (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {visibleDefs.map(fd => (
                <span key={fd.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  background: 'var(--surface)', fontSize: 10, padding: '1px 5px',
                  borderRadius: 3, color: 'var(--text-dim)', maxWidth: 120,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  <span style={{ opacity: 0.6 }}>{fd.name}:</span>
                  {fd.type === 'checkbox'
                    ? (cf[fd.id] ? '✓' : '✗')
                    : fd.type === 'date'
                    ? new Date(String(cf[fd.id])).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : String(cf[fd.id])}
                </span>
              ))}
            </div>
          );
        })()}

        {/* Footer: due date + checklist + comments + dependencies + assignees */}
        {(card.due_date || checklist.length > 0 || commentCount > 0 || dependencyCount > 0 || (card.assignee_ids && card.assignee_ids.length > 0)) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
            flexWrap: 'wrap',
          }}>
            {card.due_date && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  color: overdue ? OVERDUE_COLOR : 'var(--text-dim)',
                  background: overdue ? 'var(--error-bg, rgba(239,68,68,0.1))' : undefined,
                  padding: overdue ? '1px 4px' : undefined,
                  borderRadius: 3,
                }}
              >
                <Calendar size={11} />
                {formatDate(card.due_date)}
              </span>
            )}

            {checklist.length > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  color: checked === checklist.length ? 'var(--success)' : 'var(--text-dim)',
                }}
              >
                <CheckSquare size={11} />
                {checked}/{checklist.length}
              </span>
            )}

            {commentCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  color: 'var(--text-dim)',
                }}
              >
                <MessageSquare size={11} />
                {commentCount}
              </span>
            )}

            {dependencyCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  color: 'var(--warning, #f59e0b)',
                }}
                title={`${dependencyCount} dependencies`}
              >
                <GitBranch size={11} />
                {dependencyCount}
              </span>
            )}

            {/* Spacer to push assignees right */}
            {card.assignee_ids && card.assignee_ids.length > 0 && (
              <>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
                  {card.assignee_ids.slice(0, 3).map((aid, i) => (
                    <div
                      key={aid}
                      title={aid}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: `hsl(${hashCode(aid) % 360}, 60%, 45%)`,
                        border: '2px solid var(--card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 600,
                        color: '#fff',
                        marginLeft: i > 0 ? -6 : 0,
                      }}
                    >
                      {aid.slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                  {card.assignee_ids.length > 3 && (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'var(--surface)',
                        border: '2px solid var(--card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 500,
                        color: 'var(--text-dim)',
                        marginLeft: -6,
                      }}
                    >
                      +{card.assignee_ids.length - 3}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/** Simple string hash for consistent avatar colors */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
