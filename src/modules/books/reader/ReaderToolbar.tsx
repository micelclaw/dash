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
 * Top toolbar of the EPUB reader overlay. Auto-hidden by ReaderView after
 * 3s of inactivity (slides up); always dark-translucent over the page,
 * regardless of the reading theme (PlayerView precedent).
 */

import { ArrowLeft, List, Settings } from 'lucide-react';

export interface ReaderToolbarProps {
  title: string;
  /** Current chapter (TOC item) label, if known. */
  chapter?: string | null;
  visible: boolean;
  onClose: () => void;
  onOpenToc: () => void;
  onOpenSettings: () => void;
}

export function ReaderToolbar({
  title,
  chapter,
  visible,
  onClose,
  onOpenToc,
  onOpenSettings,
}: ReaderToolbarProps) {
  return (
    <div
      className={`absolute inset-x-0 top-0 z-20 flex h-12 items-center gap-1 bg-black/60 px-2 text-white backdrop-blur-sm transition-all duration-200 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
      }`}
    >
      <button
        onClick={onClose}
        title="Close reader (Esc)"
        aria-label="Close reader"
        className="rounded-md p-2 hover:bg-white/15"
      >
        <ArrowLeft size={18} />
      </button>
      <div className="min-w-0 flex-1 px-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {chapter ? <p className="truncate text-xs text-white/60">{chapter}</p> : null}
      </div>
      <button
        onClick={onOpenToc}
        title="Table of contents"
        aria-label="Table of contents"
        className="rounded-md p-2 hover:bg-white/15"
      >
        <List size={18} />
      </button>
      <button
        onClick={onOpenSettings}
        title="Reader settings"
        aria-label="Reader settings"
        className="rounded-md p-2 hover:bg-white/15"
      >
        <Settings size={18} />
      </button>
    </div>
  );
}
