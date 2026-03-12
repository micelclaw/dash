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

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  User, Briefcase, MapPin, Hash, Building2, CalendarDays,
  StickyNote, Calendar, Mail, BookOpen, FolderOpen,
  ChevronDown, ChevronUp, Maximize2,
} from 'lucide-react';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { api } from '@/services/api';
import { entityTypeColor } from './graph-utils';
import type { GraphNode, GraphEdge } from '@/types/intelligence';
import type { LucideIcon } from 'lucide-react';

interface GraphDetailPanelProps {
  node: GraphNode | null;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  onCenterEntity: (entityId: string) => void;
  onEntityHover?: (entityId: string | null) => void;
  onNavigateAway?: () => void;
  mode?: 'entities' | 'records';
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  person: User,
  project: Briefcase,
  location: MapPin,
  topic: Hash,
  organization: Building2,
  event: CalendarDays,
};

interface ConnectedEntity {
  id: string;
  name: string;
  entity_type: string;
  weight: number;
}

interface MentionRecord {
  domain: string;
  record_id: string;
  confidence: number | null;
  link_type: string;
  heat_score: number;
  record_title: string | null;
}

interface MentionGroup {
  domain: string;
  records: MentionRecord[];
}

// Map domain names to UI metadata
const DOMAIN_META: Record<string, { icon: LucideIcon; color: string; route: string; label: string }> = {
  notes:         { icon: StickyNote, color: 'var(--mod-notes)',    route: '/notes',    label: 'Notes' },
  note:          { icon: StickyNote, color: 'var(--mod-notes)',    route: '/notes',    label: 'Notes' },
  events:        { icon: Calendar,   color: 'var(--mod-calendar)', route: '/calendar', label: 'Events' },
  event:         { icon: Calendar,   color: 'var(--mod-calendar)', route: '/calendar', label: 'Events' },
  emails:        { icon: Mail,       color: 'var(--mod-mail)',     route: '/mail',     label: 'Emails' },
  email:         { icon: Mail,       color: 'var(--mod-mail)',     route: '/mail',     label: 'Emails' },
  diary_entries: { icon: BookOpen,   color: 'var(--mod-diary)',    route: '/diary',    label: 'Diary entries' },
  diary:         { icon: BookOpen,   color: 'var(--mod-diary)',    route: '/diary',    label: 'Diary entries' },
  files:         { icon: FolderOpen, color: 'var(--mod-drive)',    route: '/drive',    label: 'Files' },
  file:          { icon: FolderOpen, color: 'var(--mod-drive)',    route: '/drive',    label: 'Files' },
  contacts:      { icon: User,       color: 'var(--mod-contacts)', route: '/contacts', label: 'Contacts' },
  contact:       { icon: User,       color: 'var(--mod-contacts)', route: '/contacts', label: 'Contacts' },
};

const CONNECTED_PAGE_SIZE = 5;

interface MentionsResponse {
  data: {
    entity: Record<string, unknown>;
    links: unknown[];
    mentions: MentionRecord[];
  };
}

