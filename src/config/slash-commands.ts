import {
  Brain,
  Lightbulb,
  Cpu,
  Zap,
  MessageSquare,
  RotateCcw,
  Info,
  BarChart3,
  Activity,
  HelpCircle,
  List,
  Square,
  RefreshCw,
  User,
  Volume2,
  Shield,
  Terminal,
  Layers,
  Send,
  FileDown,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type CommandCategory = 'session' | 'control' | 'tts' | 'advanced' | 'agents';

export interface SlashCommand {
  name: string;
  label: string;
  icon: LucideIcon;
  category: CommandCategory;
  /** If present, command has a submenu with these options */
  options?: string[];
  /** Text to send when no suboption is selected (defaults to `/${name}`) */
  directText?: string;
}

export const CATEGORY_COLORS: Record<CommandCategory, string> = {
  session: '#3b82f6',
  control: '#22c55e',
  tts: '#a855f7',
  advanced: '#f59e0b',
  agents: '#06b6d4',
};

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  session: 'Session',
  control: 'Control',
  tts: 'TTS',
  advanced: 'Advanced',
  agents: 'Agents',
};

export const SLASH_COMMANDS: SlashCommand[] = [
  // ── Session ──
  { name: 'reasoning', label: 'Reasoning', icon: Brain, category: 'session', options: ['on', 'off', 'stream'] },
  { name: 'think', label: 'Think Level', icon: Lightbulb, category: 'session', options: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'adaptive'] },
  { name: 'model', label: 'Model', icon: Cpu, category: 'session', options: ['list', 'status'] },
  { name: 'fast', label: 'Fast Mode', icon: Zap, category: 'session', options: ['on', 'off', 'status'] },
  { name: 'verbose', label: 'Verbose', icon: MessageSquare, category: 'session', options: ['on', 'full', 'off'] },
  { name: 'reset', label: 'Reset Session', icon: RotateCcw, category: 'session' },
  { name: 'context', label: 'Context Info', icon: Info, category: 'session', options: ['list', 'detail', 'json'] },
  { name: 'usage', label: 'Usage', icon: BarChart3, category: 'session', options: ['off', 'tokens', 'full', 'cost'] },

  // ── Control ──
  { name: 'status', label: 'Status', icon: Activity, category: 'control' },
  { name: 'help', label: 'Help', icon: HelpCircle, category: 'control' },
  { name: 'commands', label: 'Commands', icon: List, category: 'control' },
  { name: 'stop', label: 'Stop', icon: Square, category: 'control' },
  { name: 'restart', label: 'Restart', icon: RefreshCw, category: 'control' },
  { name: 'whoami', label: 'Who Am I', icon: User, category: 'control' },

  // ── TTS ──
  { name: 'tts', label: 'Text-to-Speech', icon: Volume2, category: 'tts', options: ['off', 'always', 'inbound', 'tagged', 'status', 'audio'] },

  // ── Advanced ──
  { name: 'elevated', label: 'Elevated Mode', icon: Shield, category: 'advanced', options: ['on', 'off', 'ask', 'full'] },
  { name: 'exec', label: 'Exec Status', icon: Terminal, category: 'advanced' },
  { name: 'queue', label: 'Queue Status', icon: Layers, category: 'advanced' },
  { name: 'send', label: 'Send Policy', icon: Send, category: 'advanced', options: ['on', 'off', 'inherit'] },
  { name: 'compact', label: 'Compact Context', icon: FileDown, category: 'advanced' },
  { name: 'export-session', label: 'Export Session', icon: FileDown, category: 'advanced', directText: '/export-session' },

  // ── Agents ──
  { name: 'subagents', label: 'Sub-agents', icon: Users, category: 'agents', options: ['list', 'kill', 'log', 'info', 'spawn'] },
  { name: 'agents', label: 'List Agents', icon: Users, category: 'agents' },
  { name: 'kill', label: 'Kill Agent', icon: Square, category: 'agents', directText: '/kill all' },
];
