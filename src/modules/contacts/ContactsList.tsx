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

import { useMemo } from 'react';
import { Users, Plus } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ContactsFilters } from './ContactsFilters';
import { ContactsListItem } from './ContactsListItem';
import type { Contact } from './types';

interface ContactsListProps {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  filters: { search: string; tag: string };
  onFiltersChange: (filters: Partial<{ search: string; tag: string }>) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateContact: () => void;
  onDeleteContact: (id: string) => void;
  onRetry: () => void;
}

function SkeletonItem() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--surface-hover)',
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, width: '60%', background: 'var(--surface-hover)', borderRadius: 4, marginBottom: 4 }} />
        <div style={{ height: 12, width: '40%', background: 'var(--surface)', borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function ContactsList({
  contacts, loading, error, filters, onFiltersChange,
  selectedId, onSelect, onCreateContact, onDeleteContact, onRetry,
}: ContactsListProps) {
  const availableTags = useMemo(
    () => [...new Set(contacts.flatMap(c => c.tags))].sort(),
    [contacts],
  );

  const sorted = useMemo(
    () => [...contacts].sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [contacts],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)' }}>
      <ContactsFilters
        search={filters.search || ''}
        onSearchChange={v => onFiltersChange({ search: v })}
        selectedTag={filters.tag || ''}
        onTagChange={v => onFiltersChange({ tag: v })}
        availableTags={availableTags}
      />

      {/* New Contact button */}
      <button
        onClick={onCreateContact}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: 'calc(100% - 24px)',
          margin: '8px 12px',
          padding: '8px 12px',
          background: 'var(--amber)',
          color: '#06060a',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--amber-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--amber)')}
      >
        <Plus size={16} />
        New Contact
      </button>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Loading */}
        {loading && contacts.length === 0 && (
          <>
            <SkeletonItem /><SkeletonItem /><SkeletonItem /><SkeletonItem /><SkeletonItem />
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <p style={{ color: 'var(--error)', fontSize: '0.8125rem', marginBottom: 8 }}>{error}</p>
            <button
              onClick={onRetry}
              style={{
                padding: '6px 12px', background: 'var(--surface-hover)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && contacts.length === 0 && (
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description="Create your first contact or connect a sync provider to import your address book."
            actions={[{ label: '+ New Contact', onClick: onCreateContact, variant: 'primary' }]}
          />
        )}

        {/* Contact list */}
        {sorted.map(contact => (
          <ContactsListItem
            key={contact.id}
            contact={contact}
            selected={contact.id === selectedId}
            onClick={() => onSelect(contact.id)}
            onDelete={() => onDeleteContact(contact.id)}
          />
        ))}
      </div>
    </div>
  );
}