export function GraphDetailPanel({ node, graphNodes, graphEdges, onCenterEntity, onEntityHover, onNavigateAway, mode = 'entities' }: GraphDetailPanelProps) {
  const navigate = useNavigate();
  const [mentionGroups, setMentionGroups] = useState<MentionGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllConnected, setShowAllConnected] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [showAllMentions, setShowAllMentions] = useState(false);

  // Reset expand states when node changes
  useEffect(() => {
    setShowAllConnected(false);
    setExpandedDomains(new Set());
    setShowAllMentions(false);
  }, [node?.id]);

  // Connected entities — derived from co-occurrence edges in the loaded graph
  const connectedEntities = useMemo(() => {
    if (!node) return [];
    const nodeMap = new Map(graphNodes.map(n => [n.id, n]));
    const neighbors: ConnectedEntity[] = [];
    const maxWeight = Math.max(1, ...graphEdges.map(e => e.weight ?? 1));

    for (const edge of graphEdges) {
      let neighborId: string | null = null;
      if (edge.source_id === node.id) neighborId = edge.target_id;
      else if (edge.target_id === node.id) neighborId = edge.source_id;
      if (!neighborId) continue;

      const neighbor = nodeMap.get(neighborId);
      if (!neighbor) continue;

      neighbors.push({
        id: neighbor.id,
        name: neighbor.name,
        entity_type: neighbor.entity_type,
        weight: (edge.weight ?? 1) / maxWeight,
      });
    }

    return neighbors.sort((a, b) => b.weight - a.weight);
  }, [node?.id, graphNodes, graphEdges]);

  // Mentions — fetched from API (entity mode only)
  useEffect(() => {
    if (!node || mode === 'records') {
      setMentionGroups([]);
      return;
    }
    setLoading(true);
    api.get<MentionsResponse>(`/graph/entities/${node.id}`)
      .then(res => {
        const { mentions } = res.data;
        const domainMap = new Map<string, MentionRecord[]>();
        for (const m of mentions) {
          if (m.domain === 'graph_entity') continue;
          const existing = domainMap.get(m.domain) || [];
          existing.push(m);
          domainMap.set(m.domain, existing);
        }
        const groups = Array.from(domainMap.entries())
          .map(([domain, records]) => ({ domain, records }))
          .sort((a, b) => b.records.length - a.records.length);
        setMentionGroups(groups);
      })
      .catch(() => setMentionGroups([]))
      .finally(() => setLoading(false));
  }, [node?.id, mode]);

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  // Empty state — no node selected yet
  if (!node) {
    return (
      <div style={{
        width: 320, flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, color: 'var(--text-muted)', fontSize: '0.8125rem',
      }}>
        <Maximize2 size={24} style={{ opacity: 0.3 }} />
        Click a node to view details
      </div>
    );
  }

  const isRecordMode = mode === 'records';
  const domainMeta = isRecordMode ? DOMAIN_META[node.entity_type] : null;
  const Icon = isRecordMode
    ? (domainMeta?.icon ?? Hash)
    : (TYPE_ICONS[node.entity_type] ?? Hash);
  const color = isRecordMode
    ? (domainMeta?.color ?? entityTypeColor(node.entity_type))
    : entityTypeColor(node.entity_type);

  const visibleConnected = showAllConnected
    ? connectedEntities
    : connectedEntities.slice(0, CONNECTED_PAGE_SIZE);
  const hasMoreConnected = connectedEntities.length > CONNECTED_PAGE_SIZE;

  const MENTION_GROUPS_PAGE = 3;
  const visibleMentionGroups = showAllMentions
    ? mentionGroups
    : mentionGroups.slice(0, MENTION_GROUPS_PAGE);
  const hasMoreMentions = mentionGroups.length > MENTION_GROUPS_PAGE;

  return (
    <div style={{
      width: 320,
      flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `${color}20`, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {node.name}
          </div>
          <div style={{
            fontSize: '0.6875rem', color: 'var(--text-muted)',
            textTransform: 'capitalize',
          }}>
            {node.entity_type}
          </div>
        </div>
        <HeatBadge score={node.heat_score} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, fontFamily: 'var(--font-sans)' }}>
        {/* Stats */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 16,
          fontSize: '0.75rem', color: 'var(--text-dim)',
        }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
              {node.mention_count}
            </div>
            {isRecordMode ? 'Connections' : 'Mentions'}
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
              {(node.heat_score * 100).toFixed(0)}%
            </div>
            Heat
          </div>
        </div>

        {/* View record button (record mode) */}
        {isRecordMode && domainMeta && (
          <button
            onClick={() => { onNavigateAway?.(); navigate(`${domainMeta.route}?id=${node.id}`); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '6px 12px', marginBottom: 16,
              background: `${color}18`, border: `1px solid ${color}40`,
              borderRadius: 6, cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: 500, color,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Icon size={14} />
            View {node.entity_type}
          </button>
        )}

        {/* Aliases (entity mode only) */}
        {!isRecordMode && (node.aliases?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
            }}>
              Aliases
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(node.aliases ?? []).map(alias => (
                <span key={alias} style={{
                  padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-hover)', fontSize: '0.6875rem',
                  color: 'var(--text-dim)',
                }}>
                  {alias}
                </span>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 20, background: 'var(--surface-hover)', borderRadius: 4,
                animation: 'pulse 1.5s ease infinite',
              }} />
            ))}
          </div>
        ) : (
          <>
            {/* ── Mentioned in (FIRST, entity mode only) ── */}
            {!isRecordMode && mentionGroups.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                }}>
                  Mentioned in
                </div>
                {visibleMentionGroups.map(group => {
                  const meta = DOMAIN_META[group.domain];
                  if (!meta) return null;
                  const DomainIcon = meta.icon;
                  const count = group.records.length;
                  const isExpanded = expandedDomains.has(group.domain);

                  // Single record — show title directly
                  if (count === 1) {
                    const rec = group.records[0];
                    const title = rec.record_title || `1 ${meta.label.toLowerCase()}`;
                    return (
                      <button
                        key={group.domain}
                        onClick={() => { onNavigateAway?.(); navigate(`${meta.route}?id=${rec.record_id}`); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          width: '100%', padding: '4px 0',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '0.8125rem', color: 'var(--text)',
                          fontFamily: 'var(--font-sans)', textAlign: 'left',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--amber)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text)'}
                      >
                        <DomainIcon size={14} style={{ color: meta.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {title}
                        </span>
                        <HeatBadge score={rec.heat_score} />
                      </button>
                    );
                  }

                  // Multiple records — expandable
                  return (
                    <div key={group.domain}>
                      <button
                        onClick={() => toggleDomain(group.domain)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          width: '100%', padding: '4px 0',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '0.8125rem', color: 'var(--text)',
                          fontFamily: 'var(--font-sans)', textAlign: 'left',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--amber)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text)'}
                      >
                        <DomainIcon size={14} style={{ color: meta.color, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{count} {meta.label.toLowerCase()}</span>
                        {isExpanded
                          ? <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          : <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        }
                      </button>
                      {isExpanded && (
                        <div style={{ paddingLeft: 20 }}>
                          {group.records.map(rec => {
                            const title = rec.record_title || rec.record_id.slice(0, 8);
                            return (
                              <button
                                key={rec.record_id}
                                onClick={() => { onNavigateAway?.(); navigate(`${meta.route}?id=${rec.record_id}`); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  width: '100%', padding: '3px 0',
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  fontSize: '0.75rem', color: 'var(--text-dim)',
                                  fontFamily: 'var(--font-sans)', textAlign: 'left',
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--amber)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                              >
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {title}
                                </span>
                                <HeatBadge score={rec.heat_score} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {hasMoreMentions && (
                  <button
                    onClick={() => setShowAllMentions(p => !p)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.6875rem', color: 'var(--amber)',
                      fontFamily: 'var(--font-sans)', padding: '4px 0',
                    }}
                  >
                    {showAllMentions
                      ? 'Show less'
                      : `Show more (${mentionGroups.length - MENTION_GROUPS_PAGE})`
                    }
                  </button>
                )}
              </div>
            )}

            {/* ── Connected Entities / Records ── */}
            {connectedEntities.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                }}>
                  {isRecordMode ? 'Connected records' : 'Connected entities'}
                </div>
                {visibleConnected.map(entity => {
                  const entityDomainMeta = isRecordMode ? DOMAIN_META[entity.entity_type] : null;
                  const EntityIcon = isRecordMode
                    ? (entityDomainMeta?.icon ?? Hash)
                    : (TYPE_ICONS[entity.entity_type] ?? Hash);
                  const entityColor = isRecordMode
                    ? (entityDomainMeta?.color ?? entityTypeColor(entity.entity_type))
                    : entityTypeColor(entity.entity_type);
                  return (
                    <button
                      key={entity.id}
                      onClick={() => onCenterEntity(entity.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        width: '100%', padding: '5px 0',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.8125rem', color: 'var(--text)',
                        fontFamily: 'var(--font-sans)', textAlign: 'left',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--amber)'; onEntityHover?.(entity.id); }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text)'; onEntityHover?.(null); }}
                    >
                      <EntityIcon size={14} style={{ color: entityColor, flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entity.name}
                      </span>
                      <span style={{
                        fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0,
                      }}>
                        {(entity.weight * 100).toFixed(0)}%
                      </span>
                    </button>
                  );
                })}
                {hasMoreConnected && (
                  <button
                    onClick={() => setShowAllConnected(p => !p)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.6875rem', color: 'var(--amber)',
                      fontFamily: 'var(--font-sans)', padding: '4px 0',
                    }}
                  >
                    {showAllConnected
                      ? 'Show less'
                      : `Show more (${connectedEntities.length - CONNECTED_PAGE_SIZE})`
                    }
                  </button>
                )}
              </div>
            )}

            {/* Empty state */}
            {connectedEntities.length === 0 && (isRecordMode || mentionGroups.length === 0) && (
              <div style={{
                fontSize: '0.75rem', color: 'var(--text-muted)',
                textAlign: 'center', padding: '12px 0',
              }}>
                {isRecordMode ? 'No connected records found' : 'No connections or mentions found'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
