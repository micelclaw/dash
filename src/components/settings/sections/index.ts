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
 * Registro único de secciones de Settings.
 *
 * Añadir una sección = UNA entrada aquí (component + meta). SettingsPage
 * deriva de este registro tanto el render por id como los items del
 * sidebar (via `meta.group`, en el ORDEN de inserción de este objeto).
 *
 * - Entradas con `meta.group` → aparecen en el sidebar dentro de ese grupo.
 * - Entradas sin `meta.group` → rutas válidas (/settings/<id>) pero ocultas
 *   del sidebar (alias como users/groups, o secciones plegadas dentro de un
 *   padre fusionado tras la reorganización de la Ola 9).
 *
 * Imports ESTÁTICOS a propósito (sin lazy) para no cambiar el chunking:
 * antes todas las secciones se importaban estáticamente desde SettingsPage.
 *
 * El buscador (settings-search-index.ts) sigue siendo un índice manual de
 * sinónimos bilingües — no se deriva de aquí; `validateSearchIndex` avisa
 * en dev si este registro y el índice divergen.
 */

import { createElement, type ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Globe, Cpu, RefreshCw, Mail, Image, Palette, Shield, CreditCard,
  Search as SearchIcon, Newspaper, HardDrive, FolderOpen, Users, Network, Zap,
  Bell, Calendar, Keyboard, Rss, Server, Database,
  Mic, Radio, Key, UserCircle, Copy, Brain, History, Link2,
  Container, Globe2, Terminal, Lock, Eye, Wrench, MemoryStick,
  Puzzle,
} from 'lucide-react';

import { AccountSection } from './AccountSection';
import { PermissionsSection } from './PermissionsSection';
import { LicenseSection } from './LicenseSection';
import { ApprovalsHistorySection } from './ApprovalsHistorySection';
import { DashSection } from './DashSection';
import { GeneralSection } from './GeneralSection';
import { ShortcutsSection } from './ShortcutsSection';
import { NotificationsSection } from './NotificationsSection';
import { AISection } from './AISection';
import { GpuVramSection } from './GpuVramSection';
import { VoiceSection } from './VoiceSection';
import { ToolAccessDefaultsSection } from './ToolAccessDefaultsSection';
import { ChatToolsSection } from './ChatToolsSection';
import { MemorySearchSection } from './MemorySearchSection';
import { ActiveMemorySection } from './ActiveMemorySection';
import { PreferencesSection } from './PreferencesSection';
import { SessionSection } from './SessionSection';
import { ChannelBindingsSection } from './ChannelBindingsSection';
import { MailSection } from './MailSection';
import { CalendarSection } from './CalendarSection';
import { PhotosSection } from './PhotosSection';
import { FeedsSection } from './FeedsSection';
import { SearchSection } from './SearchSection';
import { DigestSection } from './DigestSection';
import { DuplicatesSection } from './DuplicatesSection';
import { SyncSection } from './SyncSection';
import { NetworkSection } from './NetworkSection';
import { DomainsSection } from './DomainsSection';
import { GatewayAuthSection } from './GatewayAuthSection';
import { CompanionsSection } from './CompanionsSection';
import { StorageSection } from './StorageSection';
import { DriveSection } from './DriveSection';
import { DatabaseSection } from './DatabaseSection';
import { EnergySection } from './EnergySection';
import { ServicesSection } from './ServicesSection';
import { AutomationSection } from './AutomationSection';
import { SecuritySection } from './SecuritySection';
import { SandboxSection } from './SandboxSection';
import { BrowserConfigSection } from './BrowserConfigSection';
import { CommandsSection } from './CommandsSection';
import { UsersAndGroupsSection } from './users-groups/UsersAndGroupsSection';
import { SharedFoldersSection } from './SharedFoldersSection';
import { FileServicesSection } from './FileServicesSection';
import { ObservabilitySection } from './ObservabilitySection';
import { SecretsSection } from './SecretsSection';
import { AgentTokensSection } from './AgentTokensSection';
import { ChannelObserversSection } from './ChannelObserversSection';
import { DevicesSection } from './DevicesSection';
import { ApprovalsForwardingSection } from './ApprovalsForwardingSection';
import { CronConfigSection } from './CronConfigSection';
import { HooksSection } from './HooksSection';
import { LoggingSection } from './LoggingSection';
import { TelemetrySection } from './TelemetrySection';
import { EnvSection } from './EnvSection';
import { MyApiKeysSection } from './MyApiKeysSection';

