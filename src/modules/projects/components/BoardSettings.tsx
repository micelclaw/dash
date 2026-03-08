import { useState, useEffect, useCallback } from 'react';
import { X, Trash2, Archive } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useProjectsStore } from '@/stores/projects.store';
import { AutomationEditor } from './AutomationEditor';
import type { BoardSettings as BoardSettingsType } from '../types';

interface BoardSettingsProps {
  boardId: string;
  onClose: () => void;
}

export function BoardSettings({ boardId, onClose }: BoardSettingsProps) {
  const activeBoardTitle = useProjectsStore((s) => s.activeBoardTitle);
  const updateBoard = useProjectsStore((s) => s.updateBoard);
  const deleteBoard = useProjectsStore((s) => s.deleteBoard);
  const archiveBoard = useProjectsStore((s) => s.archiveBoard);
  const fetchAutomations = useProjectsStore((s) => s.fetchAutomations);
  const navigate = useNavigate();

  const boards = useProjectsStore((s) => s.boards);
  const activeBoard = boards.find(b => b.id === boardId);
  const boardSettings = activeBoard?.settings ?? {} as BoardSettingsType;

  const [tab, setTab] = useState<'general' | 'display' | 'automations' | 'danger'>('general');
  const [title, setTitle] = useState(activeBoardTitle || '');

  useEffect(() => {
    fetchAutomations(boardId);
  }, [boardId, fetchAutomations]);

  const handleSaveTitle = useCallback(() => {
    if (title.trim() && title !== activeBoardTitle) {
      updateBoard(boardId, { title: title.trim() });
    }
  }, [title, activeBoardTitle, boardId, updateBoard]);

  const handleDelete = useCallback(async () => {
    if (confirm('Delete this board permanently? This cannot be undone.')) {
      await deleteBoard(boardId);
      navigate('/projects');
    }
  }, [boardId, deleteBoard, navigate]);

  const handleArchive = useCallback(async () => {
    await archiveBoard(boardId);
    navigate('/projects');
  }, [boardId, archiveBoard, navigate]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(25px)' }} onClick={onClose} />
      <div
        style={{
          position: 'relative',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Board Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['general', 'display', 'automations', 'danger'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--amber)' : '2px solid transparent',
                color: tab === t ? 'var(--text)' : 'var(--text-dim)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                textTransform: 'capitalize',
              }}
            >
              {t === 'danger' ? 'Danger Zone' : t}
            </button>
          ))}
        </div>

        <div style={{ padding: 16 }}>
          {tab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Board Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          {tab === 'display' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ToggleRow
                label="Show card numbers"
                description="Display #N on each card"
                checked={boardSettings.showCardNumbers ?? true}
                onChange={(v) => updateBoard(boardId, { settings: { ...boardSettings, showCardNumbers: v } })}
              />
              <ToggleRow
                label="Show label text"
                description="Show label names instead of color dots"
                checked={boardSettings.showLabelsText ?? false}
                onChange={(v) => updateBoard(boardId, { settings: { ...boardSettings, showLabelsText: v } })}
              />
              <ToggleRow
                label="Card aging"
                description="Fade cards that haven't been updated"
                checked={boardSettings.cardAging?.enabled ?? false}
                onChange={(v) => updateBoard(boardId, {
                  settings: { ...boardSettings, cardAging: { enabled: v, daysToAge: boardSettings.cardAging?.daysToAge ?? 14 } },
                })}
              />
              {boardSettings.cardAging?.enabled && (
                <div>
                  <label style={labelStyle}>Days to age</label>
                  <input
                    type="number"
                    value={boardSettings.cardAging?.daysToAge ?? 14}
                    min={1}
                    onChange={(e) => updateBoard(boardId, {
                      settings: { ...boardSettings, cardAging: { enabled: true, daysToAge: parseInt(e.target.value) || 14 } },
                    })}
                    style={{ ...inputStyle, width: 80 }}
                  />
                </div>
              )}
              <div>
                <label style={labelStyle}>Background</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['none', '#1a1a2e', '#16213e', '#0f3460', '#1b1b2f', '#2c2c3e'].map((bg) => (
                    <button
                      key={bg}
                      onClick={() => updateBoard(boardId, {
                        settings: { ...boardSettings, background: bg === 'none' ? undefined : { type: 'color', value: bg } },
                      })}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        border: (boardSettings.background?.value === bg || (!boardSettings.background && bg === 'none'))
                          ? '2px solid var(--amber)'
                          : '1px solid var(--border)',
                        background: bg === 'none' ? 'var(--surface)' : bg,
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'automations' && <AutomationEditor boardId={boardId} />}

          {tab === 'danger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={handleArchive}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: 'none',
                  border: '1px solid var(--warning)',
                  borderRadius: 6,
                  color: 'var(--warning)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <Archive size={14} />
                Archive Board
              </button>
              <button
                onClick={handleDelete}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: 'none',
                  border: '1px solid var(--error)',
                  borderRadius: 6,
                  color: 'var(--error)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <Trash2 size={14} />
                Delete Board Permanently
              </button>
            </div>
          )}
        </div>
      </div>
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
  marginBottom: 4,
  fontFamily: 'var(--font-sans)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '6px 10px',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ color: 'var(--text)', fontSize: 13 }}>{label}</div>
        {description && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          border: 'none',
          background: checked ? 'var(--amber)' : 'var(--surface)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}
