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

import { useState, useEffect, useCallback } from 'react';
import { Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface AvailableSkill {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface AssignAppsModalProps {
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  /** Current skill IDs assigned to the agent */
  currentSkillIds: string[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function AssignAppsModal({
  agentId, agentName, agentAvatar, currentSkillIds, open, onClose, onSaved,
}: AssignAppsModalProps) {
  const [available, setAvailable] = useState<AvailableSkill[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Load available skills when modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get<{ data: AvailableSkill[] }>('/managed-agents/available-skills')
      .then(res => {
        setAvailable(res.data);
        // Match current skills to available skill IDs
        const initialSelected = new Set<string>();
        for (const skillId of currentSkillIds) {
          const match = res.data.find(a =>
            a.id === skillId || a.id === `claw-${skillId}` || a.name === skillId
          );
          if (match) initialSelected.add(match.id);
          else initialSelected.add(skillId); // keep as-is if no match
        }
        setSelected(initialSelected);
      })
      .catch(() => toast.error('Failed to load available apps'))
      .finally(() => setLoading(false));
    setSearch('');
  }, [open, currentSkillIds]);

  const toggleSkill = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.patch(`/managed-agents/${agentId}/skills`, { skills: [...selected] });
      toast.success('Apps updated');
      onSaved();
      onClose();
    } catch {
      toast.error('Failed to update apps');
    } finally {
      setSaving(false);
    }
  }, [agentId, selected, onSaved, onClose]);

  if (!open) return null;

  const filtered = search
    ? available.filter(s => {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      })
    : available;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', width: 520, maxHeight: '70vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Assign Apps — {agentAvatar && <span>{agentAvatar}</span>} {agentName}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Click an app to assign or remove it from this agent.
          </p>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search apps..."
              autoFocus
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              }}
            />
          </div>
        </div>

        {/* Grid */}
        <div style={{ padding: '12px 20px', overflow: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center', padding: 20 }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center', padding: 20 }}>
              {search ? 'No apps match your search.' : 'No apps available.'}
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {filtered.map(skill => {
                const isSelected = selected.has(skill.id);
                return (
                  <button
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 4, height: 72, position: 'relative',
                      background: isSelected ? 'rgba(212,160,23,0.08)' : 'var(--surface)',
                      border: `1px solid ${isSelected ? 'var(--amber)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      transition: 'var(--transition-fast)', color: 'var(--text)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {isSelected && (
                      <Check size={12} style={{ position: 'absolute', top: 4, right: 4, color: 'var(--amber)' }} />
                    )}
                    <span style={{ fontSize: '1.25rem' }}>{skill.icon}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{skill.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: '0.8125rem', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--amber)', border: 'none',
              color: '#000', fontSize: '0.8125rem', fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : `Save (${selected.size} apps)`}
          </button>
        </div>
      </div>
    </div>
  );
}
