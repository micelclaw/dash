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

import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  Search, Plus, MessageSquarePlus, Pin, PinOff, Bell, BellOff, Archive, ArchiveRestore,
  Eye, EyeOff, Trash2, VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { platformMeta } from '@/config/messaging-platforms';
import { usePlatformCapabilitiesStore } from '@/stores/platform-capabilities.store';
import { PlatformIcon } from '@/components/shared/platform-icons';
import { ContextMenu, type ContextMenuItem } from '@/components/shared/ContextMenu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  getChatPrefs, updateChatPref, setChannelObserved, deleteChannel,
  type Channel, type ChatPrefs, type ChatPref,
} from '@/services/messages.service';

interface ChannelSidebarProps {
  channels: Channel[];
  selectedChannelId: string | null;
  platformFilter: string | null;
  search: string;
  onSelectChannel: (platformChannelId: string, platform: string) => void;
  onPlatformFilter: (platform: string | null) => void;
  /**
   * Abrir el selector de chats de esa plataforma. Es el MISMO modal que en
   * Settings → Channel Observers: elegir qué chats se sincronizan se hace donde
   * los estás mirando, no solo enterrado en ajustes.
   */
  onAddChats?: (platform: string) => void;
  /**
   * Escribir a un contacto NUEVO (fuera de la lista). Solo se ofrece si la
   * plataforma lo soporta (`capability.start_chat`) y está usable (`can_send`).
   */
  onStartChat?: (platform: string) => void;
  onSearchChange: (search: string) => void;
  /** Recargar la lista tras eliminar/observar (el estado vive en el padre). */
  onRefetch?: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const chatKey = (ch: Channel) => `${ch.platform}:${ch.platform_channel_id}`;

export function ChannelSidebar({
  channels, selectedChannelId, platformFilter, search,
  onSelectChannel, onPlatformFilter, onSearchChange, onAddChats, onStartChat, onRefetch,
}: ChannelSidebarProps) {
  const [prefs, setPrefs] = useState<ChatPrefs>({});
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Channel | null>(null);
  // ¿La plataforma filtrada permite escribir a un contacto nuevo Y está usable?
  const filteredCap = usePlatformCapabilitiesStore((s) => (platformFilter ? s.byPlatform[platformFilter] : undefined));
  const canStartChat = !!(platformFilter && onStartChat && filteredCap?.start_chat && filteredCap.can_send);

  useEffect(() => {
    getChatPrefs().then(setPrefs).catch(() => { /* prefs opcionales */ });
  }, []);

  const prefOf = useCallback((ch: Channel): ChatPref => prefs[chatKey(ch)] ?? {}, [prefs]);

  const patchPref = useCallback(async (ch: Channel, patch: ChatPref) => {
    const key = chatKey(ch);
    // Optimista: el estado deriva del backend, pero reflejamos ya para que la UI
    // no parpadee. Si falla, se revierte al valor previo.
    const prev = prefs[key] ?? {};
    setPrefs((p) => ({ ...p, [key]: { ...prev, ...patch } }));
    try {
      const saved = await updateChatPref(ch.platform, ch.platform_channel_id, patch);
      setPrefs((p) => ({ ...p, [key]: saved }));
    } catch {
      setPrefs((p) => ({ ...p, [key]: prev }));
      toast.error('No se pudo guardar');
    }
  }, [prefs]);

  const toggleObserve = useCallback(async (ch: Channel) => {
    const next = ch.observed === false;
    try {
      await setChannelObserved(ch.platform, ch.platform_channel_id, next, {
        name: ch.channel_name ?? undefined, type: ch.channel_type ?? undefined,
      });
      toast.success(next ? 'Observando este chat' : 'Ya no se sincroniza este chat');
      onRefetch?.();
    } catch {
      toast.error('No se pudo cambiar');
    }
  }, [onRefetch]);

  const doDelete = useCallback(async (ch: Channel) => {
    try {
      await deleteChannel(ch.platform, ch.platform_channel_id);
      toast.success('Chat eliminado');
      onRefetch?.();
    } catch {
      toast.error('No se pudo eliminar');
    } finally {
      setConfirmDelete(null);
    }
  }, [onRefetch]);

  const menuItems = useCallback((ch: Channel): ContextMenuItem[] => {
    const p = prefOf(ch);
    return [
      { label: p.pinned ? 'Desfijar' : 'Fijar arriba', icon: p.pinned ? PinOff : Pin, onClick: () => patchPref(ch, { pinned: !p.pinned }) },
      { label: p.muted ? 'Activar notificaciones' : 'Silenciar', icon: p.muted ? Bell : BellOff, onClick: () => patchPref(ch, { muted: !p.muted }) },
      { label: p.archived ? 'Desarchivar' : 'Archivar', icon: p.archived ? ArchiveRestore : Archive, onClick: () => patchPref(ch, { archived: !p.archived }) },
      { label: ch.observed === false ? 'Marcar observable' : 'Dejar de observar', icon: ch.observed === false ? Eye : EyeOff, onClick: () => toggleObserve(ch) },
      { label: '', separator: true, onClick: () => {} },
      { label: 'Eliminar chat', icon: Trash2, variant: 'danger', onClick: () => setConfirmDelete(ch) },
    ];
  }, [prefOf, patchPref, toggleObserve]);

  // Get platforms that have messages
  const platforms = useMemo(() => {
    const set = new Set(channels.map(c => c.platform));
    return [...set].sort();
  }, [channels]);

  // Filter channels (search + platform + archivados ocultos salvo toggle)
  const filtered = useMemo(() => {
    let list = channels;
    if (platformFilter) list = list.filter(c => c.platform === platformFilter);
    if (search) {
      const lc = search.toLowerCase();
      list = list.filter(c =>
        (c.channel_name ?? '').toLowerCase().includes(lc) ||
        (c.last_message_content ?? '').toLowerCase().includes(lc)
      );
    }
    if (!showArchived) list = list.filter(c => !(prefs[chatKey(c)]?.archived));
    return list;
  }, [channels, platformFilter, search, showArchived, prefs]);

  const archivedCount = useMemo(
    () => channels.filter(c => prefs[chatKey(c)]?.archived).length,
    [channels, prefs],
  );

  // Group by platform, sorting pinned-first then by recency within each group.
  const grouped = useMemo(() => {
    const groups = new Map<string, Channel[]>();
    for (const ch of filtered) {
      const list = groups.get(ch.platform) ?? [];
      list.push(ch);
      groups.set(ch.platform, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => {
        const pa = prefs[chatKey(a)]?.pinned ? 1 : 0;
        const pb = prefs[chatKey(b)]?.pinned ? 1 : 0;
        if (pa !== pb) return pb - pa;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
    }
    return [...groups.entries()];
  }, [filtered, prefs]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      borderRight: '1px solid var(--border)',
    }}>
      {/* Platform pills */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 12px 6px', flexWrap: 'wrap' }}>
        <button
          onClick={() => onPlatformFilter(null)}
          aria-pressed={platformFilter === null}
          style={pillStyle(platformFilter === null)}
        >
          All
        </button>
        {platforms.map(p => {
          const meta = platformMeta(p);
          const selected = platformFilter === p;
          return (
            <button
              key={p}
              onClick={() => onPlatformFilter(p)}
              aria-pressed={selected}
              style={{
                ...pillStyle(selected),
                display: 'inline-flex', alignItems: 'center', gap: 5,
                // Chip con ICONO + COLOR de la plataforma (como las cabeceras de grupo de
                // abajo), no en gris. Seleccionado = fondo sólido + texto/icono blancos;
                // sin seleccionar = icono/texto en el color de la plataforma + borde tenue.
                background: selected ? meta.color : 'var(--surface)',
                color: selected ? '#fff' : meta.color,
                border: `1px solid ${selected ? meta.color : `color-mix(in srgb, ${meta.color} 32%, transparent)`}`,
              }}
            >
              <PlatformIcon platform={p} size={13} />
              {meta.label}
            </button>
          );
        })}
        {platformFilter && onAddChats && (
          <button
            onClick={() => onAddChats(platformFilter)}
            title={`Add ${platformMeta(platformFilter).label} chats to sync`}
            aria-label={`Add ${platformMeta(platformFilter).label} chats`}
            style={{
              ...pillStyle(false),
              display: 'inline-flex', alignItems: 'center', gap: 4,
              borderColor: 'var(--amber)', color: 'var(--amber)',
            }}
          >
            <Plus size={12} /> Add chats
          </button>
        )}
        {canStartChat && (
          <button
            onClick={() => onStartChat!(platformFilter!)}
            title="Escribir a un contacto nuevo"
            aria-label="Escribir a un contacto nuevo"
            style={{
              ...pillStyle(false),
              display: 'inline-flex', alignItems: 'center', gap: 4,
              borderColor: 'var(--amber)', color: 'var(--amber)',
            }}
          >
            <MessageSquarePlus size={12} /> Nuevo chat
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: '4px 12px 8px', position: 'relative' }}>
        <Search size={13} style={{
          position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
        }} />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search channels..."
          style={{
            width: '100%', padding: '6px 10px 6px 28px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontFamily: 'var(--font-sans)', fontSize: '0.75rem',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Channel list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {grouped.map(([platform, chs]) => (
          <div key={platform}>
            {!platformFilter && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px 4px',
                fontSize: '0.625rem', fontWeight: 700,
                color: platformMeta(platform).color,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <PlatformIcon platform={platform} size={14} />
                {platformMeta(platform).label}
              </div>
            )}

            {chs.map(ch => {
              const isActive = ch.platform_channel_id === selectedChannelId;
              const p = prefs[chatKey(ch)] ?? {};
              return (
                <ContextMenu
                  key={chatKey(ch)}
                  items={menuItems(ch)}
                  trigger={
                    <div
                      data-platform={ch.platform}
                      onClick={() => onSelectChannel(ch.platform_channel_id, ch.platform)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderLeft: isActive ? `3px solid ${platformMeta(ch.platform).color}` : '3px solid transparent',
                        background: isActive ? 'var(--surface)' : 'transparent',
                        transition: 'background var(--transition-fast)',
                        opacity: p.archived ? 0.6 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400,
                          color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flex: 1,
                        }}>
                          {p.pinned && <Pin size={11} style={{ color: 'var(--amber)', flexShrink: 0 }} />}
                          {p.muted && <VolumeX size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ch.channel_name ?? ch.platform_channel_id}
                          </span>
                        </span>
                        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                          {timeAgo(ch.last_message_at)}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '0.6875rem', color: 'var(--text-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginTop: 2,
                      }}>
                        {ch.last_message_sender && <span style={{ fontWeight: 500 }}>{ch.last_message_sender}: </span>}
                        {(ch.last_message_content ?? '').substring(0, 40) || '(no content)'}
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>
        ))}

        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived(v => !v)}
            style={{
              width: '100%', padding: '8px 12px', textAlign: 'left',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '0.6875rem', fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Archive size={12} />
            {showArchived ? 'Ocultar archivados' : `Archivados (${archivedCount})`}
          </button>
        )}

        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            {search ? 'No channels match' : 'No messages yet'}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
        title="Eliminar chat"
        description={confirmDelete ? `Se borrará "${confirmDelete.channel_name ?? confirmDelete.platform_channel_id}" y dejará de sincronizarse. Podrás volver a añadirlo desde "Add chats".` : ''}
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 10px',
    fontSize: '0.6875rem',
    fontWeight: 500,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--amber)' : 'var(--surface)',
    color: active ? '#000' : 'var(--text-dim)',
    fontFamily: 'var(--font-sans)',
    transition: 'all var(--transition-fast)',
  };
}