/** Grupos del sidebar de Settings (las definiciones viven en SettingsPage). */
export type SettingsGroupId =
  | 'account'
  | 'appearance'
  | 'ai-agents'
  | 'apps'
  | 'connectivity'
  | 'system'
  | 'security'
  | 'admin'
  | 'dev';

export interface SettingsSectionMeta {
  /** Nombre visible en el sidebar (y fallback en resultados de búsqueda). */
  label: string;
  icon?: LucideIcon;
  /** Grupo del sidebar; sin él la sección es solo direccionable por URL. */
  group?: SettingsGroupId;
}

export interface SettingsSectionEntry {
  component: ComponentType;
  meta: SettingsSectionMeta;
}

// Alias de UsersAndGroupsSection con la pestaña inicial fijada (bookmarks
// legacy /settings/users y /settings/groups). Genérico explícito: la firma
// con props opcionales (`= {}`) hace que la inferencia de createElement
// caiga al overload sin props.
const UsersAliasSection: ComponentType = () =>
  createElement<{ initialTab?: 'users' | 'groups' }>(UsersAndGroupsSection, { initialTab: 'users' });
const GroupsAliasSection: ComponentType = () =>
  createElement<{ initialTab?: 'users' | 'groups' }>(UsersAndGroupsSection, { initialTab: 'groups' });

/**
 * Fuente de verdad de los IDs de sección válidos. El orden de inserción
 * dentro de cada grupo ES el orden visible del sidebar — no reordenar sin
 * querer cambiar la UI. ('raw' NO vive aquí: es la página standalone
 * /settings/raw; su item de sidebar lo añade SettingsPage al grupo admin.)
 */
