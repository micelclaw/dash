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
 * Left sheet listing the book's table of contents. Clicking an entry
 * navigates the foliate view (via onNavigate) and closes the drawer.
 */

import { ListX } from 'lucide-react';
import type { FoliateTocItem } from '@/vendor/foliate-js/view.js';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { EmptyState } from '@/components/shared/EmptyState';

export interface TocDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle: string;
  toc: FoliateTocItem[];
  /** href of the TOC item the reader is currently inside (highlighted). */
  currentHref: string | null;
  onNavigate: (href: string) => void;
}

function TocList({
  items,
  depth,
  currentHref,
  onNavigate,
}: {
  items: FoliateTocItem[];
  depth: number;
  currentHref: string | null;
  onNavigate: (href: string) => void;
}) {
  return (
    <ul className="flex flex-col">
      {items.map((item, i) => {
        const isCurrent = !!item.href && item.href === currentHref;
        return (
          <li key={`${depth}-${i}-${item.href ?? item.label}`}>
            <button
              disabled={!item.href}
              onClick={() => item.href && onNavigate(item.href)}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                isCurrent ? 'font-semibold' : ''
              } ${item.href ? 'cursor-pointer hover:bg-[var(--surface-hover,rgba(127,127,127,0.12))]' : 'cursor-default'}`}
              style={{
                paddingLeft: 8 + depth * 14,
                color: isCurrent ? 'var(--accent, var(--text))' : item.href ? 'var(--text)' : 'var(--text-dim)',
              }}
            >
              {item.label?.trim() || 'Untitled'}
            </button>
            {item.subitems?.length ? (
              <TocList
                items={item.subitems}
                depth={depth + 1}
                currentHref={currentHref}
                onNavigate={onNavigate}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function TocDrawer({
  open,
  onOpenChange,
  bookTitle,
  toc,
  currentHref,
  onNavigate,
}: TocDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" style={{ width: 320 }} aria-describedby={undefined}>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="pr-8">
            <h2 className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {bookTitle}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Table of contents
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {toc.length === 0 ? (
              <EmptyState
                icon={ListX}
                title="No table of contents"
                description="This book does not include navigation entries."
              />
            ) : (
              <TocList items={toc} depth={0} currentHref={currentHref} onNavigate={onNavigate} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
