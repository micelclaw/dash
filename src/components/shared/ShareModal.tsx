import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Plus, Link2 } from 'lucide-react';
import { api } from '@/services/api';
import { useNotificationStore } from '@/stores/notification.store';
import type { FileRecord } from '@/types/files';

interface ShareModalProps {
  open: boolean;
  file: FileRecord;
  onClose: () => void;
}

interface SharePerson {
  email: string;
  name: string | null;
  permission: 'read' | 'edit';
}

interface ContactResult {
  id: string;
  display_name: string;
  emails: { address: string }[];
}

export function ShareModal({ open, file, onClose }: ShareModalProps) {
  const addNotification = useNotificationStore(s => s.addNotification);
  const [access, setAccess] = useState<'public' | 'private'>('public');
  const [password, setPassword] = useState('');
  const [permission, setPermission] = useState<'read' | 'edit'>('read');
  const [people, setPeople] = useState<SharePerson[]>([]);
  const [personInput, setPersonInput] = useState('');
  const [suggestions, setSuggestions] = useState<ContactResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [addHover, setAddHover] = useState(false);
  const [shareHover, setShareHover] = useState(false);

  // Search contacts as user types
  useEffect(() => {
    if (!personInput.trim() || personInput.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ data: ContactResult[] }>(`/contacts?search=${encodeURIComponent(personInput)}`);
        setSuggestions(res.data.slice(0, 5));
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [personInput]);

  const addPerson = useCallback((email: string, name: string | null) => {
    if (people.some(p => p.email === email)) return;
    setPeople(prev => [...prev, { email, name, permission: 'read' }]);
    setPersonInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  }, [people]);

  const removePerson = useCallback((email: string) => {
    setPeople(prev => prev.filter(p => p.email !== email));
  }, []);

  const updatePersonPermission = useCallback((email: string, perm: 'read' | 'edit') => {
    setPeople(prev => prev.map(p => p.email === email ? { ...p, permission: perm } : p));
  }, []);

  const handleAddFromInput = useCallback(() => {
    const val = personInput.trim();
    if (!val) return;
    // Check if it matches a suggestion
    const match = suggestions.find(s =>
      s.display_name.toLowerCase().includes(val.toLowerCase()) ||
      s.emails.some(e => e.address.toLowerCase().includes(val.toLowerCase()))
    );
    if (match && match.emails[0]) {
      addPerson(match.emails[0].address, match.display_name);
    } else if (val.includes('@')) {
      addPerson(val, null);
    }
  }, [personInput, suggestions, addPerson]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const res = await api.post<{ data: { url: string } }>(`/files/${file.id}/share`, {
        access,
        password: access === 'private' ? password : null,
        permission,
        people: people.map(p => ({ email: p.email, permission: p.permission })),
      });
      setShareLink(res.data.url);
      addNotification({ type: 'system', title: 'Link created', body: `Share link for ${file.filename} is ready` });
    } catch {
      addNotification({ type: 'system', title: 'Error', body: 'Failed to create share link' });
    }
    setSharing(false);
  }, [file, access, password, permission, people, addNotification]);

  const handleCopy = useCallback(async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      addNotification({ type: 'system', title: 'Link copied', body: 'Share link copied to clipboard' });
    } catch {
      // Fallback
    }
  }, [shareLink, addNotification]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 500,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            Share: {file.filename}
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2,
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Access */}
          <Section title="Access">
            <label style={radioLabelStyle}>
              <input type="radio" name="access" checked={access === 'public'}
                onChange={() => setAccess('public')} style={radioStyle} />
              Public link (anyone with the link)
            </label>
            <label style={radioLabelStyle}>
              <input type="radio" name="access" checked={access === 'private'}
                onChange={() => setAccess('private')} style={radioStyle} />
              Private link (requires password)
            </label>
            {access === 'private' && (
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                style={{ ...inputStyle, marginLeft: 24, width: 'calc(100% - 24px)' }}
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Permission:</span>
              <select
                value={permission}
                onChange={e => setPermission(e.target.value as 'read' | 'edit')}
                style={selectStyle}
              >
                <option value="read">Read only</option>
                <option value="edit">Can edit</option>
              </select>
            </div>
          </Section>

          {/* Share with people */}
          <Section title="Share with people">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
              <input
                value={personInput}
                onChange={e => setPersonInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddFromInput(); }}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Enter email or name..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleAddFromInput}
                onMouseEnter={() => setAddHover(true)}
                onMouseLeave={() => setAddHover(false)}
                style={{
                  background: addHover ? 'var(--surface-hover)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Plus size={14} />
              </button>

              {/* Autocomplete suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 40,
                  marginTop: 4,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 10,
                  maxHeight: 160,
                  overflow: 'auto',
                }}>
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        if (s.emails[0]) addPerson(s.emails[0].address, s.display_name);
                      }}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 2,
                        width: '100%', padding: '8px 12px',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        textAlign: 'left', color: 'var(--text)', fontSize: '0.8125rem',
                        fontFamily: 'var(--font-sans)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: 500 }}>{s.display_name}</span>
                      {s.emails[0] && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {s.emails[0].address}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* People list */}
            {people.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {people.map(p => (
                  <div key={p.email} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface)',
                  }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', width: 20, textAlign: 'center' }}>
                      👤
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
                        {p.name || p.email}
                      </span>
                      {p.name && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                          ({p.email})
                        </span>
                      )}
                    </div>
                    <select
                      value={p.permission}
                      onChange={e => updatePersonPermission(p.email, e.target.value as 'read' | 'edit')}
                      style={{ ...selectStyle, fontSize: '0.75rem' }}
                    >
                      <option value="read">Read only</option>
                      <option value="edit">Can edit</option>
                    </select>
                    <button
                      onClick={() => removePerson(p.email)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 2,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Share link preview */}
          {shareLink && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <Link2 size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{
                flex: 1, fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {shareLink}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'var(--text-dim)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Copy size={12} />
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
              fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            onMouseEnter={() => setShareHover(true)}
            onMouseLeave={() => setShareHover(false)}
            style={{
              padding: '6px 14px',
              background: sharing ? 'var(--surface)' : 'var(--amber)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: sharing ? 'var(--text-muted)' : '#000',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: sharing ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
              opacity: shareHover && !sharing ? 0.9 : 1,
            }}
          >
            {sharing ? 'Creating...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{
        margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 600,
        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {title}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 10px',
  fontSize: '0.8125rem',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 8px',
  fontSize: '0.8125rem',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};

const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: '0.8125rem',
  color: 'var(--text)',
  cursor: 'pointer',
};

const radioStyle: React.CSSProperties = {
  accentColor: 'var(--amber)',
};
