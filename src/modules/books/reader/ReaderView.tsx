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

/**
 * ReaderView — fullscreen EPUB reader overlay for the books module
 * (modules/video/PlayerView.tsx is the UX precedent: dark backdrop,
 * Esc closes, z-index over the shell).
 *
 * - Rendering: vendored foliate-js (`<foliate-view>` custom element),
 *   imported DYNAMICALLY so the whole engine ships as lazy chunks.
 * - The EPUB is fetched as a Blob via `?token=` auth (audio-engine
 *   pattern) and handed to `view.open()` (zip → EPUB via @zip.js/zip.js).
 * - Position: restored from GET progress (goTo cfi); saved on `relocate`
 *   (debounced 2s) and flushed keepalive on close/unmount/pagehide.
 * - Paging: click zones, ArrowLeft/ArrowRight (host + inside the book
 *   iframe), native foliate swipe; bottom fraction slider.
 * - Annotations: selection → SelectionPopover → POST; drawn with
 *   Overlayer.highlight, re-drawn per section via 'create-overlay'.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  FoliateTocItem,
  View as FoliateView,
} from '@/vendor/foliate-js/view.js';
import type { Overlayer as FoliateOverlayer } from '@/vendor/foliate-js/overlayer.js';
import { useAuthStore } from '@/stores/auth.store';
import { Slider } from '@/components/ui/slider';
import { ReaderToolbar } from './ReaderToolbar';
import { TocDrawer } from './TocDrawer';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
import { SelectionPopover, type SelectionPopoverState } from './SelectionPopover';
import {
  booksService,
  type BookAnnotation,
  type SaveProgressBody,
} from '@/services/books.service';
import {
  READER_THEMES,
  loadPrefs,
  prefsToCSS,
  savePrefs,
  type ReaderPrefs,
} from './reader-prefs';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const SAVE_DEBOUNCE_MS = 2_000;
const TOOLBAR_IDLE_MS = 3_000;

export interface ReaderViewProps {
  book: { id: string; title: string };
  onClose: () => void;
}

/** Download the EPUB with ?token= auth (one 401-refresh retry). */
async function fetchEpubFile(id: string, title: string): Promise<File> {
  const get = () => {
    const tok = useAuthStore.getState().tokens?.accessToken ?? '';
    return fetch(
      `${BASE_URL}/api/v1/books/${encodeURIComponent(id)}/file?token=${encodeURIComponent(tok)}`,
    );
  };
  let res = await get();
  if (res.status === 401) {
    try {
      await useAuthStore.getState().refresh();
      res = await get();
    } catch {
      /* fall through to the !ok check */
    }
  }
  if (!res.ok) throw new Error(`Could not download the book (HTTP ${res.status})`);
  const blob = await res.blob();
  return new File([blob], `${title || 'book'}.epub`, { type: 'application/epub+zip' });
}

/** Map a Range inside a section iframe to viewport coordinates. */
function rangeViewportPoint(range: Range, doc: Document): { x: number; y: number } {
  const rect = range.getBoundingClientRect();
  const frame = doc.defaultView?.frameElement?.getBoundingClientRect();
  return {
    x: (frame?.left ?? 0) + rect.left + rect.width / 2,
    y: (frame?.top ?? 0) + rect.bottom,
  };
}

interface AnnotationStore {
  byCfi: Map<string, BookAnnotation>;
  /** spine index → cfis drawn in that section (for 'create-overlay' redraw). */
  byIndex: Map<number, Set<string>>;
  indexByCfi: Map<string, number>;
}

