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
 * Minimal ambient typings for the vendored foliate-js modules
 * (src/vendor/foliate-js — excluded from typecheck). Only the surface the
 * books reader actually uses is declared here; everything else stays
 * untyped on purpose.
 */

declare module '@/vendor/foliate-js/view.js' {
  /** A node of the parsed book's table of contents. */
  export interface FoliateTocItem {
    label: string;
    href?: string | null;
    subitems?: FoliateTocItem[] | null;
  }

  export interface FoliateBook {
    metadata?: {
      title?: unknown;
      author?: unknown;
      language?: unknown;
    };
    toc?: FoliateTocItem[];
    dir?: string;
    rendition?: { layout?: string };
    getCover?: () => Promise<Blob | null>;
  }

  /** Detail of the `relocate` event (also `view.lastLocation`). */
  export interface FoliateRelocateDetail {
    cfi: string;
    fraction: number;
    location?: { current: number; next: number; total: number };
    time?: { section: number; total: number };
    section?: { current: number; total: number };
    tocItem?: FoliateTocItem | null;
    pageItem?: FoliateTocItem | null;
    range?: Range;
  }

  export interface FoliateLoadDetail {
    doc: Document;
    index: number;
  }

  /** The annotation shape foliate keys overlays by (`value` = CFI). */
  export interface FoliateAnnotation {
    value: string;
    color?: string;
    note?: string;
  }

  export type FoliateDrawFunc = (
    rects: Iterable<DOMRect>,
    options?: Record<string, unknown>,
  ) => Element;

  export interface FoliateDrawAnnotationDetail {
    draw: (func: FoliateDrawFunc, options?: Record<string, unknown>) => void;
    annotation: FoliateAnnotation;
    doc: Document;
    range: Range;
  }

  export interface FoliateShowAnnotationDetail {
    value: string;
    index: number;
    range: Range;
  }

  export interface FoliateCreateOverlayDetail {
    index: number;
  }

  /** The renderer custom element (`foliate-paginator` / `foliate-fxl`). */
  export interface FoliateRenderer extends HTMLElement {
    /** Inject a user stylesheet into every section iframe. */
    setStyles?: (css: string) => void;
    getContents: () => Array<{ doc: Document; index: number; overlayer?: unknown }>;
    next: (distance?: number) => Promise<void>;
    prev: (distance?: number) => Promise<void>;
  }

  interface FoliateViewEventMap {
    relocate: CustomEvent<FoliateRelocateDetail>;
    load: CustomEvent<FoliateLoadDetail>;
    'draw-annotation': CustomEvent<FoliateDrawAnnotationDetail>;
    'show-annotation': CustomEvent<FoliateShowAnnotationDetail>;
    'create-overlay': CustomEvent<FoliateCreateOverlayDetail>;
    'external-link': CustomEvent<{ a: HTMLAnchorElement; href_: string }>;
  }

  /** The `<foliate-view>` custom element. */
  export class View extends HTMLElement {
    book: FoliateBook;
    renderer: FoliateRenderer;
    lastLocation: FoliateRelocateDetail | null;
    isFixedLayout: boolean;

    open(book: File | Blob | string | unknown): Promise<void>;
    close(): void;
    init(opts: { lastLocation?: string; showTextStart?: boolean }): Promise<void>;
    goTo(target: string | number): Promise<unknown>;
    goToFraction(fraction: number): Promise<void>;
    prev(distance?: number): Promise<void>;
    next(distance?: number): Promise<void>;
    goLeft(): Promise<void> | undefined;
    goRight(): Promise<void> | undefined;
    getCFI(index: number, range: Range): string;
    /**
     * Resolve + (when the section is rendered) draw an annotation.
     * Returns the spine index/TOC label of the resolved CFI, or throws if
     * the CFI cannot be resolved.
     */
    addAnnotation(
      annotation: FoliateAnnotation,
      remove?: boolean,
    ): Promise<{ index: number; label: string } | undefined>;
    deleteAnnotation(
      annotation: FoliateAnnotation,
    ): Promise<{ index: number; label: string } | undefined>;
    deselect(): void;
    getSectionFractions(): number[];

    addEventListener<K extends keyof FoliateViewEventMap>(
      type: K,
      listener: (this: View, ev: FoliateViewEventMap[K]) => void,
      options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener<K extends keyof FoliateViewEventMap>(
      type: K,
      listener: (this: View, ev: FoliateViewEventMap[K]) => void,
      options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ): void;
  }
}

declare module '@/vendor/foliate-js/overlayer.js' {
  import type { FoliateDrawFunc } from '@/vendor/foliate-js/view.js';

  /** SVG overlay used by foliate-view to draw highlights. */
  export class Overlayer {
    static highlight: FoliateDrawFunc;
    static underline: FoliateDrawFunc;
    static squiggly: FoliateDrawFunc;
    static outline: FoliateDrawFunc;
  }
}
