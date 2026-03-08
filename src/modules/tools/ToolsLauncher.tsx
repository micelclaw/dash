import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Calculator, ArrowLeftRight, Timer, Mic, PenTool, FileText, Pencil, Trash2 } from 'lucide-react';
import { useFloatingPanelsStore, type PanelId } from '@/stores/floating-panels.store';
import { ContextMenu } from '@/components/shared/ContextMenu';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';
import { api } from '@/services/api';
import type { FileRecord } from '@/types/files';

interface ToolCard {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  type: 'floating' | 'viewport';
  panelId?: PanelId;
  route?: string;
}

const UTILITIES: ToolCard[] = [
  { id: 'calculator', label: 'Calculator', description: 'Scientific calculator', icon: <Calculator size={28} />, type: 'floating', panelId: 'calculator' },
  { id: 'converter', label: 'Converter', description: 'Units & currency', icon: <ArrowLeftRight size={28} />, type: 'floating', panelId: 'converter' },
  { id: 'pomodoro', label: 'Pomodoro', description: 'Timer & stopwatch', icon: <Timer size={28} />, type: 'floating', panelId: 'pomodoro' },
  { id: 'voice-recorder', label: 'Recorder', description: 'Voice recorder', icon: <Mic size={28} />, type: 'floating', panelId: 'voice-recorder' },
];

const CANVAS: ToolCard[] = [
  { id: 'whiteboard', label: 'Whiteboard', description: 'Draw & diagram', icon: <PenTool size={28} />, type: 'viewport', route: '/tools/whiteboard' },
];

export function ToolsLauncher() {
  const navigate = useNavigate();
  const openPanel = useFloatingPanelsStore((s) => s.openPanel);
  const [whiteboards, setWhiteboards] = useState<FileRecord[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    api.get<{ data: FileRecord[] }>('/files', {
      parent_folder: '/Tools/Whiteboards',
      sort: 'updated_at',
      order: 'desc',
      limit: 200,
    })
      .then((res) => setWhiteboards(res.data))
      .catch(() => {});
  }, []);

  const handleDeleteWb = useCallback(async (file: FileRecord) => {
    try {
      await api.delete(`/files/${file.id}`);
      setWhiteboards((prev) => prev.filter((f) => f.id !== file.id));
    } catch {}
  }, []);

  const handleRenameWb = useCallback(async (fileId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const filename = trimmed.endsWith('.excalidraw') ? trimmed : `${trimmed}.excalidraw`;
    try {
      await api.patch(`/files/${fileId}`, { filename });
      setWhiteboards((prev) => prev.map((f) => f.id === fileId ? { ...f, filename } : f));
    } catch {}
    setRenamingId(null);
  }, []);

  const getWbContextItems = useCallback((file: FileRecord): ContextMenuItem[] => [
    {
      label: 'Rename',
      icon: Pencil,
      onClick: () => {
        setRenamingId(file.id);
        setRenameValue(file.filename.replace(/\.(excalidraw|json)$/, ''));
      },
    },
    { label: '', onClick: () => {}, separator: true },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'danger',
      onClick: () => handleDeleteWb(file),
    },
  ], [handleDeleteWb]);

  const handleClick = (tool: ToolCard) => {
    if (tool.type === 'floating' && tool.panelId) {
      openPanel(tool.panelId);
    } else if (tool.route) {
      navigate(tool.route);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: 24 }}>Tools</h1>

      {/* Utilities section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12,
        }}>
          Utilities
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {UTILITIES.map((tool) => (
            <ToolCardButton key={tool.id} tool={tool} onClick={() => handleClick(tool)} />
          ))}
        </div>
      </div>

      {/* Canvas section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12,
        }}>
          Canvas
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {CANVAS.map((tool) => (
            <ToolCardButton key={tool.id} tool={tool} onClick={() => handleClick(tool)} />
          ))}
        </div>
      </div>

      {/* All Whiteboards */}
      {whiteboards.length > 0 && (
        <div>
          <div style={{
            fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12,
          }}>
            All Whiteboards
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {whiteboards.map((wb) => (
              <ContextMenu
                key={wb.id}
                items={getWbContextItems(wb)}
                trigger={
                  <button
                    onClick={() => {
                      if (renamingId !== wb.id) navigate(`/tools/whiteboard/${wb.id}`);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%',
                      padding: '8px 12px', background: 'var(--card)',
                      border: `1px solid ${renamingId === wb.id ? 'var(--mod-tools)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', color: 'var(--text)', textAlign: 'left',
                      transition: 'border-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { if (renamingId !== wb.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--mod-tools)'; }}
                    onMouseLeave={(e) => { if (renamingId !== wb.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                  >
                    <FileText size={14} style={{ color: 'var(--mod-tools)', flexShrink: 0 }} />
                    {renamingId === wb.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameWb(wb.id, renameValue)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameWb(wb.id, renameValue);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          fontSize: '0.8125rem',
                          fontWeight: 500,
                          fontFamily: 'var(--font-sans, system-ui)',
                          background: 'var(--background, #111)',
                          border: '1px solid var(--mod-tools)',
                          borderRadius: 4,
                          color: 'var(--text)',
                          padding: '2px 6px',
                          outline: 'none',
                          minWidth: 0,
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{wb.filename}</span>
                    )}
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginLeft: 'auto', flexShrink: 0 }}>
                      {new Date(wb.updated_at).toLocaleDateString()}
                    </span>
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolCardButton({ tool, onClick }: { tool: ToolCard; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '20px 16px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        color: 'var(--text)',
        transition: 'border-color var(--transition-fast), background var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--mod-tools)';
        (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLElement).style.background = 'var(--card)';
      }}
    >
      <div style={{ color: 'var(--mod-tools)' }}>{tool.icon}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{tool.label}</div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{tool.description}</div>
      <div style={{
        fontSize: '0.625rem', color: 'var(--text-muted)',
        padding: '2px 6px', background: 'var(--surface)',
        borderRadius: 'var(--radius-sm)', marginTop: 2,
      }}>
        {tool.type === 'floating' ? 'Opens as panel' : 'Opens in viewport'}
      </div>
    </button>
  );
}
