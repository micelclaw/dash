import { useState, useEffect, useRef, useCallback } from 'react';
import { Minus, Maximize2, X, Paperclip, Trash2, Send, ChevronDown, Save } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import type { ComposeData, EmailAccount } from './types';
import type { ApiListResponse } from '@/types/api';

interface Attachment {
  filename: string;
  size: number;
  path: string;
  mime: string;
}

interface MailComposerProps {
  data: ComposeData;
  onClose: () => void;
  onSend: (data: Record<string, unknown>) => Promise<unknown>;
  accounts: EmailAccount[];
  /** Render inline (in-viewport) instead of fixed floating */
  inline?: boolean;
}

interface Recipient {
  address: string;
  name?: string;
}

interface ContactResult {
  id: string;
  display_name: string | null;
  email: string;
}

export function MailComposer({ data, onClose, onSend, accounts, inline = false }: MailComposerProps) {
  // State
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [fromAccountId, setFromAccountId] = useState<string>(
    data.account_id || accounts.find(a => a.is_default)?.id || accounts[0]?.id || '',
  );
  const [toRecipients, setToRecipients] = useState<Recipient[]>(data.to ?? []);
  const [ccRecipients, setCcRecipients] = useState<Recipient[]>(data.cc ?? []);
  const [bccRecipients, setBccRecipients] = useState<Recipient[]>([]);
  const [showCcBcc, setShowCcBcc] = useState((data.cc ?? []).length > 0);
  const [subject, setSubject] = useState(data.subject ?? '');
  const [body, setBody] = useState(data.body_html ?? '');
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contact autocomplete state
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [toSuggestions, setToSuggestions] = useState<ContactResult[]>([]);
  const [ccSuggestions, setCcSuggestions] = useState<ContactResult[]>([]);
  const [bccSuggestions, setBccSuggestions] = useState<ContactResult[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDirty = body.length > 0 || subject.length > 0 || toRecipients.length > 0;

  const confirmDiscard = useCallback(() => {
    if (isDirty) {
      return window.confirm('Discard this draft?');
    }
    return true;
  }, [isDirty]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDiscard()) onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmDiscard, onClose]);

  // Contact search
  const searchContacts = useCallback(
    (query: string, setter: (results: ContactResult[]) => void) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (query.length < 2) {
        setter([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await api.get<ApiListResponse<ContactResult>>('/contacts', {
            search: query,
            limit: 5,
          });
          setter(res.data);
        } catch {
          setter([]);
        }
      }, 200);
    },
    [],
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/v1/files/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('claw_token')}` },
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const json = await res.json();
        const uploaded = json.data;
        setAttachments(prev => [...prev, {
          filename: uploaded.filename ?? file.name,
          size: uploaded.size ?? file.size,
          path: uploaded.path ?? uploaded.id,
          mime: uploaded.mime_type ?? file.type,
        }]);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await api.post('/emails/drafts', {
        account_id: fromAccountId,
        to: toRecipients.length > 0 ? toRecipients : undefined,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        subject: subject || undefined,
        body_plain: body || undefined,
        in_reply_to: data.in_reply_to,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      toast.success('Draft saved');
      onClose();
    } catch {
      toast.error('Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSend = async () => {
    if (toRecipients.length === 0 || !subject) return;
    setSending(true);
    try {
      await onSend({
        account_id: fromAccountId,
        to: toRecipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        subject,
        body_plain: body,
        in_reply_to: data.in_reply_to,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      onClose();
    } catch {
      setSending(false);
    }
  };

  const handleDiscard = () => {
    if (confirmDiscard()) onClose();
  };

  // Title text
  let title = 'New message';
  if (data.mode === 'reply' || data.mode === 'reply_all') {
    title = `Re: ${data.original_email?.subject ?? ''}`;
  } else if (data.mode === 'forward') {
    title = `Fwd: ${data.original_email?.subject ?? ''}`;
  }

  // Position styles
  const positionStyle: React.CSSProperties = inline
    ? {
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-sans)',
      }
    : {
        position: 'fixed',
        bottom: 0,
        right: 24,
        width: 560,
        maxHeight: maximized ? '80vh' : 480,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderBottom: 'none',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        boxShadow: 'var(--shadow-lg)',
        fontFamily: 'var(--font-sans)',
      };

  // Mobile override (only for floating mode)
  if (!inline && typeof window !== 'undefined' && window.innerWidth < 768) {
    positionStyle.left = 0;
    positionStyle.right = 0;
    positionStyle.width = '100%';
  }

  if (minimized && !inline) {
    return (
      <div
        ref={containerRef}
        style={{
          ...positionStyle,
          maxHeight: 'none',
          height: 40,
          overflow: 'hidden',
          cursor: 'pointer',
        }}
        onClick={() => setMinimized(false)}
      >
        <div style={titleBarStyle}>
          <span style={titleTextStyle}>{title}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <TitleBarButton
              icon={Maximize2}
              onClick={(e) => { e.stopPropagation(); setMinimized(false); }}
            />
            <TitleBarButton
              icon={X}
              onClick={(e) => { e.stopPropagation(); if (confirmDiscard()) onClose(); }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={positionStyle}>
      {/* Title bar */}
      <div style={inline ? { ...titleBarStyle, borderRadius: 'var(--radius-md) var(--radius-md) 0 0' } : titleBarStyle}>
        <span style={titleTextStyle}>{title}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {!inline && <TitleBarButton icon={Minus} onClick={() => setMinimized(true)} />}
          {!inline && <TitleBarButton icon={Maximize2} onClick={() => setMaximized(prev => !prev)} />}
          <TitleBarButton
            icon={X}
            onClick={() => { if (confirmDiscard()) onClose(); }}
          />
        </div>
      </div>

      {/* From */}
      <div style={fieldRowStyle}>
        <label style={fieldLabelStyle}>From</label>
        <div style={{ position: 'relative', flex: 1 }}>
          <select
            value={fromAccountId}
            onChange={e => setFromAccountId(e.target.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              paddingRight: 20,
            }}
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id} style={{ background: 'var(--card)', color: 'var(--text)' }}>
                {acc.display_name ?? acc.name} &lt;{acc.email_address}&gt;
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* To */}
      <ChipInput
        label="To"
        recipients={toRecipients}
        onRecipientsChange={setToRecipients}
        inputValue={toInput}
        onInputChange={(val) => {
          setToInput(val);
          searchContacts(val, setToSuggestions);
        }}
        suggestions={toSuggestions}
        onSuggestionSelect={(c) => {
          setToRecipients(prev => [...prev, { address: c.email, name: c.display_name || undefined }]);
          setToInput('');
          setToSuggestions([]);
        }}
        onSuggestionsClear={() => setToSuggestions([])}
      />

      {/* Cc/Bcc toggle */}
      {!showCcBcc && (
        <div style={{ padding: '0 12px 4px' }}>
          <button
            onClick={() => setShowCcBcc(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Add Cc/Bcc
          </button>
        </div>
      )}

      {/* Cc */}
      {showCcBcc && (
        <ChipInput
          label="Cc"
          recipients={ccRecipients}
          onRecipientsChange={setCcRecipients}
          inputValue={ccInput}
          onInputChange={(val) => {
            setCcInput(val);
            searchContacts(val, setCcSuggestions);
          }}
          suggestions={ccSuggestions}
          onSuggestionSelect={(c) => {
            setCcRecipients(prev => [...prev, { address: c.email, name: c.display_name || undefined }]);
            setCcInput('');
            setCcSuggestions([]);
          }}
          onSuggestionsClear={() => setCcSuggestions([])}
        />
      )}

      {/* Bcc */}
      {showCcBcc && (
        <ChipInput
          label="Bcc"
          recipients={bccRecipients}
          onRecipientsChange={setBccRecipients}
          inputValue={bccInput}
          onInputChange={(val) => {
            setBccInput(val);
            searchContacts(val, setBccSuggestions);
          }}
          suggestions={bccSuggestions}
          onSuggestionSelect={(c) => {
            setBccRecipients(prev => [...prev, { address: c.email, name: c.display_name || undefined }]);
            setBccInput('');
            setBccSuggestions([]);
          }}
          onSuggestionsClear={() => setBccSuggestions([])}
        />
      )}

      {/* Subject */}
      <div style={fieldRowStyle}>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Subject"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            padding: 0,
          }}
        />
      </div>

      {/* Body */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Compose your message..."
        style={{
          flex: 1,
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.6,
          resize: 'none',
          outline: 'none',
          minHeight: inline ? 300 : 120,
        }}
      />

      {/* Attachments chips */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 12px' }}>
          {attachments.map((att, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-full)', padding: '2px 8px',
                fontSize: '0.75rem', color: 'var(--text)',
              }}
            >
              <Paperclip size={10} style={{ color: 'var(--text-muted)' }} />
              {att.filename}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.625rem' }}>
                {att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(0)} KB` : `${(att.size / (1024 * 1024)).toFixed(1)} MB`}
              </span>
              <button
                onClick={() => removeAttachment(idx)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', background: 'transparent', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-dim)',
            cursor: 'pointer',
          }}
        >
          <Paperclip size={14} />
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleDiscard}
          title="Discard"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-dim)',
            cursor: 'pointer',
          }}
        >
          <Trash2 size={14} />
        </button>

        <button
          onClick={handleSaveDraft}
          disabled={savingDraft}
          title="Save as draft"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--text-dim)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            cursor: savingDraft ? 'not-allowed' : 'pointer',
            opacity: savingDraft ? 0.5 : 1,
          }}
        >
          <Save size={14} />
          {savingDraft ? 'Saving...' : 'Draft'}
        </button>

        <button
          onClick={handleSend}
          disabled={sending || toRecipients.length === 0 || !subject}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 16px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: (sending || toRecipients.length === 0 || !subject)
              ? 'var(--amber-dim)'
              : 'var(--amber)',
            color: '#000',
            fontSize: '0.8125rem',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: (sending || toRecipients.length === 0 || !subject) ? 'not-allowed' : 'pointer',
            opacity: (sending || toRecipients.length === 0 || !subject) ? 0.5 : 1,
          }}
        >
          <Send size={14} />
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// -- Sub-components --

