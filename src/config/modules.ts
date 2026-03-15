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

import {
  MessageSquare, Search, StickyNote, Calendar, Mail, Users,
  BookOpen, FolderOpen, Image, Bot, HardDrive, Database,
  Settings, Puzzle, Bookmark, ShieldCheck, Activity, Wrench,
  Waypoints, Kanban, Rss, Container, FileText, Cable,
  Wallet, Receipt, Bitcoin, Zap, CreditCard, Clapperboard, Globe, Orbit,
  Terminal, Radio,
} from 'lucide-react';
import type { ModuleConfig } from '@/types/modules';

export const MODULES: ModuleConfig[] = [
  { id: 'chat',     label: 'AI Chat',       icon: MessageSquare, color: 'var(--mod-chat)',     path: '/chat',     group: null },
  { id: 'search',   label: 'Search',        icon: Search,        color: 'var(--mod-search)',   path: '/search',   group: null },
  { id: 'agents',   label: 'Agents',        icon: Bot,           color: 'var(--mod-agents)',   path: '/agents',   group: null },
  { id: 'clawhub',  label: 'ClawHub',       icon: Puzzle,        color: 'var(--mod-clawhub)',  path: '/clawhub',  group: null },
  { id: 'gateway',  label: 'Gateway',       icon: Radio,         color: 'var(--mod-gateway)',  path: '/gateway',  group: null },
  // Productivity
  { id: 'notes',    label: 'Notes',         icon: StickyNote,    color: 'var(--mod-notes)',    path: '/notes',    group: 'Productivity' },
  { id: 'calendar', label: 'Calendar',      icon: Calendar,      color: 'var(--mod-calendar)', path: '/calendar', group: 'Productivity' },
  { id: 'mail',     label: 'Mail',          icon: Mail,          color: 'var(--mod-mail)',     path: '/mail',     group: 'Productivity' },
  { id: 'contacts', label: 'Contacts',      icon: Users,         color: 'var(--mod-contacts)', path: '/contacts', group: 'Productivity' },
  { id: 'diary',    label: 'Diary',         icon: BookOpen,      color: 'var(--mod-diary)',    path: '/diary',    group: 'Productivity' },
  // { id: 'bookmarks', label: 'Bookmarks',   icon: Bookmark,      color: 'var(--mod-bookmarks)', path: '/bookmarks', group: 'Productivity' },
  { id: 'tools',    label: 'Tools',         icon: Wrench,        color: 'var(--mod-tools)',    path: '/tools',    group: 'Productivity' },
  { id: 'diagrams', label: 'Diagrams',      icon: Waypoints,     color: 'var(--mod-diagrams)', path: '/diagrams', group: 'Productivity' },
  { id: 'projects', label: 'Projects',     icon: Kanban,        color: 'var(--mod-projects)', path: '/projects', group: 'Productivity' },
  { id: 'office',   label: 'Office',       icon: FileText,      color: 'var(--mod-office)',   path: '/office',   group: 'Productivity' },
  // Finance
  { id: 'firefly',      label: 'Firefly III',    icon: Wallet,   color: 'var(--mod-finance)', path: '/finance/firefly',      group: 'Finance' },
  { id: 'solidinvoice', label: 'SolidInvoice',    icon: Receipt,  color: 'var(--mod-finance)', path: '/finance/solidinvoice', group: 'Finance' },
  { id: 'crypto',       label: 'Crypto Stack',    icon: Bitcoin,      color: '#f7931a',              path: '/crypto',              group: 'Finance' },
  // Multimedia
  { id: 'multimedia', label: 'Multimedia',  icon: Clapperboard,  color: 'var(--mod-multimedia)', path: '/multimedia', group: 'Multimedia' },
  // Social
  { id: 'feeds',    label: 'Feeds',         icon: Rss,           color: 'var(--mod-feeds)',    path: '/feeds',    group: 'Social' },
  // Files
  { id: 'drive',    label: 'Drive',         icon: FolderOpen,    color: 'var(--mod-drive)',    path: '/drive',    group: 'Files' },
  { id: 'photos',   label: 'Photos',        icon: Image,         color: 'var(--mod-photos)',   path: '/photos',   group: 'Files' },
  { id: 'explorer', label: 'File Explorer', icon: HardDrive,     color: 'var(--mod-explorer)', path: '/explorer', group: 'Files' },
  // Network
  { id: 'vpn',       label: 'VPN',          icon: Cable,         color: 'var(--mod-vpn)',       path: '/vpn',       group: 'Network' },
  { id: 'proxy',     label: 'Reverse Proxy', icon: Globe,        color: 'var(--mod-proxy)',     path: '/proxy',     group: 'Network' },
  { id: 'dns',       label: 'DNS',          icon: Orbit,         color: '#3b82f6',              path: '/dns',       group: 'Network' },
  { id: 'portainer', label: 'Portainer',   icon: Container,     color: 'var(--mod-portainer)', path: '/portainer', group: 'Network' },
  // System
  { id: 'terminal', label: 'Terminal',      icon: Terminal,      color: 'var(--mod-terminal)', path: '/terminal', group: 'System' },
  { id: 'storage',  label: 'Storage',       icon: Database,      color: 'var(--mod-storage)',  path: '/storage',  group: 'System' },
  { id: 'processes', label: 'Processes',     icon: Activity,      color: '#f97316',             path: '/processes', group: 'System' },
  // { id: 'approvals', label: 'Approvals',    icon: ShieldCheck,   color: 'var(--mod-settings)', path: '/approvals', group: 'System' },
  { id: 'settings', label: 'Settings',      icon: Settings,      color: 'var(--mod-settings)', path: '/settings', group: 'System' },
];
