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
 * Central registry of keyboard shortcuts displayed in
 * Settings → Shortcuts. The cheatsheet reads from here so adding a
 * shortcut to a module just requires appending an entry below — no
 * separate UI edit.
 *
 * Mark `planned: true` for shortcuts that aren't implemented yet
 * (the cheatsheet shows them grayed with "(coming soon)").
 *
 * The `keys` field uses the convention `Mod + X` where `Mod` is the
 * platform modifier (Cmd on Mac, Ctrl elsewhere). The renderer
 * substitutes the actual symbol at display time.
 */

export interface ShortcutEntry {
  /** Display key combo. Use "Mod" for Cmd/Ctrl, "Shift", "Alt". */
  keys: string;
  /** Human-readable action */
  description: string;
  /** Show as planned/unimplemented (grayed + "(coming soon)") */
  planned?: boolean;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: 'Mod + K', description: 'Open command palette' },
      { keys: '/', description: 'Focus search input (Settings sidebar)' },
    ],
  },
  {
    title: 'Notes',
    shortcuts: [
      { keys: 'Mod + N', description: 'New note' },
      { keys: 'Mod + B', description: 'Bold (in editor)' },
      { keys: 'Mod + I', description: 'Italic (in editor)' },
      { keys: 'Mod + U', description: 'Underline (in editor)' },
      { keys: 'Mod + Shift + X', description: 'Strikethrough (in editor)' },
    ],
  },
  {
    title: 'Contacts',
    shortcuts: [
      { keys: 'Mod + N', description: 'New contact' },
    ],
  },
  {
    title: 'Mail',
    shortcuts: [
      { keys: 'E', description: 'Archive selected email', planned: true },
      { keys: '#', description: 'Delete selected email', planned: true },
      { keys: 'R', description: 'Reply', planned: true },
      { keys: 'S', description: 'Toggle star', planned: true },
      { keys: 'U', description: 'Mark as unread', planned: true },
      { keys: 'Esc', description: 'Go back / deselect', planned: true },
    ],
  },
  {
    title: 'Agents',
    shortcuts: [
      { keys: 'Mod + S', description: 'Save edits in identity / workspaces' },
    ],
  },
  {
    title: 'Office & Terminal',
    shortcuts: [
      { keys: 'Ctrl + Shift + F', description: 'Find in document / terminal' },
      { keys: 'Ctrl + Tab', description: 'Next terminal tab' },
    ],
  },
  {
    title: 'MicelHub',
    shortcuts: [
      { keys: 'Mod + S', description: 'Save edits in app editor' },
    ],
  },
];

/**
 * Replace `Mod` with the platform-appropriate symbol for display.
 * `⌘` = ⌘ on macOS, otherwise "Ctrl".
 */
export function renderKeys(keys: string, isMac: boolean): string {
  return keys.replace(/\bMod\b/g, isMac ? '⌘' : 'Ctrl');
}
