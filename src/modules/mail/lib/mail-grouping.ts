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

import { startOfDay, startOfWeek, startOfMonth, addDays } from '@/lib/date-helpers';
import type { Email } from '../types';

export interface MailGroup {
  /** Stable identity for persisting the collapsed state. Never localised. */
  key: string;
  /** What the user reads. */
  label: string;
  emails: Email[];
}

/**
 * Buckets, newest first: Today · Yesterday · This week · Last week · This month ·
 * then one bucket per calendar month ("June", "June 2015" once the year differs).
 *
 * Deliberately NO catch-all "Older": this mailbox spans 2010→2026 and the list is
 * paginated, so a page deep in the archive would be a single "Older" header over 50
 * messages — exactly the orientation this feature exists to provide, thrown away.
 * Per-month headers stay informative at any depth.
 *
 * Pure and `now`-injectable so the boundaries (Monday, year change) are testable.
 */
export function groupEmailsByDate(emails: Email[], now: Date = new Date()): MailGroup[] {
  const today = startOfDay(now);
  const yesterday = addDays(today, -1);
  const thisWeek = startOfWeek(now, 1);
  const lastWeek = addDays(thisWeek, -7);
  const thisMonth = startOfMonth(now);

  const groups: MailGroup[] = [];
  const byKey = new Map<string, MailGroup>();

  const push = (key: string, label: string, email: Email) => {
    let group = byKey.get(key);
    if (!group) {
      group = { key, label, emails: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.emails.push(email);
  };

  for (const email of emails) {
    const d = new Date(email.received_at);
    // An unparseable date must not silently land in "Today".
    if (Number.isNaN(d.getTime())) {
      push('unknown', 'No date', email);
      continue;
    }

    if (d >= today) push('today', 'Today', email);
    else if (d >= yesterday) push('yesterday', 'Yesterday', email);
    else if (d >= thisWeek) push('this-week', 'This week', email);
    else if (d >= lastWeek) push('last-week', 'Last week', email);
    else if (d >= thisMonth) push('this-month', 'This month', email);
    else {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label =
        d.getFullYear() === now.getFullYear()
          ? d.toLocaleDateString('en', { month: 'long' })
          : d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
      push(key, label, email);
    }
  }

  return groups;
}

const COLLAPSED_STORAGE_KEY = 'mail-collapsed-groups';

/**
 * Collapsed state is scoped per folder: collapsing "June" in Inbox should not
 * collapse it in Sent.
 */
export function readCollapsedGroups(folder: string): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    const all = JSON.parse(raw) as Record<string, string[]>;
    return new Set(all[folder] ?? []);
  } catch {
    return new Set();
  }
}

export function writeCollapsedGroups(folder: string, collapsed: Set<string>): void {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    if (collapsed.size > 0) all[folder] = [...collapsed];
    else delete all[folder];
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // A full or disabled localStorage must not break the list.
  }
}
