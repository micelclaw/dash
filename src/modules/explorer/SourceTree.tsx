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

import { EntitySource } from '@/components/shared/SourceBadge';
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, HardDrive, Cloud, ChevronRight, ChevronDown,
  Trash2, Folder, FolderPlus,
} from 'lucide-react';
import { useVFS } from './hooks/use-vfs';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SharedFolderCreateDialog } from '@/components/settings/sections/SharedFolderCreateDialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { api } from '@/services/api';
import type { VFSMount, VFSNode } from './hooks/use-vfs';
import { useI18n } from '@/i18n';

/** Legacy auto-created local mounts (pre Drive-unify scheme) that must never
 *  show as File Explorer sources — superseded by HOME (/user/files) + Drive
 *  (/drive). Core retires them on the next /vfs/mounts; this hides any that
 *  linger. Attachments is email storage, not a browsable source. */
const HIDDEN_DEFAULT_MOUNTS = new Set(['/local/drive', '/local/photos', '/local/attachments']);

interface SourceTreeProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onAddSource?: () => void;
  /** Increment to trigger a mounts refresh (e.g. after MountWizard creates one) */
  refreshKey?: number;
}

export function SourceTree({ currentPath, onNavigate, onAddSource, refreshKey }: SourceTreeProps) {
  const { t } = useI18n();
  const { mounts, mountsLoading, fetchMounts, deleteMount } = useVFS();
  const [deleteTarget, setDeleteTarget] = useState<VFSMount | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);

  useEffect(() => { fetchMounts(); }, [fetchMounts, refreshKey]);

  // Unified: ALL volumes (local + cloud) in ONE list — hide unused legacy defaults.
  const allMounts = useMemo(
    () => mounts.filter(m => !HIDDEN_DEFAULT_MOUNTS.has(m.mount_path)),
    [mounts],
  );

  const handleDeleteMount = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteMount(deleteTarget.id);
    } catch {
      // Mount may already be gone — refresh list anyway
      await fetchMounts();
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteMount, fetchMounts]);

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        background: 'var(--bg)',
        padding: 8,
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* One unified header with one "+" → add local folder OR cloud storage */}
      <div
        style={{
          fontSize: '0.625rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          padding: '4px 8px 6px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span style={{ flex: 1 }}>{t('explorer.source.storage')}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                padding: 2,
                display: 'flex',
                borderRadius: 'var(--radius-sm)',
              }}
              title={t('explorer.source.addTitle')}
              aria-label={t('explorer.source.addTitle')}
            >
              <Plus size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setCreateFolderOpen(true)} className="gap-2">
              <FolderPlus size={14} /> {t('explorer.source.sharedFolder')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddSource?.()} className="gap-2">
              <Cloud size={14} /> {t('explorer.source.cloudStorage')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {mountsLoading && (
        <div role="status" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {t('explorer.source.loading')}
        </div>
      )}

      {!mountsLoading && allMounts.length === 0 && (
        <div style={{ padding: '4px 8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('explorer.source.none')}</span>
          <button
            onClick={() => setCreateFolderOpen(true)}
            style={{
              display: 'block',
              marginTop: 4,
              padding: '4px 8px',
              background: 'transparent',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-sans)',
            }}
          >
            + {t('explorer.source.sharedFolder')}
          </button>
        </div>
      )}

      {allMounts.map(mount => (
        <MountTreeItem
          key={mount.id}
          mount={mount}
          currentPath={currentPath}
          onNavigate={onNavigate}
          onDelete={() => setDeleteTarget(mount)}
        />
      ))}

      {/* Delete mount confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteMount}
        title={t('explorer.source.removeTitle', { name: deleteTarget?.name ?? '' })}
        description={t('explorer.source.removeDescription')}
        confirmLabel={t('explorer.source.remove')}
        variant="danger"
      />

      {/* Crear carpeta compartida (reemplaza "Local folder" — el "+" del Explorer
          ahora crea carpetas COMPARTIDAS del NAS, no monta directorios sueltos). */}
      <SharedFolderCreateDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onCreated={() => { void fetchMounts(); }}
      />
    </div>
  );
}

// ─── Mount tree item with lazy-loaded subdirectories ─────────

