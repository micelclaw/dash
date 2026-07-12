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
  MessageSquare, MessageCircle, Search, StickyNote, Calendar, Mail, Users,
  BookOpen, FolderOpen, Image, Bot, HardDrive, Database,
  Settings, Puzzle, Activity, Wrench, LineChart,
  Shapes, Kanban, Rss, Container, FileText, Cable,
  Wallet, Receipt, Bitcoin, Antenna, Globe, Orbit,
  Terminal, Radio, Server, Hammer, Boxes, Bookmark, Music, Clapperboard, Library,
} from 'lucide-react';
import type { ModuleConfig } from '@/types/modules';

export const MODULES: ModuleConfig[] = [
  { id: 'chat',     label: 'AI Chat',       icon: MessageSquare, color: 'var(--mod-chat)',     path: '/chat',     group: null },
  { id: 'search',   label: 'Search',        icon: Search,        color: 'var(--mod-search)',   path: '/search',   group: null },
  { id: 'agents',   label: 'Agents',        icon: Bot,           color: 'var(--mod-agents)',   path: '/agents',   group: null },
  { id: 'micelhub', label: 'MicelHub',      icon: Puzzle,        color: 'var(--mod-micelhub)', path: '/micelhub', group: null },
  { id: 'studio',   label: 'Studio',        icon: Hammer,        color: 'var(--mod-studio, var(--amber))', path: '/studio',   group: null, desktopOnly: true },
  { id: 'gateway',  label: 'Gateway',       icon: Radio,         color: 'var(--mod-gateway)',  path: '/gateway',  group: null, adminOnly: true },
  // MicelFlow retirado (2026-06-30): la automatización vive ahora en n8n (app `n8n-automation`,
  // módulo dinámico que aparece al instalarla). Ver docs/integrations/n8n.md.
  // Productivity
  { id: 'notes',    label: 'Notes',         icon: StickyNote,    color: 'var(--mod-notes)',    path: '/notes',    group: 'Productivity' },
  { id: 'calendar', label: 'Calendar',      icon: Calendar,      color: 'var(--mod-calendar)', path: '/calendar', group: 'Productivity' },
  { id: 'mail',     label: 'Mail',          icon: Mail,          color: 'var(--mod-mail)',     path: '/mail',     group: 'Productivity' },
  { id: 'contacts', label: 'Contacts',      icon: Users,         color: 'var(--mod-contacts)', path: '/contacts', group: 'Productivity' },
  { id: 'diary',    label: 'Diary',         icon: BookOpen,      color: 'var(--mod-diary)',    path: '/diary',    group: 'Productivity' },
  { id: 'bookmarks', label: 'Bookmarks',   icon: Bookmark,      color: 'var(--mod-bookmarks)', path: '/bookmarks', group: 'Productivity' },
  { id: 'tools',    label: 'Tools',         icon: Wrench,        color: 'var(--mod-tools)',    path: '/tools',    group: 'Productivity' },
  { id: 'sketches', label: 'Sketches',      icon: Shapes,        color: 'var(--mod-sketches)', path: '/sketches', group: 'Productivity' },
  { id: 'projects', label: 'Projects',     icon: Kanban,        color: 'var(--mod-projects)', path: '/projects', group: 'Productivity' },
  { id: 'inventory', label: 'Inventory',   icon: Boxes,         color: 'var(--mod-inventory)', path: '/inventory', group: 'Productivity' },
  { id: 'office',   label: 'Office',       icon: FileText,      color: 'var(--mod-office)',   path: '/office',   group: 'Productivity' },
  // Finance
  { id: 'finance',      label: 'Finance',        icon: Wallet,   color: 'var(--mod-finance)', path: '/finance',              group: 'Finance' },
  { id: 'firefly',      label: 'Firefly III',    icon: Wallet,   color: 'var(--mod-finance)', path: '/finance/firefly',      group: 'Finance' },
  { id: 'solidinvoice', label: 'SolidInvoice',    icon: Receipt,  color: 'var(--mod-finance)', path: '/finance/solidinvoice', group: 'Finance' },
  { id: 'crypto',       label: 'Crypto Stack',    icon: Bitcoin,      color: '#f7931a',              path: '/crypto',              group: 'Finance' },
  // Multimedia
  { id: 'photos',   label: 'Photos',        icon: Image,         color: 'var(--mod-photos)',   path: '/photos',   group: 'Multimedia' },
  { id: 'video',    label: 'Video',         icon: Clapperboard,  color: 'var(--mod-video)',    path: '/video',    group: 'Multimedia' },
  { id: 'music',    label: 'Music',         icon: Music,         color: 'var(--mod-music)',    path: '/music',    group: 'Multimedia' },
  { id: 'books',    label: 'Books',         icon: Library,       color: 'var(--mod-books)',    path: '/books',    group: 'Multimedia' },
  { id: 'multimedia', label: 'Servarr',     icon: Antenna,       color: 'var(--mod-multimedia)', path: '/multimedia', group: 'Multimedia', adminOnly: true },
  // Social
  { id: 'messages', label: 'Messages',      icon: MessageCircle, color: 'var(--mod-chat)',     path: '/messages', group: 'Social' },
  { id: 'feeds',    label: 'Feeds',         icon: Rss,           color: 'var(--mod-feeds)',    path: '/feeds',    group: 'Social' },
  // Files
  { id: 'drive',    label: 'Drive',         icon: FolderOpen,    color: 'var(--mod-drive)',    path: '/drive',    group: 'Files' },
  { id: 'explorer', label: 'File Explorer', icon: HardDrive,     color: 'var(--mod-explorer)', path: '/explorer', group: 'Files' },
  // Network
  { id: 'vpn',       label: 'VPN',          icon: Cable,         color: 'var(--mod-vpn)',       path: '/vpn',       group: 'Network', adminOnly: true },
  { id: 'proxy',     label: 'Reverse Proxy', icon: Globe,        color: 'var(--mod-proxy)',     path: '/proxy',     group: 'Network', adminOnly: true },
  { id: 'dns',       label: 'DNS',          icon: Orbit,         color: '#3b82f6',              path: '/dns',       group: 'Network', adminOnly: true },
  { id: 'portainer', label: 'Portainer',   icon: Container,     color: 'var(--mod-portainer)', path: '/portainer', group: 'Network', adminOnly: true },
  // System
  { id: 'mail-server', label: 'Mail Server', icon: Server, color: 'var(--mod-mail)', path: '/mail-server', group: 'System', adminOnly: true },
  { id: 'terminal', label: 'Terminal',      icon: Terminal,      color: 'var(--mod-terminal)', path: '/terminal', group: 'System', adminOnly: true },
  { id: 'storage',  label: 'Storage',       icon: Database,      color: 'var(--mod-storage)',  path: '/storage',  group: 'System', adminOnly: true },
  { id: 'processes', label: 'Processes',     icon: Activity,      color: '#f97316',             path: '/processes', group: 'System', adminOnly: true },
  { id: 'activity', label: 'Activity Center', icon: LineChart,     color: '#22d3ee',             path: '/activity',  group: 'System', adminOnly: true },
  // { id: 'approvals', label: 'Approvals',    icon: ShieldCheck,   color: 'var(--mod-settings)', path: '/approvals', group: 'System' },
  { id: 'settings', label: 'Settings',      icon: Settings,      color: 'var(--mod-settings)', path: '/settings', group: 'System' },
];
