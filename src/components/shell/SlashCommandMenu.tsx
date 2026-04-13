/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { ChevronRight, Slash } from 'lucide-react';
import {
  SLASH_COMMANDS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type SlashCommand,
} from '@/config/slash-commands';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

interface SlashCommandMenuProps {
  onSelect: (commandText: string) => void;
  /** When set, filters commands by name prefix (for textarea "/" detection) */
  filter?: string;
}

function CommandItem({ cmd, onSelect }: { cmd: SlashCommand; onSelect: (text: string) => void }) {
  const categoryColor = CATEGORY_COLORS[cmd.category];
  const categoryLabel = CATEGORY_LABELS[cmd.category];
  const Icon = cmd.icon;

  if (cmd.options && cmd.options.length > 0) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem' }}>
            /{cmd.name}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.625rem',
              padding: '1px 5px',
              borderRadius: 'var(--radius-sm)',
              background: `${categoryColor}20`,
              color: categoryColor,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {categoryLabel}
          </span>
          <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent sideOffset={4}>
          {cmd.options.map((opt) => (
            <DropdownMenuItem
              key={opt}
              onClick={() => onSelect(`/${cmd.name} ${opt}`)}
              style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem' }}
            >
              {opt}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  return (
    <DropdownMenuItem onClick={() => onSelect(cmd.directText ?? `/${cmd.name}`)}>
      <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem' }}>
        /{cmd.name}
      </span>
      <span
        style={{
          marginLeft: 'auto',
          fontSize: '0.625rem',
          padding: '1px 5px',
          borderRadius: 'var(--radius-sm)',
          background: `${categoryColor}20`,
          color: categoryColor,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {categoryLabel}
      </span>
    </DropdownMenuItem>
  );
}

export function SlashCommandMenu({ onSelect, filter }: SlashCommandMenuProps) {
  const commands = filter
    ? SLASH_COMMANDS.filter((c) => c.name.startsWith(filter))
    : SLASH_COMMANDS;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 6px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            transition: 'border-color var(--transition-fast), color var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          title="Slash commands"
        >
          <Slash size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        style={{ maxHeight: '60vh', overflowY: 'auto', minWidth: 260 }}
      >
        {commands.map((cmd) => (
          <CommandItem key={cmd.name} cmd={cmd} onSelect={onSelect} />
        ))}
        {commands.length === 0 && (
          <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No commands match
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
