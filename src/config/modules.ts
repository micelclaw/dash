import {
  MessageSquare, Search, StickyNote, Calendar, Mail, Users,
  BookOpen, FolderOpen, Image, Bot, HardDrive, Database,
  Settings, Puzzle, Bookmark,
} from 'lucide-react';
import type { ModuleConfig } from '@/types/modules';

export const MODULES: ModuleConfig[] = [
  { id: 'chat',     label: 'AI Chat',       icon: MessageSquare, color: 'var(--mod-chat)',     path: '/chat',     group: null },
  { id: 'search',   label: 'Search',        icon: Search,        color: 'var(--mod-chat)',     path: '/search',   group: null },
  // Productivity
  { id: 'notes',    label: 'Notes',         icon: StickyNote,    color: 'var(--mod-notes)',    path: '/notes',    group: 'Productivity' },
  { id: 'calendar', label: 'Calendar',      icon: Calendar,      color: 'var(--mod-calendar)', path: '/calendar', group: 'Productivity' },
  { id: 'mail',     label: 'Mail',          icon: Mail,          color: 'var(--mod-mail)',     path: '/mail',     group: 'Productivity' },
  { id: 'contacts', label: 'Contacts',      icon: Users,         color: 'var(--mod-contacts)', path: '/contacts', group: 'Productivity' },
  { id: 'diary',    label: 'Diary',         icon: BookOpen,      color: 'var(--mod-diary)',    path: '/diary',    group: 'Productivity' },
  { id: 'bookmarks', label: 'Bookmarks',   icon: Bookmark,      color: 'var(--mod-bookmarks)', path: '/bookmarks', group: 'Productivity' },
  // Files
  { id: 'drive',    label: 'Drive',         icon: FolderOpen,    color: 'var(--mod-drive)',    path: '/drive',    group: 'Files' },
  { id: 'photos',   label: 'Photos',        icon: Image,         color: 'var(--mod-photos)',   path: '/photos',   group: 'Files' },
  { id: 'explorer', label: 'File Explorer', icon: HardDrive,     color: 'var(--mod-explorer)', path: '/explorer', group: 'Files' },
  // System
  { id: 'agents',   label: 'Agents',        icon: Bot,           color: 'var(--mod-agents)',   path: '/agents',   group: 'System' },
  { id: 'storage',  label: 'Storage',       icon: Database,      color: 'var(--mod-storage)',  path: '/storage',  group: 'System' },
  { id: 'settings', label: 'Settings',      icon: Settings,      color: 'var(--mod-settings)', path: '/settings', group: 'System' },
  { id: 'clawhub',  label: 'ClawHub',       icon: Puzzle,        color: 'var(--mod-clawhub)',  path: '/clawhub',  group: 'System' },
];
