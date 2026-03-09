import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface ChannelConfigModalProps {
  connectorId: string;
  connectorType: string;
  onClose: () => void;
  onSaved: () => void;
}

interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  member_count?: number;
  message_count?: number;
  purpose?: string;
  topic?: string;
}

const GROUP_ORDER: Record<string, { label: string; order: number }> = {
  channel: { label: 'Channels', order: 0 },
  dm: { label: 'Direct Messages', order: 1 },
  group: { label: 'Group DMs', order: 2 },
};

export function ChannelConfigModal({ connectorId, connectorType, onClose, onSaved }: ChannelConfigModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'my_messages'>('all');
  const [contentFilter, setContentFilter] = useState<'full' | 'metadata_only'>('full');

  useEffect(() => {
    loadChannels();
  }, [connectorId]);

  async function loadChannels() {
    setLoading(true);
    try {
      const res = await api.get<{ data: { channels: ChannelInfo[]; selected: string[] } }>(
        `/sync/connectors/${connectorId}/channels`,
      );
      setChannels(res.data.channels ?? []);
      setSelected(new Set(res.data.selected ?? []));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const observedChannels = channels
        .filter(ch => selected.has(ch.id))
        .map(ch => ({ id: ch.id, name: ch.name, type: ch.type }));

      await api.patch(`/sync/connectors/${connectorId}/channels`, {
        observed_channels: observedChannels,
        direction_filter: directionFilter,
        content_filter: contentFilter,
      });
      toast.success('Channel configuration saved');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const label = connectorType === 'slack-observer' ? 'Slack' : 'Discord';

  // Filter and group channels
  const filteredChannels = useMemo(() => {
    const lc = filter.toLowerCase();
    return lc ? channels.filter(ch => ch.name.toLowerCase().includes(lc)) : channels;
  }, [channels, filter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ChannelInfo[]>();
    for (const ch of filteredChannels) {
      const key = ch.type || 'channel';
      const list = groups.get(key) ?? [];
      list.push(ch);
      groups.set(key, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (GROUP_ORDER[a]?.order ?? 99) - (GROUP_ORDER[b]?.order ?? 99));
  }, [filteredChannels]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480, maxHeight: '80vh',
        background: 'rgba(17, 17, 24, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Select {label} Channels
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-dim)',
              cursor: 'pointer', padding: 4, display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <Loader2 size={24} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Filter input */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }} />
                <input
                  type="text"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="Filter channels..."
                  style={{
                    width: '100%', padding: '8px 10px 8px 30px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Grouped channel list */}
              <div style={{
                maxHeight: 280, overflow: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                {grouped.map(([type, chs]) => (
                  <div key={type}>
                    {/* Group header */}
                    <div style={{
                      padding: '6px 10px',
                      fontSize: '0.6875rem', fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: 'var(--bg)',
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0, zIndex: 1,
                    }}>
                      {GROUP_ORDER[type]?.label ?? type}
                    </div>

                    {/* Channels in group */}
                    {chs.map(ch => (
                      <label
                        key={ch.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          fontSize: '0.8125rem', color: 'var(--text)',
                          transition: 'background var(--transition-fast)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(ch.id)}
                          onChange={() => toggleChannel(ch.id)}
                          style={{ accentColor: 'var(--amber)' }}
                        />
                        <span style={{ flex: 1 }}>
                          {ch.type === 'channel' ? '#' : ''}{ch.name}
                        </span>
                        {ch.message_count != null && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            {ch.message_count.toLocaleString()} messages
                          </span>
                        )}
                        {ch.message_count == null && ch.member_count != null && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            {ch.member_count} members
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                ))}

                {filteredChannels.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {filter ? 'No channels match filter' : 'No channels found'}
                  </div>
                )}
              </div>

              {/* Privacy settings */}
              <div>
                <div style={{
                  fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: 8,
                }}>
                  Privacy
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={radioStyle}>
                    <input
                      type="radio" name="direction"
                      checked={directionFilter === 'all'}
                      onChange={() => setDirectionFilter('all')}
                      style={{ accentColor: 'var(--amber)' }}
                    />
                    Full conversations
                  </label>
                  <label style={radioStyle}>
                    <input
                      type="radio" name="direction"
                      checked={directionFilter === 'my_messages'}
                      onChange={() => setDirectionFilter('my_messages')}
                      style={{ accentColor: 'var(--amber)' }}
                    />
                    Only my messages
                  </label>
                </div>
              </div>

              <div>
                <div style={{
                  fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: 8,
                }}>
                  Content
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={radioStyle}>
                    <input
                      type="radio" name="content"
                      checked={contentFilter === 'full'}
                      onChange={() => setContentFilter('full')}
                      style={{ accentColor: 'var(--amber)' }}
                    />
                    Full content
                  </label>
                  <label style={radioStyle}>
                    <input
                      type="radio" name="content"
                      checked={contentFilter === 'metadata_only'}
                      onChange={() => setContentFilter('metadata_only')}
                      style={{ accentColor: 'var(--amber)' }}
                    />
                    Metadata only (no message content)
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {selected.size} channel{selected.size !== 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-dim)', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  background: 'var(--amber)', border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: '#000', cursor: saving ? 'default' : 'pointer',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save & sync'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const radioStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: '0.8125rem', color: 'var(--text)',
  cursor: 'pointer',
};
