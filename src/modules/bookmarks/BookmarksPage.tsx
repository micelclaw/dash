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

import { useEffect, useState, useCallback } from 'react';
import {
  Bookmark as BookmarkIcon, Plus, RefreshCw, Search, ExternalLink,
  MoreHorizontal, Trash2, Copy, Pencil, RotateCcw, X, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBookmarksStore } from '@/stores/bookmarks.store';
import type { Bookmark } from '@/stores/bookmarks.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { api } from '@/services/api';

// ─── Helpers ─────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Add Bookmark Modal ──────────────────────────────────

function AddBookmarkModal({ onClose }: { onClose: () => void }) {
  const createBookmark = useBookmarksStore((s) => s.createBookmark);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchMetadata = useCallback(async (targetUrl: string) => {
    if (!targetUrl) return;
    try { new URL(targetUrl); } catch { return; }
    setFetching(true);
    try {
      const res = await api.post<{ data: { title: string | null; description: string | null; favicon_url: string | null } }>('/bookmarks/fetch-metadata', { url: targetUrl });
      if (res.data.title && !title) setTitle(res.data.title);
      if (res.data.description && !description) setDescription(res.data.description);
    } catch { /* ignore */ }
    setFetching(false);
  }, [title, description]);

  const handleSubmit = async () => {
    if (!url) return;
    setSaving(true);
    try {
      await createBookmark({
        url,
        title: title || undefined,
        description: description || undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });
      toast.success('Bookmark saved');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 24,
          width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Add Bookmark
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>URL *</label>
          <input
            style={inputStyle}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => fetchMetadata(url)}
            placeholder="https://example.com"
            autoFocus
          />
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            Title {fetching && <span style={{ color: 'var(--amber)' }}>fetching...</span>}
          </label>
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Page title" />
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>Description</label>
          <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>Tags (comma-separated)</label>
          <input style={inputStyle} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="dev, reading, ai" />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!url || saving}
          style={{
            padding: '10px 0',
            background: !url || saving ? 'var(--surface)' : 'var(--amber)',
            color: !url || saving ? 'var(--text-muted)' : '#06060a',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: !url || saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Bookmark'}
        </button>
      </div>
    </div>
  );
}

// ─── Bookmark Card ───────────────────────────────────────

function BookmarkCard({
  bookmark,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  bookmark: Bookmark;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const checkAlive = useBookmarksStore((s) => s.checkAlive);

  const faviconSrc = bookmark.favicon_url || `https://${bookmark.domain}/favicon.ico`;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        background: selected ? 'var(--surface-hover)' : 'var(--card)',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.1s ease',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--card)';
      }}
    >
      {/* Alive indicator */}
      <div
        style={{
          width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
          background: bookmark.is_alive ? '#22c55e' : '#ef4444',
        }}
        title={bookmark.is_alive ? 'Link is alive' : 'Dead link'}
      />

      {/* Favicon */}
      <img
        src={faviconSrc}
        alt=""
        style={{ width: 20, height: 20, borderRadius: 4, marginTop: 2, flexShrink: 0 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--text)',
              fontSize: '0.875rem',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={bookmark.url}
          >
            {bookmark.title || bookmark.url}
          </a>
          <ExternalLink size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </div>

        {bookmark.description && (
          <div style={{
            fontSize: '0.8125rem',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-sans)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}>
            {bookmark.description}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
            {bookmark.domain}
          </span>

          {bookmark.tags?.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '0.625rem',
                padding: '1px 6px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface)',
                color: 'var(--amber)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {tag}
            </span>
          ))}

          {!bookmark.is_alive && (
            <span style={{
              fontSize: '0.625rem',
              padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
            }}>
              Dead link
            </span>
          )}

          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginLeft: 'auto' }}>
            {timeAgo(bookmark.created_at)}
          </span>
        </div>
      </div>

      {/* Menu */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}
        >
          <MoreHorizontal size={16} />
        </button>

        {menuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setMenuOpen(false)} />
            <div
              style={{
                position: 'absolute', right: 0, top: 28, zIndex: 51,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: 4,
                minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {[
                { icon: Pencil, label: 'Edit', action: () => { onEdit(); setMenuOpen(false); } },
                { icon: Copy, label: 'Copy URL', action: () => { navigator.clipboard.writeText(bookmark.url); toast.success('Copied'); setMenuOpen(false); } },
                { icon: ExternalLink, label: 'Open in new tab', action: () => { window.open(bookmark.url, '_blank'); setMenuOpen(false); } },
                { icon: RefreshCw, label: 'Check link', action: () => { checkAlive([bookmark.id]); setMenuOpen(false); } },
                { icon: Trash2, label: 'Delete', action: () => { onDelete(); setMenuOpen(false); }, danger: true },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '6px 10px',
                    background: 'transparent', border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    color: (item as any).danger ? '#ef4444' : 'var(--text)',
                    fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <item.icon size={14} />
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────

export function Component() {
  const bookmarks = useBookmarksStore((s) => s.bookmarks);
  const total = useBookmarksStore((s) => s.total);
  const loading = useBookmarksStore((s) => s.loading);
  const filters = useBookmarksStore((s) => s.filters);
  const allTags = useBookmarksStore((s) => s.allTags);
  const allDomains = useBookmarksStore((s) => s.allDomains);
  const checkingAlive = useBookmarksStore((s) => s.checkingAlive);
  const fetchBookmarks = useBookmarksStore((s) => s.fetchBookmarks);
  const fetchMeta = useBookmarksStore((s) => s.fetchMeta);
  const setFilter = useBookmarksStore((s) => s.setFilter);
  const checkAlive = useBookmarksStore((s) => s.checkAlive);
  const deleteBookmark = useBookmarksStore((s) => s.deleteBookmark);
  const isMobile = useIsMobile();

  const [addOpen, setAddOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchBookmarks();
    fetchMeta();
  }, [fetchBookmarks, fetchMeta]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setFilter('search', value);
    }, 300);
    setDebounceTimer(timer);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBookmark(id);
      toast.success('Bookmark deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const selectStyle: React.CSSProperties = {
    height: 32,
    padding: '0 8px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '12px 16px' : '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 12,
        alignItems: isMobile ? 'stretch' : 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            flex: 1, maxWidth: 360,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 10px',
            height: 32,
          }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search bookmarks..."
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: 'var(--text)', fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
          </div>

          {/* Tag filter */}
          <select
            style={selectStyle}
            value={filters.tag ?? ''}
            onChange={(e) => setFilter('tag', e.target.value || null)}
          >
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Domain filter */}
          <select
            style={{ ...selectStyle, maxWidth: 160 }}
            value={filters.domain ?? ''}
            onChange={(e) => setFilter('domain', e.target.value || null)}
          >
            <option value="">All domains</option>
            {allDomains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setAddOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 14px', height: 32,
              background: 'var(--amber)', color: '#06060a',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Add Bookmark
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && bookmarks.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Loading bookmarks...
          </div>
        )}

        {!loading && bookmarks.length === 0 && (
          <div style={{
            padding: '64px 16px', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <BookmarkIcon size={48} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <div style={{ fontSize: '1rem', color: 'var(--text-dim)', fontWeight: 500 }}>
              No bookmarks yet
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 360 }}>
              Save your favorite links here — your agent can also save them from web searches.
            </div>
            <button
              onClick={() => setAddOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', marginTop: 8,
                background: 'var(--amber)', color: '#06060a',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              Add your first bookmark
            </button>
          </div>
        )}

        {bookmarks.map((b) => (
          <BookmarkCard
            key={b.id}
            bookmark={b}
            selected={false}
            onToggleSelect={() => {}}
            onEdit={() => {}}
            onDelete={() => handleDelete(b.id)}
          />
        ))}
      </div>

      {/* Footer */}
      {bookmarks.length > 0 && (
        <div style={{
          padding: '8px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)',
        }}>
          <span>Showing {bookmarks.length} of {total} bookmarks</span>
          <button
            onClick={() => checkAlive()}
            disabled={checkingAlive}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-dim)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              cursor: checkingAlive ? 'default' : 'pointer',
              opacity: checkingAlive ? 0.6 : 1,
            }}
          >
            <RefreshCw size={12} style={{ animation: checkingAlive ? 'spin 1s linear infinite' : 'none' }} />
            {checkingAlive ? 'Checking...' : 'Check All Links'}
          </button>
        </div>
      )}

      {/* Modals */}
      {addOpen && <AddBookmarkModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}
