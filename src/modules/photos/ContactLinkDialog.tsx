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

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/services/api';

interface Contact {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

interface ContactLinkDialogProps {
  open: boolean;
  clusterName: string | null;
  linkedContactId: string | null;
  onClose: () => void;
  onLink: (contactId: string) => void;
  onUnlink: () => void;
}

export function ContactLinkDialog({
  open, clusterName, linkedContactId, onClose, onLink, onUnlink,
}: ContactLinkDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await api.get<{ data: Contact[] }>('/contacts', { search: q, limit: 10 });
      setResults(res.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 250);
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          padding: 24, maxWidth: 400, width: '90vw', fontFamily: 'var(--font-sans)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)' }}>
          Link to Contact
        </h3>
        <p style={{ margin: '4px 0 16px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {clusterName ?? 'Unknown face'}
        </p>

        {linkedContactId && (
          <button
            onClick={() => { onUnlink(); onClose(); }}
            style={{
              width: '100%', padding: '8px 12px', marginBottom: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: '0.8125rem', color: 'var(--red, #e55)', fontFamily: 'var(--font-sans)',
              textAlign: 'left',
            }}
          >
            Unlink current contact
          </button>
        )}

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search contacts..."
          style={{
            width: '100%', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            padding: '8px 10px', fontSize: '0.8125rem', color: 'var(--text)',
            fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
          }}
        />

        <div style={{ marginTop: 8, maxHeight: 240, overflowY: 'auto' }}>
          {loading && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 0' }}>Searching...</p>
          )}
          {!loading && query && results.length === 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 0' }}>No contacts found</p>
          )}
          {results.map((c) => (
            <div
              key={c.id}
              onClick={() => { onLink(c.id); onClose(); }}
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: hoveredId === c.id ? 'var(--surface-hover)' : 'transparent',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--amber)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 600, color: '#000', flexShrink: 0,
              }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>
                  {c.name}
                </div>
                {(c.email || c.company) && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.email ?? c.company}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              cursor: 'pointer', border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-dim)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
