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

// ─── Studio v2 — workspace file tree ────────────────────────────────
//
// Pulls the live file listing for a project's workspace and renders a
// click-to-select tree. Recently-edited files (within the last 5 sec)
// show a subtle amber dot. Tree refreshes:
//   1. On mount.
//   2. Whenever the parent passes a different `refreshKey` (typically
//      bumped by useOpencodeStream when a `file.edited` event arrives,
//      debounced 300ms upstream).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Folder, FileText, RefreshCw } from 'lucide-react';
import { useStudioStore, type StudioWorkspaceFile } from '@/stores/studio.store';
import type { FileEdit } from '../../hooks/useOpencodeStream';

const RECENT_EDIT_HIGHLIGHT_MS = 8_000;
const EMPTY_POLL_MS = 1_500;

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
}

interface Props {
  projectId: string;
  /** When the parent wants the tree to refetch — e.g. bumped after a
   *  debounced file.edited event from the WS bridge. */
  refreshKey?: number;
  recentEdits: FileEdit[];
  selected: string | null;
  onSelect: (path: string) => void;
}

export function WorkspaceFileTree({ projectId, refreshKey, recentEdits, selected, onSelect }: Props) {
  const fetchWorkspaceFiles = useStudioStore((s) => s.fetchWorkspaceFiles);
  const [files, setFiles] = useState<StudioWorkspaceFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tree = useMemo(() => buildFileTree(files), [files]);
  // `recentEdits` paths come from OC's `file.edited` event which carries
  // ABSOLUTE paths (e.g. `/home/.../workspace/api/lib/db.mjs`), while
  // tree nodes use paths RELATIVE to the workspace root (e.g.
  // `api/lib/db.mjs`). Without normalization, `Map.get(node.path)`
  // never matches and the green highlight never fires. Strip everything
  // up to and including `/workspace/` so both shapes index the same way.
  const recentByPath = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of recentEdits) {
      const rel = toRelativeWorkspacePath(e.path);
      if (rel) m.set(rel, e.ts);
    }
    return m;
  }, [recentEdits]);

  const reload = async () => {
    setLoading(true);
    try {
      const next = await fetchWorkspaceFiles(projectId);
      setFiles(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    void reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    // Debounce: file_edit events arrive in bursts. Wait 300ms of
    // silence before refetching the listing.
    if (refreshKey === undefined) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void reload(); }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Poll while the workspace listing is still empty. Skeleton
  // materialization (`docs/`, `manifest.json`, etc.) happens server-side
  // during `/build/start` and doesn't fire `file.edited` events, so the
  // initial reload races and lands before the files exist on disk. A
  // light 1.5s poll until we see at least one file is cheap and clears
  // the user's "I have to click refresh" complaint.
  useEffect(() => {
    if (!projectId) return;
    if (files.length > 0) return;
    if (error) return;
    const t = setInterval(() => { void reload(); }, EMPTY_POLL_MS);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, files.length, error]);

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--card)', position: 'relative' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--card)',
        fontSize: '0.65rem', textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-muted)',
      }}>
        <span>Workspace</span>
        <button
          onClick={() => { void reload(); }}
          aria-label="Refresh"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 2, color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <RefreshCw size={11} className={loading ? 'spin' : undefined} />
        </button>
      </div>
      {error && (
        <div style={{ padding: '8px 12px', color: 'var(--danger)', fontSize: '0.7rem' }}>
          {error}
        </div>
      )}
      {!error && tree.length === 0 && !loading && (
        <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
          (workspace empty — start a build to materialize files)
        </div>
      )}
      {tree.map((n) => (
        <Node key={n.path} node={n} selected={selected} onSelect={onSelect} recentByPath={recentByPath} />
      ))}
    </div>
  );
}

function Node({
  node, selected, onSelect, recentByPath, depth = 0,
}: {
  node: TreeNode;
  selected: string | null;
  onSelect: (p: string) => void;
  recentByPath: Map<string, number>;
  depth?: number;
}) {
  const isSelected = !node.isDir && selected === node.path;
  const editTs = recentByPath.get(node.path);
  // Tick once a second so the highlight ratio re-renders smoothly while
  // the file is "fresh". Otherwise the row stays bright and pops to
  // transparent at the boundary.
  const [, force] = useState(0);
  useEffect(() => {
    if (editTs === undefined) return;
    const elapsed = Date.now() - editTs;
    if (elapsed >= RECENT_EDIT_HIGHLIGHT_MS) return;
    const t = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [editTs]);

  const elapsed = editTs !== undefined ? Date.now() - editTs : Infinity;
  const isRecent = !node.isDir && elapsed < RECENT_EDIT_HIGHLIGHT_MS;
  // Linear fade: opacity 1 at edit time → 0 at HIGHLIGHT_MS.
  const flashOpacity = isRecent
    ? Math.max(0, 1 - elapsed / RECENT_EDIT_HIGHLIGHT_MS)
    : 0;
  // Background tints from green (fresh) to transparent. Selection wins.
  const flashBg = isRecent && !isSelected
    ? `color-mix(in srgb, #22c55e ${Math.round(flashOpacity * 30)}%, transparent)`
    : 'transparent';
  const baseBg = isSelected ? 'var(--card-hover)' : flashBg;

  return (
    <>
      <div
        onClick={() => !node.isDir && onSelect(node.path)}
        style={{
          padding: `4px 12px 4px ${12 + depth * 14}px`,
          fontSize: '0.75rem',
          color: isSelected ? 'var(--text)' : (node.isDir ? 'var(--text-dim)' : 'var(--text)'),
          background: baseBg,
          borderLeft: `2px solid ${isSelected ? 'var(--amber)' : (isRecent ? `rgba(34, 197, 94, ${flashOpacity})` : 'transparent')}`,
          cursor: node.isDir ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--font-mono, monospace)',
          userSelect: 'none',
          transition: 'background 200ms ease, border-color 200ms ease',
        }}
      >
        {node.isDir ? <Folder size={11} /> : <FileText size={11} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        {isRecent && (
          <span aria-label="recently edited" style={{
            marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e',
            opacity: flashOpacity,
            flexShrink: 0,
            transition: 'opacity 200ms ease',
          }} />
        )}
      </div>
      {node.children?.map((c) => (
        <Node key={c.path} node={c} selected={selected} onSelect={onSelect} recentByPath={recentByPath} depth={depth + 1} />
      ))}
    </>
  );
}

/** Strip everything up to and including the last `/workspace/` segment.
 *  Returns a relative path, or null if the input doesn't look like a
 *  workspace-rooted absolute path. Idempotent for already-relative paths. */
function toRelativeWorkspacePath(p: string): string | null {
  if (!p) return null;
  // Already relative — assume caller meant it that way.
  if (!p.startsWith('/')) return p;
  const marker = '/workspace/';
  const idx = p.lastIndexOf(marker);
  if (idx === -1) return null;
  return p.slice(idx + marker.length);
}

function buildFileTree(files: StudioWorkspaceFile[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (part === undefined || part === '') continue;
      const isFile = i === parts.length - 1;
      if (!node.children) node.children = [];
      let child: TreeNode | undefined = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: isFile ? f.path : parts.slice(0, i + 1).join('/'),
          isDir: !isFile,
          children: isFile ? undefined : [],
        };
        node.children.push(child);
      }
      node = child;
    }
  }
  const sortNode = (n: TreeNode) => {
    if (n.children) {
      n.children.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      n.children.forEach(sortNode);
    }
  };
  sortNode(root);
  return root.children ?? [];
}
