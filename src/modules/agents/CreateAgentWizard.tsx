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
import { X } from 'lucide-react';
import { api } from '@/services/api';
import type { ManagedAgent } from './types';

interface CreateAgentWizardProps {
  onClose: () => void;
  agents: ManagedAgent[];
  onCreated: (agent: ManagedAgent) => void;
}

const AVATAR_OPTIONS = ['🤖', '🧪', '📊', '📧', '📅', '🎯', '💼', '🛡️'];

const MODEL_OPTIONS = [
  { value: 'claude-opus-4-6', label: 'claude-opus-4-6', provider: 'Anthropic' },
  { value: 'claude-sonnet-4-5', label: 'claude-sonnet-4-5', provider: 'Anthropic' },
  { value: 'deepseek-chat', label: 'deepseek-chat', provider: 'DeepSeek' },
  { value: 'gemini-3-flash', label: 'gemini-3-flash', provider: 'Google' },
];

const SKILL_OPTIONS = [
  { id: 'notes', name: 'Notes', icon: '📝' },
  { id: 'calendar', name: 'Calendar', icon: '📅' },
  { id: 'mail', name: 'Mail', icon: '📧' },
  { id: 'drive', name: 'Drive', icon: '💾' },
  { id: 'search', name: 'Search', icon: '🔍' },
  { id: 'photos', name: 'Photos', icon: '📸' },
  { id: 'diary', name: 'Diary', icon: '📔' },
  { id: 'contacts', name: 'Contacts', icon: '👥' },
  { id: 'graph', name: 'Graph', icon: '🕸️' },
  { id: 'insights', name: 'Insights', icon: '💡' },
];

const STEPS = [
  { number: 1, label: 'Identity' },
  { number: 2, label: 'Model' },
  { number: 3, label: 'Skills' },
  { number: 4, label: 'Parent' },
];

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  padding: '10px 12px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.875rem',
  fontFamily: 'var(--font-sans)',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'var(--transition-fast)',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 6,
  display: 'block',
};

const buttonBase: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 18px',
  fontSize: '0.875rem',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  transition: 'var(--transition-fast)',
};

/* ------------------------------------------------------------------ */
/*  Stepper                                                           */
/* ------------------------------------------------------------------ */