function TitleBarButton({
  icon: Icon,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        border: 'none',
        background: 'transparent',
        color: 'var(--text-dim)',
        cursor: 'pointer',
        borderRadius: 'var(--radius-sm)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon size={14} />
    </button>
  );
}

interface ChipInputProps {
  label: string;
  recipients: Recipient[];
  onRecipientsChange: (r: Recipient[]) => void;
  inputValue: string;
  onInputChange: (val: string) => void;
  suggestions: ContactResult[];
  onSuggestionSelect: (contact: ContactResult) => void;
  onSuggestionsClear: () => void;
}

function ChipInput({
  label,
  recipients,
  onRecipientsChange,
  inputValue,
  onInputChange,
  suggestions,
  onSuggestionSelect,
  onSuggestionsClear,
}: ChipInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      onRecipientsChange([...recipients, { address: inputValue.trim() }]);
      onInputChange('');
      onSuggestionsClear();
    } else if (e.key === 'Backspace' && !inputValue && recipients.length > 0) {
      onRecipientsChange(recipients.slice(0, -1));
    }
  };

  const removeRecipient = (idx: number) => {
    onRecipientsChange(recipients.filter((_, i) => i !== idx));
  };

  return (
    <div style={fieldRowStyle}>
      <label style={fieldLabelStyle}>{label}</label>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 4,
          position: 'relative',
        }}
      >
        {recipients.map((r, idx) => (
          <span
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 8px',
              fontSize: '0.75rem',
              color: 'var(--text)',
            }}
          >
            {r.name ?? r.address}
            <button
              onClick={() => removeRecipient(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.75rem',
                lineHeight: 1,
              }}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay to allow suggestion clicks
            setTimeout(() => onSuggestionsClear(), 150);
          }}
          style={{
            flex: 1,
            minWidth: 80,
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            padding: 0,
          }}
        />

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 'var(--z-dropdown)' as unknown as number,
              maxHeight: 160,
              overflow: 'auto',
            }}
          >
            {suggestions.map(contact => (
              <button
                key={contact.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSuggestionSelect(contact);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
                  {contact.display_name || contact.email}
                </span>
                {contact.display_name && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {contact.email}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -- Shared styles --

const titleBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  background: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
  minHeight: 40,
  boxSizing: 'border-box',
};

const titleTextStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flex: 1,
  minWidth: 0,
};

const fieldRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  borderBottom: '1px solid var(--border)',
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-sans)',
  flexShrink: 0,
  width: 32,
};