function MountTreeItem({ mount, currentPath, onNavigate, onDelete, icon }: {
  mount: VFSMount;
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: () => void;
  icon?: React.ReactNode;
}) {
  const { t } = useI18n();
  const vfsPath = '/vfs' + (mount.mount_path.startsWith('/') ? mount.mount_path : '/' + mount.mount_path);
  const isActive = currentPath.startsWith(vfsPath);
  const [expanded, setExpanded] = useState(isActive);
  const [children, setChildren] = useState<VFSNode[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleExpand = useCallback(async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (children.length > 0) return;
    setChildrenLoading(true);
    try {
      const res = await api.get<{ data: VFSNode[] }>('/vfs/list', { path: mount.mount_path });
      setChildren(res.data.filter(n => n.type === 'directory'));
    } catch { /* ignore */ }
    finally { setChildrenLoading(false); }
  }, [expanded, children.length, mount.mount_path]);

  const defaultIcon = mount.provider_type === 'local'
    ? <HardDrive size={14} style={{ flexShrink: 0, color: isActive ? 'var(--amber)' : 'var(--text-dim)' }} />
    : <Cloud size={14} style={{ flexShrink: 0, color: isActive ? 'var(--amber)' : getProviderColor(mount.provider_type) }} />;

  const statusColor = mount.status === 'active' ? '#22c55e'
    : mount.status === 'syncing' ? '#f59e0b'
    : mount.status === 'error' ? '#ef4444'
    : '#a3a3a3';

  return (
    <div>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ display: 'flex', alignItems: 'center' }}
      >
        <button
          onClick={handleExpand}
          title={t(expanded ? 'explorer.source.collapseMount' : 'explorer.source.expandMount', { name: mount.name })}
          aria-label={t(expanded ? 'explorer.source.collapseMount' : 'explorer.source.expandMount', { name: mount.name })}
          aria-expanded={expanded}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '0 2px', display: 'flex', color: 'var(--text-dim)',
          }}
        >
          {expanded
            ? <ChevronDown size={12} />
            : <ChevronRight size={12} />
          }
        </button>
        <button
          onClick={() => onNavigate(vfsPath.endsWith('/') ? vfsPath : vfsPath + '/')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 30,
            paddingRight: 8,
            background: isActive ? 'var(--surface-hover)' : hovered ? 'var(--surface-hover)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.8125rem',
            color: isActive ? 'var(--amber)' : 'var(--text)',
            textAlign: 'left',
            transition: 'background var(--transition-fast)',
          }}
        >
          <span style={{ position: 'relative', display: 'flex' }}>
            {icon || defaultIcon}
            <span style={{
              position: 'absolute', bottom: -1, right: -1,
              width: 6, height: 6, borderRadius: '50%',
              background: statusColor, border: '1px solid var(--bg)',
            }} />
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {mount.name}
          </span>
          <EntitySource entity={mount} domain="files" />
        </button>
        {/* Acciones a nivel de FILA — HERMANAS del botón de navegar, no dentro.
            Un <button> (borrar) anidado en otro <button> (navegar) es HTML inválido
            → React validateDOMNesting "<button> cannot be a descendant of <button>",
            que solo saltaba en hover (el botón interno se renderiza con `hovered`). */}
        {hovered ? (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title={t('explorer.source.removeMount')}
            aria-label={t('explorer.source.removeTitle', { name: mount.name })}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 2, display: 'flex',
            }}
          >
            <Trash2 size={11} />
          </button>
        ) : mount.read_only ? (
          <span aria-label={t('explorer.source.readOnly')} title={t('explorer.source.readOnly')} style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', paddingRight: 4 }}>RO</span>
        ) : null}
      </div>

      {expanded && (
        <div style={{ marginLeft: 20 }}>
          {childrenLoading && (
            <div style={{ padding: '4px 8px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>...</div>
          )}
          {children.map(child => (
            <VFSFolderNode
              key={child.path}
              node={child}
              currentPath={currentPath}
              onNavigate={onNavigate}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VFSFolderNode({ node, currentPath, onNavigate, depth }: {
  node: VFSNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  depth: number;
}) {
  const { t } = useI18n();
  const vfsPath = '/vfs' + node.path;
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<VFSNode[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isActive = currentPath === vfsPath || currentPath === vfsPath + '/';

  const handleExpand = useCallback(async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (children.length > 0) return;
    setChildrenLoading(true);
    try {
      const res = await api.get<{ data: VFSNode[] }>('/vfs/list', { path: node.path });
      setChildren(res.data.filter(n => n.type === 'directory'));
    } catch { /* ignore */ }
    finally { setChildrenLoading(false); }
  }, [expanded, children.length, node.path]);

  if (depth > 3) return null;

  return (
    <div>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ display: 'flex', alignItems: 'center' }}
      >
        <button
          onClick={handleExpand}
          title={t(expanded ? 'explorer.source.collapseFolder' : 'explorer.source.expandFolder', { name: node.name })}
          aria-label={t(expanded ? 'explorer.source.collapseFolder' : 'explorer.source.expandFolder', { name: node.name })}
          aria-expanded={expanded}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '0 2px', display: 'flex', color: 'var(--text-dim)',
          }}
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>
        <button
          onClick={() => onNavigate(vfsPath.endsWith('/') ? vfsPath : vfsPath + '/')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 26,
            paddingRight: 8,
            background: isActive ? 'var(--surface-hover)' : hovered ? 'var(--surface-hover)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.75rem',
            color: isActive ? 'var(--amber)' : 'var(--text-dim)',
            textAlign: 'left',
          }}
        >
          <Folder size={13} style={{ color: 'var(--amber)', opacity: 0.7, flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
        </button>
      </div>
      {expanded && (
        <div style={{ marginLeft: 14 }}>
          {childrenLoading && (
            <div style={{ padding: '2px 8px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>...</div>
          )}
          {children.map(child => (
            <VFSFolderNode
              key={child.path}
              node={child}
              currentPath={currentPath}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getProviderColor(providerType: string): string {
  switch (providerType) {
    case 'gdrive': return '#4285f4';
    case 'dropbox': return '#0061fe';
    default: return 'var(--text-dim)';
  }
}
