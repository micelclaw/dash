import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface AddCalendarModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  connectors?: Array<{ id: string; connector_type: string; display_name: string | null }>;
}

const PRESET_COLORS = [
  '#22c55e', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#d4a017', '#14b8a6', '#f97316',
];

export function AddCalendarModal({ open, onClose, onCreated, connectors }: AddCalendarModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [source, setSource] = useState<'local' | 'caldav'>('local');
  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // CalDAV connectors for the "location" picker
  const caldavConnectors = (connectors ?? []).filter(c => c.connector_type === 'caldav');

  useEffect(() => {
    if (open) {
      setName('');
      setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
      setSource('local');
      setConnectorId(caldavConnectors[0]?.id ?? null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.post('/calendars', {
        name: name.trim(),
        color,
        source,
        connector_id: source === 'caldav' ? connectorId : undefined,
      });
      toast.success(`Calendar "${name.trim()}" created`);
      onCreated?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create calendar');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 32, padding: '0 8px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text)',
    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', outline: 'none',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(17, 17, 24, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
          width: 380,
          maxWidth: '90vw',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            New Calendar
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 4, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
              Name
            </label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Gym, Project X, Family"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleCreate(); }}
            />
          </div>

          {/* Color */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)', marginBottom: 6, display: 'block' }}>
              Color
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: c, border: color === c ? '2px solid var(--text)' : '2px solid transparent',
                    cursor: 'pointer', transition: 'border-color var(--transition-fast)',
                    boxShadow: color === c ? '0 0 0 2px var(--bg)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)', marginBottom: 6, display: 'block' }}>
              Location
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                background: source === 'local' ? 'var(--surface-hover)' : 'var(--surface)',
                border: source === 'local' ? '1px solid var(--amber)' : '1px solid var(--border)',
                cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text)',
              }}>
                <input
                  type="radio" name="source" value="local"
                  checked={source === 'local'}
                  onChange={() => setSource('local')}
                  style={{ accentColor: 'var(--amber)' }}
                />
                Local (Claw OS only)
              </label>

              {caldavConnectors.map(conn => (
                <label
                  key={conn.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 'var(--radius-md)',
                    background: source === 'caldav' && connectorId === conn.id ? 'var(--surface-hover)' : 'var(--surface)',
                    border: source === 'caldav' && connectorId === conn.id ? '1px solid var(--amber)' : '1px solid var(--border)',
                    cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text)',
                  }}
                >
                  <input
                    type="radio" name="source" value={conn.id}
                    checked={source === 'caldav' && connectorId === conn.id}
                    onChange={() => { setSource('caldav'); setConnectorId(conn.id); }}
                    style={{ accentColor: 'var(--amber)' }}
                  />
                  {conn.display_name ?? 'Synology Calendar'}
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>CalDAV</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          padding: '12px 16px', borderTop: '1px solid var(--border)',
        }}>
          <button onClick={onClose} style={{
            padding: '6px 14px', background: 'none', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
          }}>Cancel</button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            style={{
              padding: '6px 14px', background: 'var(--amber)', color: '#000',
              border: 'none', borderRadius: 'var(--radius-md)',
              cursor: creating || !name.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 500,
              opacity: creating || !name.trim() ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {creating && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Create
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
