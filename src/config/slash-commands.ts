import {
  Brain,
  Lightbulb,
  Cpu,
  Zap,
  MessageSquare,
  RotateCcw,
  Square,
  Plus,
  Eraser,
  FileDown,
  Activity,
  BarChart3,
  Info,
  User,
  HelpCircle,
  Send,
  Volume2,
  Users,
  Layers,
  Wrench,
  RefreshCw,
  History,
  MessageSquareQuote,
  type LucideIcon,
} from 'lucide-react';

/**
 * Slash command groups (rendered as the colored badge next to each command
 * in the dropdown, ordered top-to-bottom in this order):
 *
 *  - session  — directives that mutate the chat session via sessions.patch
 *               (`/think`, `/reasoning`, `/model`, `/fast`, `/verbose`, `/send`)
 *  - context  — instant actions on the conversation context
 *               (`/compact`, `/reset`, `/new`, `/clear`)
 *  - info     — read-only queries that render a chip with the result
 *               (`/status`, `/usage`, `/context`, `/whoami`, `/models`,
 *                `/agents`, `/subagents`, `/tasks`, `/tools`, `/help`)
 *  - control  — Gateway / process control (`/stop`, `/restart` admin-only)
 */
export type CommandCategory = 'session' | 'context' | 'info' | 'control';

export interface SlashCommand {
  name: string;
  label: string;
  icon: LucideIcon;
  category: CommandCategory;
  /** If present, command has a submenu with these STATIC options */
  options?: string[];
  /**
   * If present, the submenu options are loaded at runtime from this source
   * (Fase 2). The menu fetches + renders them with a loading state.
   */
  dynamicOptions?: 'models';
  /** Text to send when no suboption is selected (defaults to `/${name}`) */
  directText?: string;
}

export const CATEGORY_COLORS: Record<CommandCategory, string> = {
  session: '#3b82f6', // blue   — directive (patches the session)
  context: '#a855f7', // purple — instant action on conversation context
  info: '#22c55e',    // green  — read-only query
  control: '#f59e0b', // amber  — system control (stop, restart)
};

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  session: 'Session',
  context: 'Context',
  info: 'Info',
  control: 'Control',
};

/**
 * The 23 native chat slash commands. Every entry has a real backend handler
 * in `core/src/ws/slash-commands.ts` — commands without a dispatcher are
 * never listed here so the menu can never "lie" (it used to send arbitrary
 * `/<word>` to the model as plain text, which produced "Entendido…" replies
 * instead of applying the directive).
 *
 * Order inside each category matters: it's the order shown in the dropdown.
 * `/exec` and `/elevated` were intentionally removed (duplicated Settings →
 * Security and constituted a silent override of the global exec policy).
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  // ── Session ── directives applied via sessions.patch
  { name: 'think', label: 'Think Level', icon: Lightbulb, category: 'session', options: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'adaptive'] },
  { name: 'reasoning', label: 'Reasoning Visibility', icon: Brain, category: 'session', options: ['on', 'off', 'stream'] },
  { name: 'model', label: 'Model', icon: Cpu, category: 'session', dynamicOptions: 'models' },
  { name: 'fast', label: 'Fast Mode', icon: Zap, category: 'session', options: ['on', 'off'] },
  { name: 'verbose', label: 'Verbose', icon: MessageSquare, category: 'session', options: ['on', 'off', 'full'] },
  { name: 'send', label: 'Send Policy', icon: Send, category: 'session', options: ['on', 'off', 'inherit'] },
  { name: 'tts', label: 'TTS auto-play (chat)', icon: Volume2, category: 'session', options: ['chat on', 'chat off', 'chat default'] },
  { name: 'btw', label: 'Side question (/btw)', icon: MessageSquareQuote, category: 'session' },

  // ── Context ── instant actions on the conversation context
  { name: 'compact', label: 'Compact Context', icon: FileDown, category: 'context' },
  { name: 'reset', label: 'Reset Session', icon: RotateCcw, category: 'context' },
  { name: 'new', label: 'New Session', icon: Plus, category: 'context' },
  { name: 'clear', label: 'Clear History', icon: Eraser, category: 'context' },

  // ── Info ── read-only queries (render a chip with the result)
  { name: 'status', label: 'Status', icon: Activity, category: 'info' },
  { name: 'usage', label: 'Usage', icon: BarChart3, category: 'info' },
  { name: 'context', label: 'Context Info', icon: Info, category: 'info' },
  { name: 'whoami', label: 'Who Am I', icon: User, category: 'info' },
  { name: 'models', label: 'List Models', icon: Cpu, category: 'info' },
  { name: 'agents', label: 'List Agents', icon: Users, category: 'info' },
  { name: 'subagents', label: 'Sub-agents', icon: Users, category: 'info' },
  { name: 'tasks', label: 'Background Tasks', icon: Layers, category: 'info' },
  { name: 'tools', label: 'List Tools', icon: Wrench, category: 'info' },
  { name: 'checkpoints', label: 'Restore Points', icon: History, category: 'info' },
  { name: 'help', label: 'Help', icon: HelpCircle, category: 'info' },

  // ── Control ── Gateway / process control
  { name: 'stop', label: 'Stop', icon: Square, category: 'control' },
  { name: 'restart', label: 'Restart Gateway', icon: RefreshCw, category: 'control' },
];

/**
 * True if `text` starts with a known slash command (matches the registry).
 *
 * Used by `chat.store.sendMessage()` to bypass the streaming lock for slash
 * commands. Without this, `/stop` (and any other slash) is blocked while a
 * model response is generating — exactly when the user needs it most. The
 * backend dispatcher processes slash commands independently of the active
 * stream, so letting them through is safe.
 *
 * Accepts `/foo`, `/foo args`, but rejects plain `/path/to/file` because the
 * first segment must match a registered command name.
 */
export function isKnownSlash(text: string): boolean {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return false;
  const m = trimmed.match(/^\/([a-z][a-z0-9-]*)(?:\s|$)/i);
  if (!m) return false;
  const name = m[1]!.toLowerCase();
  return SLASH_COMMANDS.some((c) => c.name === name);
}
