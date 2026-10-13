/** Copyright (c) 2026 Micelclaw (Víctor García Valdunciel). */
import { createElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AudioLines, BookHeart, BookOpen, Bookmark, Bot, Boxes, Brain, CalendarDays,
  Camera, ClipboardList, Code2, ContactRound, Container,
  Database, FileCode2, FilePenLine, FileSpreadsheet, FileText, FolderOpen, Globe2,
  HeartPulse, Image, KanbanSquare, Lightbulb, Link2, Mail, Music2, Network,
  Newspaper, PlugZap, Puzzle, Radio, Router, Rss, Search, ServerCog,
  Share2, ShieldCheck, StickyNote, TerminalSquare, Video, WalletCards, Waypoints,
  Workflow,
} from 'lucide-react';
import type { ToolPresentationPayload } from '@/types/chat';

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  audio: AudioLines,
  bind: Link2,
  bookmarks: Bookmark,
  books: BookOpen,
  browser: Globe2,
  calendar: CalendarDays,
  capabilities: ShieldCheck,
  channels: Radio,
  contacts: ContactRound,
  databases: Database,
  diagrams: Workflow,
  diary: BookHeart,
  digest: Newspaper,
  dns: Network,
  docker: Container,
  emails: Mail,
  external_mcp: PlugZap,
  feeds: Rss,
  files: FolderOpen,
  finance: WalletCards,
  graph: Share2,
  hal: ServerCog,
  heartbeat: HeartPulse,
  insights: Lightbulb,
  inventory: Boxes,
  mcp: PlugZap,
  media: Image,
  music: Music2,
  network: Router,
  notes: StickyNote,
  office: FileSpreadsheet,
  openclaw: Bot,
  photos: Camera,
  projects: KanbanSquare,
  proxy: Waypoints,
  runtime: TerminalSquare,
  search: Search,
  services: ServerCog,
  similar: Search,
  skills: Puzzle,
  video: Video,
  vpn: ShieldCheck,
  workboard: ClipboardList,
};

function nativeIcon(toolName: string): LucideIcon {
  const name = toolName.toLowerCase();
  if (['bash', 'exec', 'process'].includes(name)) return TerminalSquare;
  if (name === 'read') return FileText;
  if (['write', 'edit', 'apply_patch'].includes(name)) return FilePenLine;
  if (name.includes('memory')) return Brain;
  if (name.includes('search')) return Search;
  if (name.includes('browser') || name.includes('web')) return Globe2;
  if (name.includes('session') || name.includes('agent')) return Share2;
  if (name === 'cron') return CalendarDays;
  if (name === 'image') return Image;
  if (name === 'canvas') return FileCode2;
  if (name === 'gateway' || name === 'nodes') return ServerCog;
  if (name === 'message') return Mail;
  if (name === 'tts') return AudioLines;
  return Code2;
}

export function ToolDomainIcon({ payload, toolName, size = 14 }: {
  payload: ToolPresentationPayload;
  toolName: string;
  size?: number;
}) {
  const Icon = DOMAIN_ICONS[payload.domain] ?? nativeIcon(toolName);
  return createElement(Icon, {
    size,
    strokeWidth: 1.8,
    'aria-hidden': true,
    style: { color: 'var(--text-muted)', flexShrink: 0 },
  });
}
