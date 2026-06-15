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

import { useEffect, useState } from 'react';
import { ListMusic, MoreVertical, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { useMusicStore } from '@/stores/music.store';
import { coverUrl, type Playlist } from '@/services/music.service';
import { playPlaylistById } from '../lib/playback';
import { formatTotalDuration } from '../lib/format';

/** Create / rename dialog — single name field. */
function PlaylistNameDialog({
  open,
  title,
  initialName,
  confirmLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initialName: string;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text)' }}>{title}</DialogTitle>
        </DialogHeader>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Playlist name"
          style={{
            width: '100%',
            margin: '12px 0',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
        <DialogFooter>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem',
              fontFamily: 'var(--font-sans)', cursor: name.trim() ? 'pointer' : 'default',
              border: 'none', background: 'var(--amber)', color: '#06060a', fontWeight: 600,
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PlaylistsView() {
  const playlists = useMusicStore((s) => s.playlists);
  const loading = useMusicStore((s) => s.loadingPlaylists);
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<Playlist | null>(null);
  const [deleting, setDeleting] = useState<Playlist | null>(null);

  useEffect(() => {
    if (playlists === null) void useMusicStore.getState().loadPlaylists();
  }, [playlists]);

  const newButton = (
    <button
      onClick={() => setCreateOpen(true)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)', cursor: 'pointer',
        border: 'none', background: 'var(--amber)', color: '#06060a', fontWeight: 600,
      }}
    >
      <Plus size={14} /> New playlist
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{newButton}</div>

      {playlists !== null && playlists.length === 0 && !loading ? (
        <EmptyState
          icon={ListMusic}
          title="No playlists"
          description="Create a playlist to group your favorite tracks."
          actions={[{ label: 'New playlist', onClick: () => setCreateOpen(true), variant: 'primary' }]}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {(playlists ?? []).map((pl) => (
            <div
              key={pl.id}
              onClick={() => void useMusicStore.getState().openPlaylist(pl.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Cover */}
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)', overflow: 'hidden',
                background: 'var(--card)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}>
                {pl.cover_art ? (
                  <img
                    src={coverUrl(pl.cover_art, 100)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <ListMusic size={20} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>

              {/* Name + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.875rem', color: 'var(--text)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {pl.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  {pl.song_count} song{pl.song_count === 1 ? '' : 's'} · {formatTotalDuration(pl.duration)}
                </div>
              </div>

              {/* Play */}
              <button
                onClick={(e) => { e.stopPropagation(); void playPlaylistById(pl.id); }}
                title="Play"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                  color: 'var(--text-dim)', display: 'flex', flexShrink: 0,
                }}
              >
                <Play size={16} />
              </button>

              {/* Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    title="More"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 6,
                      color: 'var(--text-dim)', display: 'flex', flexShrink: 0,
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => void playPlaylistById(pl.id)}>
                    <Play size={14} /> Play
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRenaming(pl)}>
                    <Pencil size={14} /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDeleting(pl)} style={{ color: 'var(--error)' }}>
                    <Trash2 size={14} /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Create */}
      <PlaylistNameDialog
        open={createOpen}
        title="New playlist"
        initialName=""
        confirmLabel="Create"
        onClose={() => setCreateOpen(false)}
        onSubmit={(name) => void useMusicStore.getState().createPlaylist(name)}
      />

      {/* Rename */}
      <PlaylistNameDialog
        open={renaming !== null}
        title="Rename playlist"
        initialName={renaming?.name ?? ''}
        confirmLabel="Rename"
        onClose={() => setRenaming(null)}
        onSubmit={(name) => {
          if (renaming) void useMusicStore.getState().renamePlaylist(renaming.id, name);
        }}
      />

      {/* Delete */}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void useMusicStore.getState().removePlaylist(deleting.id);
        }}
        title="Delete playlist"
        description={deleting ? `"${deleting.name}" will be permanently deleted.` : undefined}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
