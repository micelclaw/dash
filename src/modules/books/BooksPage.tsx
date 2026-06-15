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

import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { MediaShell, MediaToolbar } from '@/components/media';
import { useAuthStore } from '@/stores/auth.store';
import { initAbsSyncWatcher, useBooksStore, type BooksTab } from '@/stores/books.store';
import { ReaderView } from './reader/ReaderView';
import { LibraryView } from './views/LibraryView';
import { AudiobooksView } from './views/AudiobooksView';
import { ManageView } from './views/ManageView';

/**
 * Books module — EPUB library (disk-based, foliate-js reader overlay) +
 * Audiobookshelf audiobooks through the global player + admin Calibre-web
 * management. Audio progress is reported by the ABS sync watcher in
 * books.store (initScrobbleWatcher pattern).
 */
export function BooksPage() {
  const activeTab = useBooksStore((s) => s.activeTab);
  const search = useBooksStore((s) => s.search);
  const aiSearch = useBooksStore((s) => s.aiSearch);
  const readingBook = useBooksStore((s) => s.readingBook);
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    initAbsSyncWatcher();
    void useBooksStore.getState().loadStatus();
  }, []);

  // Deep-link desde el search global: ?book=<sha1Epub> (lector) o ?audiobook=<absId>.
  useEffect(() => {
    const book = searchParams.get('book');
    const audiobook = searchParams.get('audiobook');
    if (!book && !audiobook) return;
    const s = useBooksStore.getState();
    if (book) s.openBook({ id: book, title: '' });
    else if (audiobook) void s.openAudiobook(audiobook, { autoplay: true });
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const tabs: { id: BooksTab; label: string }[] = [
    { id: 'library', label: 'Library' },
    { id: 'audiobooks', label: 'Audiobooks' },
    ...(isAdmin ? [{ id: 'manage' as BooksTab, label: 'Manage' }] : []),
  ];

  let content: React.ReactNode;
  switch (activeTab) {
    case 'audiobooks':
      content = <AudiobooksView />;
      break;
    case 'manage':
      // Non-admins never see the tab; guard anyway.
      content = isAdmin ? <ManageView /> : <LibraryView />;
      break;
    default:
      content = <LibraryView />;
  }

  return (
    <>
      <MediaShell
        moduleVar="--mod-books"
        title="Books"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => useBooksStore.getState().setActiveTab(id as BooksTab)}
        toolbar={
          activeTab !== 'manage' ? (
            <MediaToolbar
              search={search}
              onSearchChange={(q) => useBooksStore.getState().setSearch(q)}
              searchPlaceholder="Search books…"
              {...(activeTab === 'library' ? {
                aiSlot: true,
                aiActive: aiSearch,
                onAiToggle: () => useBooksStore.getState().toggleAiSearch(),
                aiPlaceholder: 'Describe a book…',
              } : {})}
            />
          ) : undefined
        }
      >
        {content}
      </MediaShell>

      {/* Fullscreen reader overlay (owned by the reader agent). */}
      {readingBook && (
        <ReaderView book={readingBook} onClose={() => useBooksStore.getState().closeBook()} />
      )}
    </>
  );
}

// Router lazy() contract
export function Component() {
  return <BooksPage />;
}
