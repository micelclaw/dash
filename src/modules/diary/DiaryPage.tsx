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

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useIsMobile } from '@/hooks/use-media-query';
import { SplitPane } from '@/components/shared/SplitPane';
import { DiaryTimeline } from './DiaryTimeline';
import { DiaryEditor } from './DiaryEditor';
import { useDiary } from './hooks/use-diary';
import { BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();

  const { entries, loading, error, fetchEntries, updateEntry, openToday } = useDiary({ search: search || undefined });

  // Handle ?id=diaryId or ?date=YYYY-MM-DD from URL (e.g. from search deep-links)
  useEffect(() => {
    const targetId = searchParams.get('id');
    const targetDate = searchParams.get('date');
    if (targetId) {
      setSelectedId(targetId);
      setSearchParams({}, { replace: true });
    } else if (targetDate) {
      const entry = entries.find(e => e.entry_date === targetDate);
      if (entry) setSelectedId(entry.id);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, entries]);

  const selectedEntry = entries.find(e => e.id === selectedId) ?? null;

  const handleCreateToday = useCallback(async () => {
    const entry = await openToday();
    setSelectedId(entry.id);
  }, [openToday]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  // Mobile: push navigation
  if (isMobile) {
    if (selectedEntry) {
      return (
        <div style={{ height: '100%' }}>
          <DiaryEditor
            entry={selectedEntry}
            onUpdate={updateEntry}
            onBack={() => setSelectedId(null)}
          />
        </div>
      );
    }
    return (
      <div style={{ height: '100%' }}>
        <DiaryTimeline
          entries={entries}
          loading={loading}
          error={error}
          selectedId={selectedId}
          onSelect={handleSelect}
          onCreateToday={handleCreateToday}
          search={search}
          onSearchChange={setSearch}
          onRetry={fetchEntries}
        />
      </div>
    );
  }

  // Desktop: SplitPane
  return (
    <SplitPane defaultSizes={[25, 75]} minSizes={[200, 400]} id="diary-split">
      <DiaryTimeline
        entries={entries}
        loading={loading}
        error={error}
        selectedId={selectedId}
        onSelect={handleSelect}
        onCreateToday={handleCreateToday}
        search={search}
        onSearchChange={setSearch}
        onRetry={fetchEntries}
      />
      {selectedEntry ? (
        <DiaryEditor
          entry={selectedEntry}
          onUpdate={updateEntry}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)' }}>
          <EmptyState
            icon={BookOpen}
            title="Select an entry"
            description="Choose a diary entry from the timeline or start writing today's entry."
            actions={[{ label: "+ Write today's entry", onClick: handleCreateToday, variant: 'primary' }]}
          />
        </div>
      )}
    </SplitPane>
  );
}
