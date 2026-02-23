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

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  padding: '8px 12px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.875rem',
  fontFamily: 'var(--font-sans)',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 6,
  display: 'block',
};

export function CreateAgentWizard({ onClose, agents, onCreated }: CreateAgentWizardProps) {
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);

  // Step 1: Identity
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [role, setRole] = useState('');

  // Step 2: Model
  const [model, setModel] = useState('claude-opus-4-6');

  // Step 3: Skills
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Step 4: Parent
  const [parentMode, setParentMode] = useState<'top' | 'sub'>('top');
  const [parentAgentId, setParentAgentId] = useState<string>(agents[0]?.id ?? '');

  const [hoveredCancel, setHoveredCancel] = useState(false);
  const [hoveredBack, setHoveredBack] = useState(false);
  const [hoveredNext, setHoveredNext] = useState(false);

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
        avatar,
        role,
        model,
        skills: selectedSkills,
        parent_agent_id: parentMode === 'sub' ? parentAgentId : null,
      };
      const res = await api.post<{ data: ManagedAgent }>('/managed-agents', body);
      onCreated(res.data);
      onClose();
    } catch {
      // Error handling could be expanded
      setCreating(false);
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

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. francis"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Avatar</label>
              <select
                value={avatar}
                onChange={e => setAvatar(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {AVATAR_OPTIONS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
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

      case 2:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>Select Model</label>
            {MODEL_OPTIONS.map(opt => (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  padding: '6px 0',
                }}
              >
                <input
                  type="radio"
                  name="model"
                  value={opt.value}
                  checked={model === opt.value}
                  onChange={() => setModel(opt.value)}
                  style={{ accentColor: 'var(--amber)' }}
                />
                <span>{opt.label}</span>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                }}>
                  {opt.provider}
                </span>
              </label>
            ))}
          </div>
        );

      case 3:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>Select Skills</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}>
              {SKILL_OPTIONS.map(skill => (
                <label
                  key={skill.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    color: 'var(--text)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: selectedSkills.includes(skill.id)
                      ? 'var(--surface-hover)'
                      : 'transparent',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSkills.includes(skill.id)}
                    onChange={() => toggleSkill(skill.id)}
                    style={{ accentColor: 'var(--amber)' }}
                  />
                  <span>{skill.icon}</span>
                  <span>{skill.name}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>Parent Agent</label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.875rem',
              cursor: 'pointer',
              color: 'var(--text)',
              padding: '6px 0',
            }}>
              <input
                type="radio"
                name="parent"
                checked={parentMode === 'top'}
                onChange={() => setParentMode('top')}
                style={{ accentColor: 'var(--amber)' }}
              />
              <span>Top-level (reports to you)</span>
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.875rem',
              cursor: 'pointer',
              color: 'var(--text)',
              padding: '6px 0',
            }}>
              <input
                type="radio"
                name="parent"
                checked={parentMode === 'sub'}
                onChange={() => setParentMode('sub')}
                style={{ accentColor: 'var(--amber)' }}
              />
              <span>Sub-agent of:</span>
            </label>
            {parentMode === 'sub' && (
              <select
                value={parentAgentId}
                onChange={e => setParentAgentId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer', marginLeft: 24 }}
              >
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.avatar ?? '🤖'} {a.display_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const buttonBase: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
  };

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
          maxWidth: 480,
          width: '90vw',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}>
            Create New Agent
          </h2>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
            }}>
              Step {step}/4
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Step content */}
        <div style={{ minHeight: 200 }}>
          {renderStep()}
        </div>

        {/* Footer buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--border)',
          paddingTop: 16,
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
                    ? 'var(--surface-hover)'
                    : 'var(--surface)',
                  color: canGoNext() ? 'var(--text)' : 'var(--text-muted)',
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
                {creating ? 'Creating...' : 'Create \u2713'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
