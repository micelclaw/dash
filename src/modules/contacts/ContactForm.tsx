import { useState, type FormEvent } from 'react';
import { ChevronLeft, Plus, X } from 'lucide-react';
import type { Contact, ContactCreateInput, ContactUpdateInput } from './types';

interface ContactFormProps {
  contact: Contact | null;
  onSave: (data: ContactCreateInput | ContactUpdateInput) => void;
  onCancel: () => void;
}

interface EmailEntry {
  address: string;
  label: string;
  primary: boolean;
}

interface PhoneEntry {
  number: string;
  label: string;
  primary: boolean;
}

const LABELS = ['work', 'personal', 'other'];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: 'var(--text-dim)',
  marginBottom: 4,
  fontFamily: 'var(--font-sans)',
};

const selectStyle: React.CSSProperties = {
  padding: '6px 8px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  cursor: 'pointer',
};

const addButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)',
  fontSize: '0.75rem',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  transition: 'border-color var(--transition-fast)',
};

const removeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: 2,
  display: 'flex',
  alignItems: 'center',
};

export function ContactForm({ contact, onSave, onCancel }: ContactFormProps) {
  const [firstName, setFirstName] = useState(contact?.first_name || '');
  const [lastName, setLastName] = useState(contact?.last_name || '');
  const [displayName, setDisplayName] = useState(contact?.display_name || '');
  const [company, setCompany] = useState(contact?.company || '');
  const [jobTitle, setJobTitle] = useState(contact?.job_title || '');
  const [notes, setNotes] = useState(contact?.notes || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(contact?.tags || []);

  const [emails, setEmails] = useState<EmailEntry[]>(
    contact?.emails?.length
      ? contact.emails.map(e => ({ ...e }))
      : [{ address: '', label: 'work', primary: true }],
  );

  const [phones, setPhones] = useState<PhoneEntry[]>(
    contact?.phones?.length
      ? contact.phones.map(p => ({ ...p }))
      : [{ number: '', label: 'work', primary: true }],
  );

  const isEdit = contact !== null;

  // Auto-generate display name
  const effectiveDisplayName = displayName || [firstName, lastName].filter(Boolean).join(' ');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const name = effectiveDisplayName.trim();
    if (!name) return;

    const validEmails = emails.filter(em => em.address.trim());
    const validPhones = phones.filter(ph => ph.number.trim());

    const data: ContactCreateInput | ContactUpdateInput = {
      display_name: name,
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      company: company.trim() || undefined,
      job_title: jobTitle.trim() || undefined,
      emails: validEmails.length > 0 ? validEmails : undefined,
      phones: validPhones.length > 0 ? validPhones : undefined,
      tags: tags.length > 0 ? tags : undefined,
      notes: notes.trim() || undefined,
    };

    onSave(data);
  };

  const addEmail = () => {
    setEmails(prev => [...prev, { address: '', label: 'work', primary: false }]);
  };

  const removeEmail = (index: number) => {
    setEmails(prev => {
      const next = prev.filter((_, i) => i !== index);
      // Ensure at least one primary
      if (next.length > 0 && !next.some(e => e.primary)) {
        next[0]!.primary = true;
      }
      return next;
    });
  };

  const updateEmail = (index: number, patch: Partial<EmailEntry>) => {
    setEmails(prev => prev.map((e, i) => {
      if (i !== index) {
        // If setting primary on another entry, unset this one
        if (patch.primary) return { ...e, primary: false };
        return e;
      }
      return { ...e, ...patch };
    }));
  };

  const addPhone = () => {
    setPhones(prev => [...prev, { number: '', label: 'work', primary: false }]);
  };

  const removePhone = (index: number) => {
    setPhones(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some(p => p.primary)) {
        next[0]!.primary = true;
      }
      return next;
    });
  };

  const updatePhone = (index: number, patch: Partial<PhoneEntry>) => {
    setPhones(prev => prev.map((p, i) => {
      if (i !== index) {
        if (patch.primary) return { ...p, primary: false };
        return p;
      }
      return { ...p, ...patch };
    }));
  };

  const addTag = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
      overflowY: 'auto',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={onCancel}
          style={{
            background: 'none', border: 'none', color: 'var(--text-dim)',
            cursor: 'pointer', padding: 0, display: 'flex',
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <h2 style={{
          fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: 0,
        }}>
          {isEdit ? 'Edit Contact' : 'New Contact'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* First name + Last name */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>First name</label>
            <input
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="First name"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Last name</label>
            <input
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Last name"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Display name */}
        <div>
          <label style={labelStyle}>Display name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={[firstName, lastName].filter(Boolean).join(' ') || 'Display name'}
            style={inputStyle}
          />
          {!displayName && firstName && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
              Auto: {[firstName, lastName].filter(Boolean).join(' ')}
            </span>
          )}
        </div>

        {/* Company + Job title */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Company</label>
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Company"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Job title</label>
            <input
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="Job title"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Emails */}
        <div>
          <label style={labelStyle}>Emails</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {emails.map((email, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  value={email.address}
                  onChange={e => updateEmail(i, { address: e.target.value })}
                  placeholder="email@example.com"
                  type="email"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <select
                  value={email.label}
                  onChange={e => updateEmail(i, { label: e.target.value })}
                  style={selectStyle}
                >
                  {LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  fontSize: '0.6875rem', color: 'var(--text-muted)', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                  <input
                    type="radio"
                    name="primary-email"
                    checked={email.primary}
                    onChange={() => updateEmail(i, { primary: true })}
                    style={{ accentColor: 'var(--amber)' }}
                  />
                  Primary
                </label>
                {emails.length > 1 && (
                  <button type="button" onClick={() => removeEmail(i)} style={removeButtonStyle}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addEmail} style={{ ...addButtonStyle, marginTop: 6 }}>
            <Plus size={12} />
            Add email
          </button>
        </div>

        {/* Phones */}
        <div>
          <label style={labelStyle}>Phones</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {phones.map((phone, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  value={phone.number}
                  onChange={e => updatePhone(i, { number: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  type="tel"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <select
                  value={phone.label}
                  onChange={e => updatePhone(i, { label: e.target.value })}
                  style={selectStyle}
                >
                  {LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  fontSize: '0.6875rem', color: 'var(--text-muted)', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                  <input
                    type="radio"
                    name="primary-phone"
                    checked={phone.primary}
                    onChange={() => updatePhone(i, { primary: true })}
                    style={{ accentColor: 'var(--amber)' }}
                  />
                  Primary
                </label>
                {phones.length > 1 && (
                  <button type="button" onClick={() => removePhone(i)} style={removeButtonStyle}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addPhone} style={{ ...addButtonStyle, marginTop: 6 }}>
            <Plus size={12} />
            Add phone
          </button>
        </div>

        {/* Tags */}
        <div>
          <label style={labelStyle}>Tags</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: tags.length > 0 ? 6 : 0 }}>
            {tags.map(tag => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-sans)',
                  background: 'var(--amber-dim)',
                  border: '1px solid var(--amber)',
                  color: 'var(--text)',
                }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', color: 'var(--text-dim)', display: 'flex',
                  }}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            placeholder="Type a tag and press Enter"
            style={inputStyle}
          />
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: 1.5,
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
          <button
            type="submit"
            style={{
              padding: '8px 20px',
              background: 'var(--amber)',
              color: '#06060a',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--amber-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--amber)')}
          >
            {isEdit ? 'Save Changes' : 'Create Contact'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              background: 'transparent',
              color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'border-color var(--transition-fast)',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
