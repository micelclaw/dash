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

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trash2, Plus, Check, MessageSquare, GitBranch, Tag, Archive, Link, FileText, Calendar, Mail, User, File, Bookmark, ExternalLink } from 'lucide-react';
import { useProjectsStore } from '@/stores/projects.store';
import { api } from '@/services/api';
import { PriorityBadge } from './PriorityDot';
import { EntityLinkPicker } from './EntityLinkPicker';
import { useCardLinks } from '../hooks/use-card-links';
import type { Card, ChecklistItem, Comment, Dependency, Label, CustomFieldDef } from '../types';

const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];
const EMPTY_LABEL_IDS: string[] = [];

const DOMAIN_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  event: Calendar,
  email: Mail,
  contact: User,
  file: File,
  bookmarks: Bookmark,
};

interface CardDetailPanelProps {
  boardId: string;
  cardId: string;
  isMobile: boolean;
}

interface ApiEnvelope<T> { data: T }

export function CardDetailPanel({ boardId, cardId, isMobile }: CardDetailPanelProps) {
  const card = useProjectsStore((s) => s.cards[cardId]);
  const columns = useProjectsStore((s) => s.columns);
  const labels = useProjectsStore((s) => s.labels);
  const customFieldDefs = useProjectsStore((s) => s.customFieldDefs);
  const cardLabelIds = useProjectsStore((s) => s.cardLabelIds[cardId] ?? EMPTY_LABEL_IDS);
  const updateCard = useProjectsStore((s) => s.updateCard);
  const deleteCard = useProjectsStore((s) => s.deleteCard);
  const selectCard = useProjectsStore((s) => s.selectCard);
  const addLabelToCard = useProjectsStore((s) => s.addLabelToCard);
  const removeLabelFromCard = useProjectsStore((s) => s.removeLabelFromCard);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [newCheckItem, setNewCheckItem] = useState('');

  // Comments / activity state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  // Dependencies state
  const [dependencies, setDependencies] = useState<{ blocking: (Dependency & { _card?: { id: string; title: string } })[]; blockedBy: (Dependency & { _card?: { id: string; title: string } })[] }>({ blocking: [], blockedBy: [] });
  const [showDeps, setShowDeps] = useState(false);

  // Linked items
  const [showLinks, setShowLinks] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const { links: linkedItems, loading: linksLoading, fetchLinks, removeLink } = useCardLinks(boardId, cardId);

  // Labels picker
  const [showLabels, setShowLabels] = useState(false);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description ?? '');
      setPriority(card.priority ?? 'medium');
      setDueDate(card.due_date ? card.due_date.slice(0, 10) : '');
      setTags((card.tags ?? []).join(', '));
    }
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load comments
  useEffect(() => {
    if (showComments && cardId) {
      api.get<ApiEnvelope<Comment[]>>(`/projects/boards/${boardId}/cards/${cardId}/comments`)
        .then(res => setComments(res.data))
        .catch(() => {});
    }
  }, [showComments, cardId, boardId]);

  // Load dependencies
  useEffect(() => {
    if (showDeps && cardId) {
      api.get<ApiEnvelope<Record<string, unknown>>>(`/projects/boards/${boardId}/cards/${cardId}/dependencies`)
        .then(res => {
          const raw = res.data as Record<string, unknown>;
          setDependencies({
            blocking: (raw.blocking as any[] ?? []).map((d: any) => d.dependency ? { ...d.dependency, _card: d.card } : d),
            blockedBy: (raw.blocked_by as any[] ?? raw.blockedBy as any[] ?? []).map((d: any) => d.dependency ? { ...d.dependency, _card: d.card } : d),
          });
        })
        .catch(() => {});
    }
  }, [showDeps, cardId, boardId]);

  const handleClose = useCallback(() => selectCard(null), [selectCard]);

  const handleSaveField = useCallback(
    (field: string, value: unknown) => {
      updateCard(boardId, cardId, { [field]: value });
    },
    [boardId, cardId, updateCard],
  );

  const handleDelete = useCallback(() => {
    if (confirm('Delete this card?')) {
      deleteCard(boardId, cardId);
    }
  }, [boardId, cardId, deleteCard]);

  const handleToggleCheck = useCallback(
    (itemId: string) => {
      if (!card) return;
      const newChecklist = (card.checklist ?? []).map((c) =>
        c.id === itemId ? { ...c, checked: !c.checked } : c,
      );
      handleSaveField('checklist', newChecklist);
    },
    [card, handleSaveField],
  );

  const handleAddCheckItem = useCallback(() => {
    if (!newCheckItem.trim() || !card) return;
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: newCheckItem.trim(),
      checked: false,
    };
    handleSaveField('checklist', [...(card.checklist ?? []), newItem]);
    setNewCheckItem('');
  }, [newCheckItem, card, handleSaveField]);

  const handleRemoveCheckItem = useCallback(
    (itemId: string) => {
      if (!card) return;
      handleSaveField(
        'checklist',
        (card.checklist ?? []).filter((c) => c.id !== itemId),
      );
    },
    [card, handleSaveField],
  );

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim()) return;
    try {
      const res = await api.post<ApiEnvelope<Comment>>(`/projects/boards/${boardId}/cards/${cardId}/comments`, { content: newComment.trim() });
      setComments(prev => [...prev, res.data]);
      setNewComment('');
    } catch { /* ignore */ }
  }, [newComment, boardId, cardId]);

  const handleAddTag = useCallback(() => {
    if (!tagInput.trim() || !card) return;
    const currentTags = card.tags ?? [];
    const newTag = tagInput.trim();
    if (!currentTags.includes(newTag)) {
      handleSaveField('tags', [...currentTags, newTag]);
    }
    setTagInput('');
  }, [tagInput, card, handleSaveField]);

  if (!card) return null;

  const panelStyle: React.CSSProperties = isMobile
    ? { position: 'fixed', inset: 0, zIndex: 50, background: 'var(--bg)', overflow: 'auto' }
    : {
        width: 400,
        minWidth: 400,
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg)',
        overflow: 'auto',
        height: '100%',
      };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            {columns[card.column_id]?.title ?? 'Column'}
          </span>
          {card.card_number && (
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>#{card.card_number}</span>
          )}
        </div>
        <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title.trim() !== card.title) handleSaveField('title', title.trim()); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            padding: 0,
          }}
        />

        {/* Priority */}
        <div>
          <label style={labelStyle}>Priority</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => { setPriority(p); handleSaveField('priority', p); }}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: priority === p ? '1px solid var(--border-hover)' : '1px solid transparent',
                  background: priority === p ? 'var(--surface-hover)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <PriorityBadge priority={p} />
              </button>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div>
          <label style={labelStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => setShowLabels(!showLabels)}>
              <Tag size={10} /> Labels
            </span>
          </label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {cardLabelIds.map(labelId => {
              const label = labels[labelId];
              if (!label) return null;
              return (
                <span key={labelId} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 8px', borderRadius: 10, fontSize: 11,
                  background: label.color + '30', color: label.color,
                  border: `1px solid ${label.color}50`,
                }}>
                  {label.name}
                  <button onClick={() => removeLabelFromCard(boardId, cardId, labelId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}>
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
          {showLabels && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.values(labels).filter(l => !cardLabelIds.includes(l.id)).map(label => (
                <button key={label.id}
                  onClick={() => addLabelToCard(boardId, cardId, label.id)}
                  style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11,
                    background: label.color + '20', color: label.color,
                    border: `1px solid ${label.color}30`, cursor: 'pointer',
                  }}
                >
                  + {label.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => handleSaveField('description', description || null)}
            placeholder="Add a description..."
            rows={4}
            style={{
              width: '100%',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 8px',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Due Date */}
        <div>
          <label style={labelStyle}>Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              handleSaveField('due_date', e.target.value ? new Date(e.target.value).toISOString() : null);
            }}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '4px 8px',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* Custom Fields / Properties */}
        {Object.keys(customFieldDefs).length > 0 && (
          <div>
            <label style={labelStyle}>Properties</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.values(customFieldDefs)
                .sort((a, b) => a.position - b.position)
                .map(fd => {
                  const value = (card.custom_fields as Record<string, unknown> ?? {})[fd.id];
                  return (
                    <CustomFieldInput
                      key={fd.id}
                      fieldDef={fd}
                      value={value}
                      onSave={(val) => {
                        const cf = { ...(card.custom_fields as Record<string, unknown> ?? {}), [fd.id]: val };
                        handleSaveField('custom_fields', cf);
                      }}
                    />
                  );
                })}
            </div>
          </div>
        )}

        {/* Tags */}
        <div>
          <label style={labelStyle}>Tags</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {(card.tags ?? []).map((tag) => (
              <span key={tag} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: 'var(--surface)', color: 'var(--text-dim)',
                fontSize: 11, padding: '2px 6px', borderRadius: 3,
              }}>
                {tag}
                <button onClick={() => handleSaveField('tags', (card.tags ?? []).filter(t => t !== tag))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
              placeholder="Add tag..."
              style={{ flex: 1, ...inputStyle }}
            />
            <button onClick={handleAddTag} style={smallBtnStyle}><Plus size={12} /></button>
          </div>
        </div>

        {/* Checklist */}
        <div>
          <label style={labelStyle}>
            Checklist
            {card.checklist && card.checklist.length > 0 && (
              <span style={{ fontWeight: 400, marginLeft: 6 }}>
                {card.checklist.filter((c) => c.checked).length}/{card.checklist.length}
              </span>
            )}
          </label>

          {(card.checklist ?? []).map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <button
                onClick={() => handleToggleCheck(item.id)}
                style={{
                  width: 16, height: 16, borderRadius: 3,
                  border: '1px solid var(--border)',
                  background: item.checked ? 'var(--success)' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {item.checked && <Check size={10} color="#fff" />}
              </button>
              <span style={{
                color: item.checked ? 'var(--text-dim)' : 'var(--text)',
                fontSize: 13, textDecoration: item.checked ? 'line-through' : 'none', flex: 1,
              }}>
                {item.text}
              </span>
              <button onClick={() => handleRemoveCheckItem(item.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                <X size={12} />
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <input
              value={newCheckItem}
              onChange={(e) => setNewCheckItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCheckItem(); }}
              placeholder="Add item..."
              style={{ flex: 1, ...inputStyle }}
            />
            <button onClick={handleAddCheckItem} style={smallBtnStyle}><Plus size={12} /></button>
          </div>
        </div>

        {/* Dependencies section (collapsible) */}
        <div>
          <label style={{ ...labelStyle, cursor: 'pointer' }} onClick={() => setShowDeps(!showDeps)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <GitBranch size={10} /> Dependencies
              {(dependencies.blocking.length + dependencies.blockedBy.length > 0) && (
                <span style={{ fontWeight: 400 }}>({dependencies.blocking.length + dependencies.blockedBy.length})</span>
              )}
            </span>
          </label>
          {showDeps && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {dependencies.blocking.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Blocks:</span>
                  {dependencies.blocking.map(d => (
                    <div key={d.id} style={{ padding: '2px 0', marginLeft: 8 }}>{d._card?.title || `Card ${d.blocked_card_id.slice(0, 8)}...`}</div>
                  ))}
                </div>
              )}
              {dependencies.blockedBy.length > 0 && (
                <div>
                  <span style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Blocked by:</span>
                  {dependencies.blockedBy.map(d => (
                    <div key={d.id} style={{ padding: '2px 0', marginLeft: 8 }}>{d._card?.title || `Card ${d.blocking_card_id.slice(0, 8)}...`}</div>
                  ))}
                </div>
              )}
              {dependencies.blocking.length === 0 && dependencies.blockedBy.length === 0 && (
                <div style={{ padding: '4px 0' }}>No dependencies</div>
              )}
            </div>
          )}
        </div>

        {/* Linked Items section (collapsible) */}
        <div>
          <label style={{ ...labelStyle, cursor: 'pointer' }} onClick={() => setShowLinks(!showLinks)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link size={10} /> Linked Items
              {linkedItems.length > 0 && <span style={{ fontWeight: 400 }}>({linkedItems.length})</span>}
            </span>
          </label>
          {showLinks && (
            <div style={{ fontSize: 12 }}>
              {linksLoading && linkedItems.length === 0 && (
                <div style={{ color: 'var(--text-muted)', padding: '4px 0' }}>Loading...</div>
              )}
              {linkedItems.map(link => {
                const Icon = DOMAIN_ICONS[link.domain] ?? FileText;
                return (
                  <div key={link.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 6px', borderRadius: 4, marginBottom: 2,
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <Icon size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{
                      flex: 1, color: 'var(--text)', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {link.title}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>
                      {link.domain.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => removeLink(link.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              {!linksLoading && linkedItems.length === 0 && (
                <div style={{ color: 'var(--text-muted)', padding: '4px 0' }}>No linked items</div>
              )}
              <button
                onClick={() => setLinkPickerOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 6px', marginTop: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-sans)',
                }}
              >
                <Plus size={12} /> Link entity
              </button>
            </div>
          )}
        </div>

        {/* Comments / Activity section (collapsible) */}
        <div>
          <label style={{ ...labelStyle, cursor: 'pointer' }} onClick={() => setShowComments(!showComments)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MessageSquare size={10} /> Comments & Activity
              {comments.length > 0 && <span style={{ fontWeight: 400 }}>({comments.length})</span>}
            </span>
          </label>
          {showComments && (
            <div>
              {comments.map(c => (
                <div key={c.id} style={{
                  padding: '6px 8px', marginBottom: 4, borderRadius: 4,
                  background: c.type === 'activity' ? 'transparent' : 'var(--card)',
                  border: c.type === 'activity' ? 'none' : '1px solid var(--border)',
                  fontSize: 12, color: c.type === 'activity' ? 'var(--text-dim)' : 'var(--text)',
                  fontStyle: c.type === 'activity' ? 'italic' : 'normal',
                }}>
                  {c.type === 'activity' ? (
                    <span>{c.activity_action}: {JSON.stringify(c.activity_meta)}</span>
                  ) : (
                    <span>{c.content}</span>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {new Date(c.created_at).toLocaleString()}
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                  placeholder="Write a comment..."
                  style={{ flex: 1, ...inputStyle }}
                />
                <button onClick={handleAddComment} style={smallBtnStyle}>Send</button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={handleDelete}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', background: 'none',
              border: '1px solid var(--error)', borderRadius: 6,
              color: 'var(--error)', fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
          {!card.archived && (
            <button
              onClick={() => {
                api.post(`/projects/boards/${boardId}/cards/${cardId}/archive`).then(() => {
                  updateCard(boardId, cardId, { archived: true });
                }).catch(() => {});
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', background: 'none',
                border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text-dim)', fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            >
              <Archive size={14} /> Archive
            </button>
          )}
        </div>
      </div>

      {linkPickerOpen && (
        <EntityLinkPicker
          boardId={boardId}
          cardId={cardId}
          onClose={() => setLinkPickerOpen(false)}
          onLinksChanged={fetchLinks}
        />
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
  fontFamily: 'var(--font-sans)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '3px 6px',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};

const smallBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--text-dim)',
  padding: '2px 6px',
  display: 'flex',
  alignItems: 'center',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
};

function CustomFieldInput({ fieldDef, value, onSave }: {
  fieldDef: CustomFieldDef;
  value: unknown;
  onSave: (val: unknown) => void;
}) {
  const fieldInputStyle: React.CSSProperties = {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '3px 6px', color: 'var(--text)',
    fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: 'var(--text-dim)', fontSize: 11, minWidth: 70, flexShrink: 0 }}>
        {fieldDef.name}
      </span>
      {fieldDef.type === 'checkbox' ? (
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onSave(e.target.checked)}
          style={{ accentColor: 'var(--amber)' }}
        />
      ) : fieldDef.type === 'select' ? (
        <select
          value={String(value ?? '')}
          onChange={e => onSave(e.target.value || null)}
          style={{ ...fieldInputStyle, cursor: 'pointer' }}
        >
          <option value="">—</option>
          {(Array.isArray(fieldDef.options) ? fieldDef.options as string[] : []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : fieldDef.type === 'date' ? (
        <input
          type="date"
          value={String(value ?? '')}
          onChange={e => onSave(e.target.value || null)}
          style={{ ...fieldInputStyle, colorScheme: 'dark' }}
        />
      ) : fieldDef.type === 'number' ? (
        <input
          type="number"
          defaultValue={value != null ? String(value) : ''}
          onBlur={e => onSave(e.target.value ? Number(e.target.value) : null)}
          style={fieldInputStyle}
        />
      ) : fieldDef.type === 'url' ? (
        <div style={{ display: 'flex', gap: 4, flex: 1, alignItems: 'center' }}>
          <input
            type="url"
            defaultValue={String(value ?? '')}
            onBlur={e => onSave(e.target.value || null)}
            placeholder="https://..."
            style={{ ...fieldInputStyle, flex: 1 }}
          />
          {value && (
            <a href={String(value)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', display: 'flex' }}>
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      ) : (
        <input
          type="text"
          defaultValue={String(value ?? '')}
          onBlur={e => onSave(e.target.value || null)}
          style={fieldInputStyle}
        />
      )}
    </div>
  );
}
