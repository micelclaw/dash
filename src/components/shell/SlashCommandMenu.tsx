/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useEffect } from 'react';
import { ChevronRight, Slash, Loader2 } from 'lucide-react';
import {
  SLASH_COMMANDS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type SlashCommand,
} from '@/config/slash-commands';
import { useGatewayStore } from '@/stores/gateway.store';
import { useAuthStore } from '@/stores/auth.store';
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

function CategoryBadge({ category }: { category: SlashCommand['category'] }) {
  const color = CATEGORY_COLORS[category];
  return (
    <span
      style={{
        marginLeft: 'auto',
        fontSize: '0.625rem',
        padding: '1px 5px',
        borderRadius: 'var(--radius-sm)',
        background: `${color}20`,
        color,
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

/** Submenu whose options are loaded at runtime (Fase 2). Currently: models. */
function DynamicModelSubmenu({ cmd, onSelect }: { cmd: SlashCommand; onSelect: (text: string) => void }) {
  const Icon = cmd.icon;
  const models = useGatewayStore((s) => s.models);
  const loading = useGatewayStore((s) => s.modelsLoading);
  const fetchModels = useGatewayStore((s) => s.fetchModels);

  useEffect(() => {
    if (models.length === 0) void fetchModels();
  }, [models.length, fetchModels]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem' }}>/{cmd.name}</span>
        <CategoryBadge category={cmd.category} />
        <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent sideOffset={4} style={{ maxHeight: '50vh', overflowY: 'auto', minWidth: 240 }}>
        {loading && models.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <Loader2 size={12} className="animate-spin" /> Cargando modelos…
          </div>
        )}
        {!loading && models.length === 0 && (
          <div style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>No hay modelos configurados</div>
        )}
        {models.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => onSelect(`/${cmd.name} ${m.id}`)}
            disabled={m.status !== 'available'}
            style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', gap: 6, opacity: m.status !== 'available' ? 0.5 : 1 }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.id}</span>
            {m.is_default && <span style={{ marginLeft: 'auto', color: 'var(--accent, #22c55e)', flexShrink: 0 }}>●</span>}
            {m.status !== 'available' && (
              <span style={{ marginLeft: m.is_default ? 4 : 'auto', fontSize: '0.625rem', color: 'var(--amber)', flexShrink: 0 }}>{m.status}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function CommandItem({ cmd, onSelect }: { cmd: SlashCommand; onSelect: (text: string) => void }) {
  const Icon = cmd.icon;

  if (cmd.dynamicOptions === 'models') {
    return <DynamicModelSubmenu cmd={cmd} onSelect={onSelect} />;
  }

  if (cmd.options && cmd.options.length > 0) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.8125rem' }}>
            /{cmd.name}
          </span>
          <CategoryBadge category={cmd.category} />
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
      <CategoryBadge category={cmd.category} />
    </DropdownMenuItem>
  );
}

export function SlashCommandMenu({ onSelect, filter }: SlashCommandMenuProps) {
  // `/restart` reboots the Gateway for ALL users — hide it from non-admins
  // (defense-in-depth: the backend dispatcher also rejects non-admin /restart).
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'admin' || userRole === 'owner';
  const baseCommands = isAdmin ? SLASH_COMMANDS : SLASH_COMMANDS.filter((c) => c.name !== 'restart');
  const commands = filter
    ? baseCommands.filter((c) => c.name.startsWith(filter))
    : baseCommands;

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