export const SECTION_REGISTRY: Record<string, SettingsSectionEntry> = {
  // ── Account ──
  'account':              { component: AccountSection,              meta: { label: 'Account', icon: UserCircle, group: 'account' } },
  'permissions':          { component: PermissionsSection,          meta: { label: 'Permissions', icon: Shield, group: 'account' } },
  'license':              { component: LicenseSection,              meta: { label: 'License', icon: CreditCard, group: 'account' } },
  'approvals-history':    { component: ApprovalsHistorySection,     meta: { label: 'Approvals History', icon: History, group: 'account' } },

  // ── Appearance ──
  'dash':                 { component: DashSection,                 meta: { label: 'Dash', icon: Palette, group: 'appearance' } },
  'general':              { component: GeneralSection,              meta: { label: 'General', icon: Globe, group: 'appearance' } },
  'shortcuts':            { component: ShortcutsSection,            meta: { label: 'Shortcuts', icon: Keyboard, group: 'appearance' } },
  'notifications':        { component: NotificationsSection,        meta: { label: 'Notifications', icon: Bell, group: 'appearance' } },

  // ── AI & Agents ──
  'ai':                   { component: AISection,                   meta: { label: 'AI & Intelligence', icon: Cpu, group: 'ai-agents' } },
  'gpu-vram':             { component: GpuVramSection,              meta: { label: 'GPU & VRAM', icon: MemoryStick, group: 'ai-agents' } },
  'voice':                { component: VoiceSection,                meta: { label: 'Voice', icon: Mic, group: 'ai-agents' } },
  'tool-access-defaults': { component: ToolAccessDefaultsSection,   meta: { label: 'Tool Access', icon: Wrench, group: 'ai-agents' } },
  'chat-tools':           { component: ChatToolsSection,            meta: { label: 'Chat Tools Display', icon: Wrench, group: 'ai-agents' } },
  'memory-search':        { component: MemorySearchSection,         meta: { label: 'Memory', icon: Brain, group: 'ai-agents' } },
  'active-memory':        { component: ActiveMemorySection,         meta: { label: 'Memoria Activa', icon: Brain, group: 'ai-agents' } },
  'preferences':          { component: PreferencesSection,          meta: { label: 'Learned Preferences', icon: Brain, group: 'ai-agents' } },
  'sessions':             { component: SessionSection,              meta: { label: 'Sessions', icon: History, group: 'ai-agents' } },
  'channel-bindings':     { component: ChannelBindingsSection,      meta: { label: 'Channel Bindings', icon: Link2, group: 'ai-agents' } },

  // ── Apps ──
  'mail':                 { component: MailSection,                 meta: { label: 'Mail', icon: Mail, group: 'apps' } },
  'calendar':             { component: CalendarSection,             meta: { label: 'Calendar', icon: Calendar, group: 'apps' } },
  'photos':               { component: PhotosSection,               meta: { label: 'Photos', icon: Image, group: 'apps' } },
  'feeds':                { component: FeedsSection,                meta: { label: 'Feeds', icon: Rss, group: 'apps' } },
  'search':               { component: SearchSection,               meta: { label: 'Search', icon: SearchIcon, group: 'apps' } },
  'digest':               { component: DigestSection,               meta: { label: 'Digest', icon: Newspaper, group: 'apps' } },
  'duplicates':           { component: DuplicatesSection,           meta: { label: 'Duplicates', icon: Copy, group: 'apps' } },

  // ── Connectivity ──
  'sync':                 { component: SyncSection,                 meta: { label: 'Sync', icon: RefreshCw, group: 'connectivity' } },
  'network':              { component: NetworkSection,              meta: { label: 'Network', icon: Network, group: 'connectivity' } },
  'domains':              { component: DomainsSection,              meta: { label: 'Domains', icon: Globe2, group: 'connectivity' } },
  'gateway-auth':         { component: GatewayAuthSection,          meta: { label: 'Gateway', icon: Radio, group: 'connectivity' } },
  'companions':           { component: CompanionsSection,           meta: { label: 'Apps acompañantes', icon: Puzzle, group: 'connectivity' } },

  // ── System ──
  'storage':              { component: StorageSection,              meta: { label: 'Storage', icon: HardDrive, group: 'system' } },
  'drive':                { component: DriveSection,                meta: { label: 'Drive', icon: FolderOpen, group: 'system' } },
  'database':             { component: DatabaseSection,             meta: { label: 'Database', icon: Database, group: 'system' } },
  'energy':               { component: EnergySection,               meta: { label: 'Energy', icon: Zap, group: 'system' } },
  'services':             { component: ServicesSection,             meta: { label: 'Services', icon: Server, group: 'system' } },
  'automation':           { component: AutomationSection,           meta: { label: 'Automation', icon: Zap, group: 'system' } },

  // ── Security ──
  'security':             { component: SecuritySection,             meta: { label: 'Security', icon: Shield, group: 'security' } },
  'sandbox':              { component: SandboxSection,              meta: { label: 'Sandbox', icon: Container, group: 'security' } },
  'browser-config':       { component: BrowserConfigSection,        meta: { label: 'Browser', icon: Globe2, group: 'security' } },
  'commands':             { component: CommandsSection,             meta: { label: 'Commands', icon: Terminal, group: 'security' } },

  // ── Administration (solo admins; el gating lo aplica SettingsPage) ──
  'users-groups':         { component: UsersAndGroupsSection,       meta: { label: 'Usuarios y grupos', icon: Users, group: 'admin' } },
  'shared-folders':       { component: SharedFoldersSection,        meta: { label: 'Carpetas compartidas', icon: FolderOpen, group: 'admin' } },
  'file-services':        { component: FileServicesSection,         meta: { label: 'Servicios de archivos', icon: HardDrive, group: 'admin' } },
  'observability':        { component: ObservabilitySection,        meta: { label: 'Observability', icon: Eye, group: 'admin' } },
  'secrets':              { component: SecretsSection,              meta: { label: 'Secrets', icon: Lock, group: 'admin' } },

  // ── Dev (solo builds de desarrollo; el gating lo aplica SettingsPage) ──
  'agent-tokens':         { component: AgentTokensSection,          meta: { label: 'Agent Tokens', icon: Key, group: 'dev' } },

  // ── Solo por URL (sin entrada de sidebar) ──
  'users':                { component: UsersAliasSection,           meta: { label: 'Users' } },
  'groups':               { component: GroupsAliasSection,          meta: { label: 'Groups' } },
  'observers':            { component: ChannelObserversSection,     meta: { label: 'Channel Observers' } },
  'devices':              { component: DevicesSection,              meta: { label: 'Devices' } },
  'approvals-forwarding': { component: ApprovalsForwardingSection,  meta: { label: 'Approvals Forwarding' } },
  'cron-config':          { component: CronConfigSection,           meta: { label: 'Cron' } },
  'hooks':                { component: HooksSection,                meta: { label: 'Hooks & Webhooks' } },
  'logging':              { component: LoggingSection,              meta: { label: 'Logging' } },
  'telemetry':            { component: TelemetrySection,            meta: { label: 'Telemetry' } },
  'env':                  { component: EnvSection,                  meta: { label: 'Environment' } },
  'my-api-keys':          { component: MyApiKeysSection,            meta: { label: 'My API Keys' } },
};

/** IDs de sección válidos (para NotFound y el checker del índice de búsqueda). */
export const KNOWN_SECTION_IDS = Object.keys(SECTION_REGISTRY);
