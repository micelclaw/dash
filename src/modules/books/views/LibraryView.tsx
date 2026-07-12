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

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Share2 } from 'lucide-react';
import { MediaCard, MediaGrid, MediaRail } from '@/components/media';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/EmptyState';
import { EntityShareModal } from '@/components/shared/EntityShareModal';
import { useBooksStore } from '@/stores/books.store';
import { coverUrl, type Book } from '@/services/books.service';

function BookCard({ book }: { book: Book }) {
  const openBook = useBooksStore((s) => s.openBook);
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <>
      <MediaCard
        image={book.cover ? coverUrl(book.id) : null}
        fallbackIcon={BookOpen}
        title={book.title}
        subtitle={book.author ?? undefined}
        aspect="poster"
        progress={book.progress?.fraction ?? undefined}
        onClick={() => openBook({ id: book.id, title: book.title })}
        menu={
          <DropdownMenuItem onClick={() => setShareOpen(true)}>
            <Share2 size={14} /> Compartir
          </DropdownMenuItem>
        }
      />
      {shareOpen && (
        <EntityShareModal
          open={shareOpen}
          entityType="book"
          entityId={book.id}
          entityTitle={book.title}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

/**
 * EPUB library: a 'Continue reading' rail (in-progress books by recency)
 * followed by the full grid of poster cards. Clicking a card opens the
 * fullscreen ReaderView overlay (rendered by BooksPage).
 */
export function LibraryView() {
  const books = useBooksStore((s) => s.books);
  const booksLoaded = useBooksStore((s) => s.booksLoaded);
  const loading = useBooksStore((s) => s.loadingBooks);
  const search = useBooksStore((s) => s.search);
  const aiSearch = useBooksStore((s) => s.aiSearch);
  const aiResults = useBooksStore((s) => s.aiResults);

  useEffect(() => {
    void useBooksStore.getState().loadBooks();
  }, []);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return books;
    // Modo IA: usa los resultados semánticos del servidor (puede estar vacío
    // mientras carga el índice → cae a filtro local entretanto).
    if (aiSearch) return aiResults ?? [];
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(query) ||
        (b.author ?? '').toLowerCase().includes(query),
    );
  }, [books, query, aiSearch, aiResults]);

  const continueReading = useMemo(() => {
    return books
      .filter((b) => {
        const f = b.progress?.fraction;
        return typeof f === 'number' && f > 0 && f < 1;
      })
      .sort((a, b) =>
        (b.progress?.updated_at ?? '').localeCompare(a.progress?.updated_at ?? ''),
      );
  }, [books]);

  if (!booksLoaded) {
    return loading ? (
      <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: '0.875rem' }}>Loading…</div>
    ) : null;
  }

  if (books.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Your library is empty"
        description="Drop .epub files into /data/media/libros to see them here. Readarr and Calibre-web feed this folder automatically."
      />
    );
  }

  if (query && filtered.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No books match your search"
        description={`Nothing in the library matches “${search.trim()}”.`}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
      {!query && continueReading.length > 0 && (
        <MediaRail title="Continue reading">
          {continueReading.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </MediaRail>
      )}

      <MediaGrid min={150}>
        {filtered.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </MediaGrid>
    </div>
  );
}
