import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { Users } from 'lucide-react';
import { SplitPane } from '@/components/shared/SplitPane';
import { EmptyState } from '@/components/shared/EmptyState';
import { useIsMobile } from '@/hooks/use-media-query';
import { useContacts } from './hooks/use-contacts';
import { useContactLinks } from './hooks/use-contact-links';
import { ContactsList } from './ContactsList';
import { ContactDetail } from './ContactDetail';
import { ContactForm } from './ContactForm';
import type { ContactCreateInput, ContactUpdateInput } from './types';

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('id'),
  );
  const [filters, setFilters] = useState<{ search: string; tag: string }>({
    search: searchParams.get('q') || '',
    tag: searchParams.get('tag') || '',
  });
  const [editMode, setEditMode] = useState(false);
  const [createMode, setCreateMode] = useState(false);

  const {
    contacts, loading, error,
    fetchContacts, createContact, updateContact, deleteContact,
  } = useContacts({ search: filters.search, tag: filters.tag });

  const { linkedRecords, loading: linkedRecordsLoading } = useContactLinks(selectedId);

  const selectedContact = contacts.find(c => c.id === selectedId) ?? null;

  // Sync URL params
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && id !== selectedId) setSelectedId(id);

    const tag = searchParams.get('tag');
    if (tag && tag !== filters.tag) {
      setFilters(prev => ({ ...prev, tag }));
      setSelectedId(null);
    }

    if (searchParams.get('action') === 'new') {
      setCreateMode(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setEditMode(false);
    setCreateMode(false);
    setSearchParams({ id }, { replace: true });
  }, [setSearchParams]);

  const handleFiltersChange = useCallback((partial: Partial<{ search: string; tag: string }>) => {
    setFilters(prev => ({ ...prev, ...partial }));
  }, []);

  const handleCreateContact = useCallback(() => {
    setCreateMode(true);
    setEditMode(false);
    setSelectedId(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const handleSaveCreate = useCallback(async (data: ContactCreateInput | ContactUpdateInput) => {
    try {
      const created = await createContact(data as ContactCreateInput);
      setCreateMode(false);
      handleSelect(created.id);
    } catch {
      // Error handled in hook
    }
  }, [createContact, handleSelect]);

  const handleSaveEdit = useCallback(async (data: ContactCreateInput | ContactUpdateInput) => {
    if (!selectedId) return;
    try {
      await updateContact(selectedId, data as ContactUpdateInput);
      setEditMode(false);
    } catch {
      // Error handled in hook
    }
  }, [selectedId, updateContact]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteContact(id);
    if (selectedId === id) {
      setSelectedId(null);
      setSearchParams({}, { replace: true });
    }
  }, [deleteContact, selectedId, setSearchParams]);

  // Keyboard shortcut: Cmd+N / Ctrl+N to create
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateContact();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCreateContact]);

  // Mobile: push navigation
  if (isMobile) {
    if (createMode) {
      return (
        <ContactForm
          contact={null}
          onSave={handleSaveCreate}
          onCancel={() => setCreateMode(false)}
        />
      );
    }

    if (selectedId && editMode && selectedContact) {
      return (
        <ContactForm
          contact={selectedContact}
          onSave={handleSaveEdit}
          onCancel={() => setEditMode(false)}
        />
      );
    }

    if (selectedId && selectedContact) {
      return (
        <ContactDetail
          contact={selectedContact}
          onEdit={() => setEditMode(true)}
          onDelete={() => handleDelete(selectedId)}
          onBack={() => { setSelectedId(null); setSearchParams({}, { replace: true }); }}
          linkedRecords={linkedRecords}
          linkedRecordsLoading={linkedRecordsLoading}
        />
      );
    }

    return (
      <ContactsList
        contacts={contacts}
        loading={loading}
        error={error}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        selectedId={selectedId}
        onSelect={handleSelect}
        onCreateContact={handleCreateContact}
        onDeleteContact={id => handleDelete(id)}
        onRetry={fetchContacts}
      />
    );
  }

  // Desktop: SplitPane
  const listPanel = (
    <ContactsList
      contacts={contacts}
      loading={loading}
      error={error}
      filters={filters}
      onFiltersChange={handleFiltersChange}
      selectedId={selectedId}
      onSelect={handleSelect}
      onCreateContact={handleCreateContact}
      onDeleteContact={id => handleDelete(id)}
      onRetry={fetchContacts}
    />
  );

  let detailPanel: React.ReactNode;

  if (createMode) {
    detailPanel = (
      <ContactForm
        contact={null}
        onSave={handleSaveCreate}
        onCancel={() => setCreateMode(false)}
      />
    );
  } else if (editMode && selectedContact) {
    detailPanel = (
      <ContactForm
        contact={selectedContact}
        onSave={handleSaveEdit}
        onCancel={() => setEditMode(false)}
      />
    );
  } else if (selectedContact) {
    detailPanel = (
      <ContactDetail
        contact={selectedContact}
        onEdit={() => setEditMode(true)}
        onDelete={() => handleDelete(selectedContact.id)}
        linkedRecords={linkedRecords}
        linkedRecordsLoading={linkedRecordsLoading}
      />
    );
  } else {
    detailPanel = (
      <EmptyState
        icon={Users}
        title="Select a contact"
        description="Choose a contact from the list or create a new one"
        actions={[{ label: '+ New Contact', onClick: handleCreateContact, variant: 'primary' }]}
      />
    );
  }

  return (
    <SplitPane defaultSizes={[35, 65]} minSizes={[260, 400]} id="contacts-split">
      {listPanel}
      {detailPanel}
    </SplitPane>
  );
}
