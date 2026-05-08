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

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, ChevronRight, ChevronDown, Loader2, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { downloadAgentarExport } from '@/services/agentar.service';
import { useAgentDetail } from './hooks/use-agent-detail';
import { AgentIdentity } from './AgentIdentity';
import { AgentSkills } from './AgentSkills';
import { AgentActivity } from './AgentActivity';
import { AgentToolAccess } from './AgentToolAccess';
import { AgentAdvancedConfig } from './AgentAdvancedConfig';
import { getAgentColor, AGENT_PALETTE } from './agent-colors';
import type { ManagedAgent } from './types';

type AgentDetailTab = 'overview' | 'tools' | 'advanced';

interface AgentDetailProps {
  agentId: string;
  agents: ManagedAgent[];
  onSelect: (id: string) => void;
  onAgentChanged?: () => void;
  onBrowseFiles?: (agentId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--success)',
  idle: '#EAB308',
  error: 'var(--error)',
};

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ModelLabel({ model }: { model: string }) {
  // "anthropic/claude-haiku-4-5" → "Claude Haiku 4.5"
  const raw = model.includes('/') ? model.split('/')[1]! : model;
  return <>{raw.replace(/^claude-/, 'Claude ').replace(/-(\d+)-(\d+)/, ' $1.$2').replace(/-/g, ' ')}</>;
}