function Stepper({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, padding: '0 8px' }}>
      {STEPS.map((s, i) => {
        const isCompleted = s.number < current;
        const isActive = s.number === current;
        const isUpcoming = s.number > current;

        return (
          <div key={s.number} style={{ display: 'flex', alignItems: 'flex-start', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            {/* Circle + label column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 48 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-sans)',
                  transition: 'var(--transition-fast)',
                  ...(isCompleted
                    ? {
                        background: 'var(--amber)',
                        color: 'var(--bg)',
                        border: '2px solid var(--amber)',
                      }
                    : isActive
                    ? {
                        background: 'var(--amber)',
                        color: 'var(--bg)',
                        border: '2px solid var(--amber)',
                        boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.2)',
                      }
                    : {
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        border: '2px solid var(--border)',
                      }),
                }}
              >
                {isCompleted ? '✓' : s.number}
              </div>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isUpcoming ? 'var(--text-muted)' : isActive ? 'var(--amber)' : 'var(--text-dim)',
                  marginTop: 6,
                  whiteSpace: 'nowrap',
                  transition: 'var(--transition-fast)',
                }}
              >
                {s.label}
              </span>
            </div>

            {/* Connecting line */}
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 13,
                  borderRadius: 1,
                  background: isCompleted ? 'var(--amber)' : 'var(--border)',
                  transition: 'var(--transition-fast)',
                  minWidth: 24,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wizard                                                            */
/* ------------------------------------------------------------------ */

export function CreateAgentWizard({ onClose, agents, onCreated }: CreateAgentWizardProps) {
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);

  // Step 1: Identity
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Step 2: Model
  const [model, setModel] = useState('claude-opus-4-6');

  // Step 3: Skills
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Step 4: Parent
  const [parentMode, setParentMode] = useState<'top' | 'sub'>('top');
  const [parentAgentId, setParentAgentId] = useState<string>(agents[0]?.id ?? '');

  // Hover states
  const [hoveredCancel, setHoveredCancel] = useState(false);
  const [hoveredBack, setHoveredBack] = useState(false);
  const [hoveredNext, setHoveredNext] = useState(false);
  const [hoveredClose, setHoveredClose] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  const toggleSkill = (skillId: string) => {
    setSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(s => s !== skillId)
        : [...prev, skillId]
    );
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const body = {
        name,
        display_name: displayName || name.charAt(0).toUpperCase() + name.slice(1),
        avatar,
        role,
        model,
        skills: selectedSkills,
        parent_agent_id: parentMode === 'sub' ? parentAgentId : null,
      };
      const res = await api.post<{ data: ManagedAgent }>('/managed-agents', body, { timeout: 60_000 });
      onCreated(res.data);
      onClose();
    } catch (err: unknown) {
      setCreating(false);
      const msg = err instanceof Error ? err.message : 'Failed to create agent';
      setError(msg);
    }
  };

  const canGoNext = () => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return !!model;
      case 3: return true;
      case 4: return parentMode === 'top' || !!parentAgentId;
      default: return false;
    }
  };

  /* ------ Step renderers ------ */

  const renderIdentity = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <label style={labelStyle}>Name</label>
        <input
          type="text"
          value={name}
          onChange={e => {
            const v = e.target.value;
            setName(v);
            if (!displayName || displayName === (name.charAt(0).toUpperCase() + name.slice(1))) {
              setDisplayName(v.charAt(0).toUpperCase() + v.slice(1));
            }
          }}
          placeholder="e.g. francis"
          style={inputStyle}
          autoFocus
        />
      </div>
      <div>
        <label style={labelStyle}>Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="e.g. Francis"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Avatar</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {AVATAR_OPTIONS.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAvatar(a)}
              style={{
                width: 40,
                height: 40,
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                border: avatar === a ? '2px solid var(--amber)' : '1px solid var(--border)',
                background: avatar === a ? 'var(--surface-hover)' : 'var(--surface)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={labelStyle}>Role</label>
        <input
          type="text"
          value={role}
          onChange={e => setRole(e.target.value)}
          placeholder="e.g. Chief of Staff"
          style={inputStyle}
        />
      </div>
    </div>
  );

  const renderModel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={labelStyle}>Select Model</label>
      {MODEL_OPTIONS.map(opt => {
        const isSelected = model === opt.value;
        const isHovered = hoveredModel === opt.value;
        return (
          <label
            key={opt.value}
            onMouseEnter={() => setHoveredModel(opt.value)}
            onMouseLeave={() => setHoveredModel(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: '0.875rem',
              cursor: 'pointer',
              color: 'var(--text)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: isSelected ? '1px solid var(--amber)' : '1px solid var(--border)',
              background: isSelected
                ? 'var(--surface-hover)'
                : isHovered
                ? 'var(--surface)'
                : 'transparent',
              transition: 'var(--transition-fast)',
            }}
          >
            <input
              type="radio"
              name="model"
              value={opt.value}
              checked={isSelected}
              onChange={() => setModel(opt.value)}
              style={{ accentColor: 'var(--amber)' }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
              {opt.label}
            </span>
            <span style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              marginLeft: 'auto',
              padding: '2px 8px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-full)',
            }}>
              {opt.provider}
            </span>
          </label>
        );
      })}
    </div>
  );

  const renderSkills = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>Select Skills</label>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {selectedSkills.length} selected
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}>
        {SKILL_OPTIONS.map(skill => {
          const isSelected = selectedSkills.includes(skill.id);
          const isHovered = hoveredSkill === skill.id;
          return (
            <label
              key={skill.id}
              onMouseEnter={() => setHoveredSkill(skill.id)}
              onMouseLeave={() => setHoveredSkill(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.875rem',
                cursor: 'pointer',
                color: 'var(--text)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: isSelected ? '1px solid var(--amber)' : '1px solid var(--border)',
                background: isSelected
                  ? 'var(--surface-hover)'
                  : isHovered
                  ? 'var(--surface)'
                  : 'transparent',
                transition: 'var(--transition-fast)',
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSkill(skill.id)}
                style={{ accentColor: 'var(--amber)' }}
              />
              <span style={{ fontSize: '1rem' }}>{skill.icon}</span>
              <span>{skill.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  const renderParent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={labelStyle}>Hierarchy</label>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.875rem',
          cursor: 'pointer',
          color: 'var(--text)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: parentMode === 'top' ? '1px solid var(--amber)' : '1px solid var(--border)',
          background: parentMode === 'top' ? 'var(--surface-hover)' : 'transparent',
          transition: 'var(--transition-fast)',
        }}
      >
        <input
          type="radio"
          name="parent"
          checked={parentMode === 'top'}
          onChange={() => setParentMode('top')}
          style={{ accentColor: 'var(--amber)' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 500 }}>Top-level agent</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Reports directly to you
          </span>
        </div>
      </label>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.875rem',
          cursor: 'pointer',
          color: 'var(--text)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          border: parentMode === 'sub' ? '1px solid var(--amber)' : '1px solid var(--border)',
          background: parentMode === 'sub' ? 'var(--surface-hover)' : 'transparent',
          transition: 'var(--transition-fast)',
        }}
      >
        <input
          type="radio"
          name="parent"
          checked={parentMode === 'sub'}
          onChange={() => setParentMode('sub')}
          style={{ accentColor: 'var(--amber)' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 500 }}>Sub-agent</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Reports to another agent
          </span>
        </div>
      </label>

      {parentMode === 'sub' && (
        <div style={{ paddingLeft: 4, marginTop: 4 }}>
          <label style={{ ...labelStyle, fontSize: '0.75rem' }}>Parent agent</label>
          <select
            value={parentAgentId}
            onChange={e => setParentAgentId(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.avatar ?? '🤖'} {a.display_name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 1: return renderIdentity();
      case 2: return renderModel();
      case 3: return renderSkills();
      case 4: return renderParent();
      default: return null;
    }
  };

  /* ------ Layout ------ */

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          maxWidth: 540,
          width: '92vw',
          minHeight: 480,
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px 0 24px',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
          }}>
            Create New Agent
          </h2>
          <button
            onClick={onClose}
            onMouseEnter={() => setHoveredClose(true)}
            onMouseLeave={() => setHoveredClose(false)}
            style={{
              background: hoveredClose ? 'var(--surface-hover)' : 'transparent',
              border: 'none',
              color: hoveredClose ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition-fast)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div style={{ padding: '20px 24px 0 24px' }}>
          <Stepper current={step} />
        </div>

        {/* Step content */}
        <div style={{
          flex: 1,
          padding: '24px 24px 0 24px',
          overflowY: 'auto',
          minHeight: 0,
        }}>
          {renderStep()}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            margin: '0 24px',
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#ef4444',
            fontSize: '0.8125rem',
          }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--border)',
          padding: '16px 24px',
          marginTop: 'auto',
        }}>
          <button
            onClick={onClose}
            onMouseEnter={() => setHoveredCancel(true)}
            onMouseLeave={() => setHoveredCancel(false)}
            style={{
              background: 'none',
              border: 'none',
              color: hoveredCancel ? 'var(--text)' : 'var(--text-dim)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              padding: '8px 4px',
              fontFamily: 'var(--font-sans)',
              transition: 'var(--transition-fast)',
            }}
          >
            Cancel
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                onMouseEnter={() => setHoveredBack(true)}
                onMouseLeave={() => setHoveredBack(false)}
                style={{
                  ...buttonBase,
                  background: hoveredBack ? 'var(--surface-hover)' : 'var(--surface)',
                  color: 'var(--text)',
                }}
              >
                &larr; Back
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canGoNext()}
                onMouseEnter={() => setHoveredNext(true)}
                onMouseLeave={() => setHoveredNext(false)}
                style={{
                  ...buttonBase,
                  background: hoveredNext && canGoNext()
                    ? 'var(--amber-dim)'
                    : canGoNext()
                    ? 'var(--amber)'
                    : 'var(--surface)',
                  color: canGoNext() ? 'var(--bg)' : 'var(--text-muted)',
                  border: canGoNext() ? 'none' : '1px solid var(--border)',
                  fontWeight: canGoNext() ? 600 : 400,
                  cursor: canGoNext() ? 'pointer' : 'not-allowed',
                  opacity: canGoNext() ? 1 : 0.5,
                }}
              >
                Next &rarr;
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating || !canGoNext()}
                onMouseEnter={() => setHoveredNext(true)}
                onMouseLeave={() => setHoveredNext(false)}
                style={{
                  ...buttonBase,
                  background: hoveredNext && !creating
                    ? 'var(--amber-dim)'
                    : 'var(--amber)',
                  color: 'var(--bg)',
                  fontWeight: 600,
                  border: 'none',
                  cursor: creating ? 'wait' : 'pointer',
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Creating...' : 'Create ✓'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