export function ReaderView({ book, onClose }: ReaderViewProps) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  // Título derivado del EPUB cuando el caller no lo aporta (p.ej. deep-link
  // ?book=<id> desde el search global, que solo trae el id).
  const [derivedTitle, setDerivedTitle] = useState('');
  const displayTitle = book.title || derivedTitle;
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fraction, setFraction] = useState(0);
  const [chapter, setChapter] = useState<string | null>(null);
  const [currentTocHref, setCurrentTocHref] = useState<string | null>(null);
  const [toc, setToc] = useState<FoliateTocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [selection, setSelection] = useState<SelectionPopoverState | null>(null);
  const [annotationBusy, setAnnotationBusy] = useState(false);
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => loadPrefs());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<FoliateView | null>(null);
  const overlayerRef = useRef<typeof FoliateOverlayer | null>(null);
  const annotationsRef = useRef<AnnotationStore>({
    byCfi: new Map(),
    byIndex: new Map(),
    indexByCfi: new Map(),
  });
  const pendingRef = useRef<SaveProgressBody | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const prefsRef = useRef(prefs);
  // Mirrors readable from window-level handlers without re-binding them.
  const tocOpenRef = useRef(false);
  const settingsOpenRef = useRef(false);
  const selectionRef = useRef<SelectionPopoverState | null>(null);
  tocOpenRef.current = tocOpen;
  settingsOpenRef.current = settingsOpen;
  selectionRef.current = selection;

  // ── Progress persistence ──
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      booksService.saveProgress(book.id, pending).catch(() => {
        // Keep it around so the close/unload flush retries (newer wins).
        pendingRef.current ??= pending;
      });
    }, SAVE_DEBOUNCE_MS);
  }, [book.id]);

  /** Flush the last unsaved position. keepalive + ?token= so it survives
   *  teardown/unload (api.ts AbortSignal would cancel it). */
  const flushProgress = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const tok = useAuthStore.getState().tokens?.accessToken ?? '';
    void fetch(
      `${BASE_URL}/api/v1/books/${encodeURIComponent(book.id)}/progress?token=${encodeURIComponent(tok)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
        keepalive: true,
      },
    ).catch(() => {
      /* fire-and-forget */
    });
  }, [book.id]);

  const handleClose = useCallback(() => {
    flushProgress();
    onClose();
  }, [flushProgress, onClose]);

  // ── Toolbar auto-hide (3s idle) ──
  const bumpActivity = useCallback(() => {
    setToolbarVisible(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      if (tocOpenRef.current || settingsOpenRef.current || selectionRef.current) return;
      setToolbarVisible(false);
    }, TOOLBAR_IDLE_MS);
  }, []);

  // ── Annotations ──
  /** Resolve + draw (when rendered) one annotation; record its section. */
  const registerAnnotation = useCallback(async (ann: BookAnnotation) => {
    const view = viewRef.current;
    if (!view) return;
    const store = annotationsRef.current;
    store.byCfi.set(ann.cfi, ann);
    try {
      const res = await view.addAnnotation({
        value: ann.cfi,
        color: ann.color,
        note: ann.note ?? undefined,
      });
      if (res) {
        store.indexByCfi.set(ann.cfi, res.index);
        const set = store.byIndex.get(res.index) ?? new Set<string>();
        set.add(ann.cfi);
        store.byIndex.set(res.index, set);
      }
    } catch {
      // Unresolvable CFI (book edition mismatch) — keep it in byCfi only.
    }
  }, []);

  const handleCreateHighlight = useCallback(
    async (color: string, note?: string) => {
      if (selectionRef.current?.kind !== 'create') return;
      const { cfi, text } = selectionRef.current;
      setAnnotationBusy(true);
      try {
        const created = await booksService.createAnnotation(book.id, {
          cfi,
          color,
          ...(note ? { note } : {}),
          ...(text ? { selected_text: text.slice(0, 1000) } : {}),
        });
        await registerAnnotation(created);
        viewRef.current?.deselect();
        setSelection(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save the highlight';
        toast.error('Highlight failed', { description: message });
      } finally {
        setAnnotationBusy(false);
      }
    },
    [book.id, registerAnnotation],
  );

  const handleDeleteAnnotation = useCallback(async () => {
    if (selectionRef.current?.kind !== 'view') return;
    const ann = selectionRef.current.annotation;
    setAnnotationBusy(true);
    try {
      await booksService.deleteAnnotation(ann.id);
      const store = annotationsRef.current;
      store.byCfi.delete(ann.cfi);
      const index = store.indexByCfi.get(ann.cfi);
      if (index !== undefined) store.byIndex.get(index)?.delete(ann.cfi);
      store.indexByCfi.delete(ann.cfi);
      try {
        await viewRef.current?.deleteAnnotation({ value: ann.cfi });
      } catch {
        /* overlay not rendered — nothing to undraw */
      }
      setSelection(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete the highlight';
      toast.error('Delete failed', { description: message });
    } finally {
      setAnnotationBusy(false);
    }
  }, []);

  // ── Mount: load foliate + the book, wire every event ──
  useEffect(() => {
    let disposed = false;

    const handleArrowKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void viewRef.current?.goLeft();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        void viewRef.current?.goRight();
      }
    };

    (async () => {
      // 1. Lazy-load the engine (its own chunks — keeps foliate out of the
      //    main bundle, same pattern as hls.js in the video PlayerView).
      const [viewMod, overlayerMod] = await Promise.all([
        import('@/vendor/foliate-js/view.js'),
        import('@/vendor/foliate-js/overlayer.js'),
      ]);
      void viewMod; // side effect: defines <foliate-view>
      overlayerRef.current = overlayerMod.Overlayer;

      // 2. Download the EPUB.
      const file = await fetchEpubFile(book.id, book.title);
      if (disposed) return;

      // 3. Create + open the view.
      const container = containerRef.current;
      if (!container) return;
      const view = document.createElement('foliate-view') as FoliateView;
      // Custom elements default to display:inline — size it explicitly so
      // the paginator's :host { width/height: 100% } has a box to fill.
      view.style.display = 'block';
      view.style.width = '100%';
      view.style.height = '100%';

      view.addEventListener('relocate', (e) => {
        const { cfi, fraction: frac, tocItem } = e.detail;
        setFraction(frac);
        setChapter(tocItem?.label?.trim() || null);
        setCurrentTocHref(tocItem?.href ?? null);
        setSelection(null);
        if (cfi) {
          pendingRef.current = { cfi, fraction: frac };
          scheduleSave();
        }
      });

      view.addEventListener('load', (e) => {
        const { doc, index } = e.detail;
        // Keys + activity must also work while focus is inside the iframe.
        doc.addEventListener('keydown', (ke) => {
          if (ke.key === 'Escape') {
            setSelection(null);
            return;
          }
          handleArrowKey(ke);
        });
        doc.addEventListener('pointermove', bumpActivity);
        doc.addEventListener('pointerdown', () => {
          bumpActivity();
          setSelection(null);
        });
        // Selection → create-highlight popover. Deferred a tick so the
        // browser finalizes the selection before we read it.
        doc.addEventListener('pointerup', () => {
          window.setTimeout(() => {
            const view2 = viewRef.current;
            const sel = doc.getSelection();
            if (!view2 || !sel || sel.isCollapsed || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            const text = sel.toString().trim();
            if (!text) return;
            let cfi: string;
            try {
              cfi = view2.getCFI(index, range);
            } catch {
              return;
            }
            const { x, y } = rangeViewportPoint(range, doc);
            setSelection({ kind: 'create', x, y, cfi, text });
          }, 0);
        });
      });

      // Highlight rendering: foliate asks us how to draw each annotation…
      view.addEventListener('draw-annotation', (e) => {
        const { draw, annotation } = e.detail;
        const overlayer = overlayerRef.current;
        if (!overlayer) return;
        draw(overlayer.highlight, { color: annotation.color ?? '#facc15' });
      });
      // …and we re-add the section's annotations whenever it (re)renders.
      view.addEventListener('create-overlay', (e) => {
        const { index } = e.detail;
        const store = annotationsRef.current;
        const cfis = store.byIndex.get(index);
        if (!cfis) return;
        for (const cfi of cfis) {
          const ann = store.byCfi.get(cfi);
          if (!ann) continue;
          view
            .addAnnotation({ value: ann.cfi, color: ann.color, note: ann.note ?? undefined })
            .catch(() => {});
        }
      });
      // Clicking a drawn highlight → note/delete popover.
      view.addEventListener('show-annotation', (e) => {
        const { value, index, range } = e.detail;
        const ann = annotationsRef.current.byCfi.get(value);
        if (!ann) return;
        const doc = view.renderer.getContents().find((c) => c.index === index)?.doc;
        const { x, y } = doc
          ? rangeViewportPoint(range, doc)
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        setSelection({ kind: 'view', x, y, annotation: ann });
      });

      container.replaceChildren(view);
      await view.open(file);
      if (disposed) {
        view.close();
        view.remove();
        return;
      }
      viewRef.current = view;
      setToc(view.book.toc ?? []);
      if (!book.title) {
        const epubTitle = (view.book as { metadata?: { title?: unknown } } | undefined)?.metadata?.title;
        if (typeof epubTitle === 'string' && epubTitle.trim()) setDerivedTitle(epubTitle.trim());
      }
      view.renderer.setStyles?.(prefsToCSS(prefsRef.current));

      // 4. Saved position + existing annotations (tolerate either failing).
      const [progress, annotations] = await Promise.all([
        booksService.getProgress(book.id).catch(() => null),
        booksService.listAnnotations(book.id).catch((): BookAnnotation[] => []),
      ]);
      if (disposed) return;
      for (const ann of annotations) await registerAnnotation(ann);
      if (disposed) return;

      // 5. Render at the saved location (or the text start).
      await view.init({ lastLocation: progress?.cfi ?? undefined, showTextStart: true });
      if (disposed) return;
      setPhase('ready');
      bumpActivity();
    })().catch((err: unknown) => {
      if (disposed) return;
      const message = err instanceof Error ? err.message : 'Could not open the book';
      setErrorMsg(message);
      setPhase('error');
      toast.error('Could not open the book', { description: message });
    });

    return () => {
      disposed = true;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      flushProgress();
      const view = viewRef.current;
      viewRef.current = null;
      if (view) {
        try {
          view.close();
        } catch {
          /* already torn down */
        }
        view.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  // ── Window-level keys (capture, PlayerView precedent) + unload flush ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Radix closes its own open sheet on Esc — don't also close the reader.
        if (tocOpenRef.current || settingsOpenRef.current) return;
        if (selectionRef.current) {
          setSelection(null);
          return;
        }
        e.stopPropagation();
        handleClose();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (tocOpenRef.current || settingsOpenRef.current) return;
        e.preventDefault();
        if (e.key === 'ArrowLeft') void viewRef.current?.goLeft();
        else void viewRef.current?.goRight();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pagehide', flushProgress);
    window.addEventListener('beforeunload', flushProgress);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pagehide', flushProgress);
      window.removeEventListener('beforeunload', flushProgress);
    };
  }, [handleClose, flushProgress]);

  // ── Prefs: persist + re-style the book iframes live ──
  useEffect(() => {
    prefsRef.current = prefs;
    savePrefs(prefs);
    viewRef.current?.renderer.setStyles?.(prefsToCSS(prefs));
  }, [prefs]);

  const theme = READER_THEMES[prefs.theme];
  const showChrome = toolbarVisible || phase !== 'ready';

  return (
    <div
      className="fixed inset-0 z-[350] flex flex-col"
      style={{ background: theme.bg }}
      role="dialog"
      aria-label={`Reading ${displayTitle || 'book'}`}
      onPointerMove={bumpActivity}
    >
      {/* Book canvas (foliate-view is appended here) */}
      <div ref={containerRef} className="absolute inset-0" />

      {phase === 'loading' ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
          style={{ background: theme.bg, color: theme.dim }}
        >
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">{displayTitle ? `Opening “${displayTitle}”…` : 'Opening…'}</p>
          <button
            onClick={handleClose}
            className="mt-2 rounded-md border px-4 py-2 text-sm"
            style={{ borderColor: theme.dim, color: theme.fg }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
          style={{ background: theme.bg, color: theme.fg }}
        >
          <p className="max-w-md text-center text-sm">{errorMsg}</p>
          <button
            onClick={handleClose}
            className="rounded-md border px-4 py-2 text-sm"
            style={{ borderColor: theme.dim }}
          >
            Close
          </button>
        </div>
      ) : null}

      {phase === 'ready' ? (
        <>
          {/* Click zones */}
          <button
            aria-label="Previous page"
            onClick={() => void viewRef.current?.goLeft()}
            className="group absolute bottom-16 left-0 top-12 z-10 flex w-12 cursor-pointer items-center justify-center md:w-16"
          >
            <ChevronLeft
              size={28}
              className="opacity-0 transition-opacity group-hover:opacity-60"
              style={{ color: theme.dim }}
            />
          </button>
          <button
            aria-label="Next page"
            onClick={() => void viewRef.current?.goRight()}
            className="group absolute bottom-16 right-0 top-12 z-10 flex w-12 cursor-pointer items-center justify-center md:w-16"
          >
            <ChevronRight
              size={28}
              className="opacity-0 transition-opacity group-hover:opacity-60"
              style={{ color: theme.dim }}
            />
          </button>

          {/* Bottom progress bar */}
          <div
            className={`absolute inset-x-0 bottom-0 z-20 flex h-14 items-center gap-3 bg-black/60 px-4 text-white backdrop-blur-sm transition-all duration-200 ${
              showChrome ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
            }`}
          >
            <Slider
              min={0}
              max={1000}
              step={1}
              value={[Math.round(fraction * 1000)]}
              onValueChange={([v]) => v !== undefined && setFraction(v / 1000)}
              onValueCommit={([v]) =>
                v !== undefined && void viewRef.current?.goToFraction(v / 1000)
              }
              aria-label="Reading progress"
            />
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-white/80">
              {Math.round(fraction * 100)}%
            </span>
          </div>
        </>
      ) : null}

      <ReaderToolbar
        title={displayTitle}
        chapter={chapter}
        visible={showChrome}
        onClose={handleClose}
        onOpenToc={() => setTocOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <TocDrawer
        open={tocOpen}
        onOpenChange={setTocOpen}
        bookTitle={displayTitle}
        toc={toc}
        currentHref={currentTocHref}
        onNavigate={(href) => {
          setTocOpen(false);
          viewRef.current?.goTo(href)?.catch(() => {
            toast.error('Could not open that chapter');
          });
        }}
      />

      <ReaderSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        prefs={prefs}
        onChange={setPrefs}
      />

      {selection ? (
        <SelectionPopover
          state={selection}
          busy={annotationBusy}
          onHighlight={(color, note) => void handleCreateHighlight(color, note)}
          onDelete={() => void handleDeleteAnnotation()}
          onClose={() => {
            viewRef.current?.deselect();
            setSelection(null);
          }}
        />
      ) : null}
    </div>
  );
}