export function AgentDetail({ agentId, agents, onSelect, onAgentChanged, onBrowseFiles }: AgentDetailProps) {
  const { agent, loading, refetch } = useAgentDetail(agentId);
  const [browseHover, setBrowseHover] = useState(false);
  const [hoveredChildId, setHoveredChildId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AgentDetailTab>('overview');

  // Inline editing
  const [editingField, setEditingField] = useState<'display_name' | 'role' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const avatarPickerRef = useRef<HTMLDivElement>(null);

  const handleInlineEdit = useCallback(async (field: 'display_name' | 'role' | 'color' | 'avatar', value: string) => {
    if (!agent) return;
    try {
      await api.patch(`/managed-agents/${agent.id}`, { [field]: value });
      refetch();
      onAgentChanged?.();
    } catch { /* ignore */ }
  }, [agent, refetch, onAgentChanged]);

  const commitEdit = useCallback(() => {
    if (!editingField || !agent) return;
    const currentValue = editingField === 'display_name' ? agent.display_name : agent.role;
    if (editValue.trim() && editValue.trim() !== currentValue) {
      handleInlineEdit(editingField, editValue.trim());
    }
    setEditingField(null);
  }, [editingField, editValue, agent, handleInlineEdit]);

  // Close color picker on outside click
  useEffect(() => {
    if (!colorPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorPickerOpen]);

  // Close avatar picker on outside click
  useEffect(() => {
    if (!avatarPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (avatarPickerRef.current && !avatarPickerRef.current.contains(e.target as Node)) {
        setAvatarPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [avatarPickerOpen]);

  // Model dropdown
  const [modelOpen, setModelOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available models when dropdown opens
  useEffect(() => {
    if (!modelOpen || models.length > 0) return;
    setModelLoading(true);
    api.get<{ data: { id: string; provider: string; name: string }[] }>('/managed-agents/models')
      .then(res => setModels(res.data.map(m => m.id)))
      .catch(() => setModels(['anthropic/claude-haiku-4-5', 'anthropic/claude-sonnet-4-6', 'anthropic/claude-opus-4-6']))
      .finally(() => setModelLoading(false));
  }, [modelOpen, models.length]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!modelOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modelOpen]);

  const handleModelSelect = useCallback(async (model: string) => {
    if (!agent || model === agent.model) { setModelOpen(false); return; }
    // Validate against the loaded list — the backend rejects any model not
    // in agents.defaults.models with MODEL_NOT_CONFIGURED, but catching it
    // here gives the user instant feedback without a round trip.
    if (models.length > 0 && !models.includes(model)) {
      toast.error(`Model "${model}" is not in the configured list`);
      setModelOpen(false);
      return;
    }
    setModelSaving(true);
    try {
      await api.post(`/managed-agents/${agent.id}/set-model`, { model });
      refetch();
      onAgentChanged?.();
      setModelOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set model';
      toast.error(msg);
    } finally { setModelSaving(false); }
  }, [agent, refetch, onAgentChanged, models]);

  if (loading || !agent) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-dim)',
        fontSize: '0.875rem',
      }}>
        {loading ? 'Loading...' : 'Agent not found'}
      </div>
    );
  }

  const children = agents.filter(a => a.parent_agent_id === agentId);

  return (
    <div style={{
      overflowY: 'auto',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      height: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <div ref={avatarPickerRef} style={{ position: 'relative' }}>
            <span
              onClick={() => setAvatarPickerOpen(!avatarPickerOpen)}
              style={{ fontSize: '1.5rem', marginTop: 2, cursor: 'pointer', display: 'inline-block' }}
              title="Change avatar"
            >
              {agent.avatar || '🤖'}
            </span>
            {avatarPickerOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 6,
                background: 'rgba(24, 24, 27, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: 10,
                zIndex: 50,
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 4,
                minWidth: 200,
              }}>
                {['🤖', '🧪', '📊', '📧', '📅', '🎯', '💼', '🛡️', '🎨', '💰', '🧬', '🏠', '📂', '🐙', '🔍', '⚡', '🌐', '🧠', '🔬', '📡', '🎭', '🦊', '🐺', '🦉', '🐋', '🦅', '🔮', '💎', '🚀', '⭐'].map(emoji => (
                  <span
                    key={emoji}
                    onClick={() => {
                      handleInlineEdit('avatar', emoji);
                      setAvatarPickerOpen(false);
                    }}
                    style={{
                      width: 30,
                      height: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.125rem',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      border: emoji === agent.avatar ? '1px solid var(--amber)' : '1px solid transparent',
                      background: emoji === agent.avatar ? 'var(--surface-hover)' : 'transparent',
                      transition: 'var(--transition-fast)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={e => { if (emoji !== agent.avatar) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Display Name — click to edit */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div ref={colorPickerRef} style={{ position: 'relative' }}>
                <span
                  onClick={() => setColorPickerOpen(!colorPickerOpen)}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: getAgentColor(agent.name, agent.color),
                    flexShrink: 0,
                    display: 'inline-block',
                    cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                  title="Change color"
                />
                {colorPickerOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 6,
                    background: 'rgba(24, 24, 27, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: 8,
                    zIndex: 50,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 6,
                    minWidth: 120,
                  }}>
                    {AGENT_PALETTE.map(c => (
                      <span
                        key={c}
                        onClick={() => {
                          handleInlineEdit('color', c);
                          setColorPickerOpen(false);
                        }}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: c,
                          cursor: 'pointer',
                          border: c === agent.color ? '2px solid var(--text)' : '1px solid rgba(255,255,255,0.1)',
                          transition: 'var(--transition-fast)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {editingField === 'display_name' ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null); }}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--amber)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              ) : (
                <span
                  onClick={() => { setEditingField('display_name'); setEditValue(agent.display_name); }}
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text)',
                    cursor: 'text',
                    borderBottom: '1px dashed transparent',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderBottomColor = 'var(--text-muted)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                  title="Click to edit"
                >
                  {agent.display_name}
                </span>
              )}
            </div>
            {/* Role — click to edit */}
            {editingField === 'role' ? (
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingField(null); }}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--amber)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-dim)',
                  fontSize: '0.8125rem',
                  padding: '2px 6px',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  width: '100%',
                  marginBottom: 4,
                }}
              />
            ) : (
              <div
                onClick={() => { setEditingField('role'); setEditValue(agent.role); }}
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-dim)',
                  cursor: 'text',
                  borderBottom: '1px dashed transparent',
                  display: 'inline-block',
                  marginBottom: 4,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderBottomColor = 'var(--text-muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                title="Click to edit"
              >
                {agent.role || 'No role defined'}
              </div>
            )}
            <div ref={dropdownRef} style={{ position: 'relative', marginTop: 4 }}>
              <button
                onClick={() => setModelOpen(!modelOpen)}
                disabled={modelSaving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'var(--amber-dim)',
                  border: '1px solid var(--amber)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--amber)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  padding: '3px 10px',
                  cursor: modelSaving ? 'wait' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'var(--transition-fast)',
                  borderColor: modelOpen ? 'var(--amber)' : 'rgba(var(--amber-rgb, 217,119,6), 0.4)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
                onMouseLeave={e => { if (!modelOpen) e.currentTarget.style.borderColor = 'rgba(217,119,6,0.4)'; }}
              >
                {modelSaving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                <ModelLabel model={agent.model} />
                <ChevronDown size={13} style={{ opacity: 0.7, transform: modelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {modelOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: 'rgba(24, 24, 27, 0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 50,
                  minWidth: 220,
                  overflow: 'hidden',
                }}>
                  {modelLoading ? (
                    <div style={{ padding: '10px 14px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Loading models...
                    </div>
                  ) : (
                    models.map(m => (
                      <button
                        key={m}
                        onClick={() => handleModelSelect(m)}
                        onMouseEnter={() => setHoveredModel(m)}
                        onMouseLeave={() => setHoveredModel(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '8px 14px',
                          background: hoveredModel === m ? 'var(--surface-hover)' : 'transparent',
                          border: 'none',
                          color: m === agent.model ? 'var(--amber)' : 'var(--text)',
                          fontSize: '0.75rem',
                          fontWeight: m === agent.model ? 600 : 400,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                          transition: 'var(--transition-fast)',
                          textAlign: 'left',
                        }}
                      >
                        <ModelLabel model={m} />
                        {m === agent.model && <span style={{ fontSize: '0.625rem', color: 'var(--amber)', opacity: 0.8 }}>current</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.75rem',
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: 'var(--radius-full)',
            background: STATUS_COLORS[agent.status] || 'var(--text-muted)',
          }} />
          <span style={{ color: 'var(--text)' }}>{agent.status}</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {' '} — last active {formatRelativeTime(agent.last_active_at)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {([
          { key: 'overview' as const, label: 'Overview' },
          { key: 'tools' as const, label: 'Tools' },
          { key: 'advanced' as const, label: 'Advanced' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              fontSize: '0.75rem',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--amber)' : 'var(--text-dim)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--amber)' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'var(--transition-fast)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <>
          {/* Identity */}
          <AgentIdentity agentId={agentId} />

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Skills */}
          <AgentSkills skills={agent.skills} agentId={agent.id} agentName={agent.display_name} agentAvatar={agent.avatar ?? undefined} onSkillsChanged={refetch} />

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Activity */}
          <AgentActivity agent={agent} />

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Sub-agents */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Sub-agents ({children.length})
            </h4>
            {children.length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No sub-agents</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {children.map(child => (
                  <div
                    key={child.id}
                    onClick={() => onSelect(child.id)}
                    onMouseEnter={() => setHoveredChildId(child.id)}
                    onMouseLeave={() => setHoveredChildId(null)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: hoveredChildId === child.id ? 'var(--surface-hover)' : 'var(--surface)',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer', transition: 'var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1rem' }}>{child.avatar || '🤖'}</span>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{child.display_name}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                          {child.skills.length} skill{child.skills.length !== 1 ? 's' : ''} — {child.role}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Browse Files */}
          <button
            onClick={() => onBrowseFiles?.(agent.id)}
            onMouseEnter={() => setBrowseHover(true)}
            onMouseLeave={() => setBrowseHover(false)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: browseHover ? 'var(--surface-hover)' : 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text)', fontSize: '0.8125rem', fontWeight: 500,
              padding: '8px 16px', cursor: 'pointer', transition: 'var(--transition-fast)',
              fontFamily: 'var(--font-sans)', width: '100%',
            }}
          >
            Browse Files <ArrowRight size={14} />
          </button>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Share & distribute (Agentar export) */}
          <ShareSection agent={agent} />

          {!agent.is_chief && (
            <>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <DangerZone
                agent={agent}
                onDeleted={() => {
                  onAgentChanged?.();
                  onSelect('');
                }}
              />
            </>
          )}
        </>
      )}

      {activeTab === 'tools' && (
        <AgentToolAccess agentId={agent.id} agentName={agent.display_name || agent.name} />
      )}

      {activeTab === 'advanced' && (
        <AgentAdvancedConfig />
      )}
    </div>
  );
}

// ─── Share & distribute (Agentar export) ──────────────────────────

function ShareSection({ agent }: { agent: ManagedAgent }) {
  const [embedSkills, setEmbedSkills] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await downloadAgentarExport(agent.id, embedSkills);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${agent.name}.claw-agent.tar.gz`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${agent.display_name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [agent.id, agent.name, agent.display_name, embedSkills]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
        Share &amp; distribute
      </h4>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
        Export this agent as a <code style={{ fontFamily: 'var(--font-mono)' }}>.claw-agent</code> package — manifest, identity, soul, memory templates and (optionally) bundled skills.
      </p>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-dim)',
        cursor: 'pointer', userSelect: 'none',
      }}>
        <input
          type="checkbox"
          checked={embedSkills}
          onChange={e => setEmbedSkills(e.target.checked)}
          style={{ accentColor: 'var(--amber)' }}
        />
        Embed skills (heavier but self-contained)
      </label>
      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', color: 'var(--text)',
          fontSize: '0.8125rem', fontWeight: 500, padding: '8px 16px',
          cursor: exporting ? 'wait' : 'pointer', transition: 'var(--transition-fast)',
          fontFamily: 'var(--font-sans)', width: '100%',
        }}
      >
        {exporting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Package size={14} />}
        {exporting ? 'Preparing…' : 'Export as .claw-agent'}
      </button>
    </div>
  );
}

// ─── Danger zone (delete agent) ───────────────────────────────────

function DangerZone({ agent, onDeleted }: { agent: ManagedAgent; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (typed !== agent.name) return;
    setDeleting(true);
    try {
      await api.delete(`/managed-agents/${agent.id}`);
      toast.success(`Deleted ${agent.display_name}`);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
      setOpen(false);
      setTyped('');
    }
  }, [agent.id, agent.name, agent.display_name, typed, onDeleted]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--error)', margin: 0 }}>
        Danger zone
      </h4>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
        Soft-deletes the agent and revokes its tokens. Workspace files stay on disk.
      </p>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          background: 'transparent', border: '1px solid var(--error)',
          borderRadius: 'var(--radius-md)', color: 'var(--error)',
          fontSize: '0.8125rem', fontWeight: 500, padding: '8px 16px',
          cursor: 'pointer', transition: 'var(--transition-fast)',
          fontFamily: 'var(--font-sans)', width: '100%',
        }}
      >
        <Trash2 size={14} /> Delete agent
      </button>

      {open && (
        <div
          onClick={() => !deleting && setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
              padding: 24, maxWidth: 440, width: '90vw', fontFamily: 'var(--font-sans)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text)' }}>
              Delete &ldquo;{agent.display_name}&rdquo;?
            </h3>
            <p style={{ margin: '10px 0 0', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              This revokes its tokens, removes it from openclaw.json, and soft-deletes the DB row.
              The workspace files at <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{agent.workspace_path || '~/.openclaw/workspaces/...'}</code> stay on disk for recovery.
            </p>
            <div style={{ marginTop: 14, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Type <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--error)' }}>{agent.name}</code> to confirm:
            </div>
            <input
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              disabled={deleting}
              style={{
                marginTop: 6, width: '100%', boxSizing: 'border-box',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                fontSize: '0.8125rem', fontFamily: 'var(--font-mono)',
                padding: '8px 10px', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => { setOpen(false); setTyped(''); }}
                disabled={deleting}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={typed !== agent.name || deleting}
                style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                  cursor: typed !== agent.name || deleting ? 'not-allowed' : 'pointer',
                  border: 'none',
                  background: typed === agent.name && !deleting ? 'var(--error)' : 'var(--surface-hover)',
                  color: typed === agent.name && !deleting ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {deleting && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                {deleting ? 'Deleting…' : 'Delete agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
