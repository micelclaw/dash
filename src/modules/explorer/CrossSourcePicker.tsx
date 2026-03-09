import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, X,
  HardDrive, Cloud, Folder, FolderOpen, Lock,
} from 'lucide-react';
import { api } from '@/services/api';
import type { VFSMount, VFSNode } from './hooks/use-vfs';

interface CrossSourcePickerProps {
  open: boolean;
  action: 'copy' | 'move';
  sourcePaths: string[];
  onConfirm: (destPath: string) => void;
  onCancel: () => void;
}

interface MountTreeNode {
  mount: VFSMount;
  children: DirNode[] | null;
  expanded: boolean;
  loading: boolean;
}

interface DirNode {
  node: VFSNode;
  children: DirNode[] | null;
  expanded: boolean;
  loading: boolean;
}

export function CrossSourcePicker({
  open, action, sourcePaths, onConfirm, onCancel,
}: CrossSourcePickerProps) {
  const [mountNodes, setMountNodes] = useState<MountTreeNode[]>([]);
  const [loadingMounts, setLoadingMounts] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [confirmHover, setConfirmHover] = useState(false);

  // Fetch mounts on open
  useEffect(() => {
    if (!open) return;
    setSelectedPath(null);
    setLoadingMounts(true);

    api.get<{ data: VFSMount[] }>('/vfs/mounts')
      .then(res => {
        setMountNodes(res.data.map(m => ({
          mount: m,
          children: null,
          expanded: false,
          loading: false,
        })));
      })
      .catch(() => {})
      .finally(() => setLoadingMounts(false));
  }, [open]);

  const toggleMount = useCallback(async (mNode: MountTreeNode) => {
    if (mNode.expanded) {
      mNode.expanded = false;
      setMountNodes(prev => [...prev]);
      return;
    }

    mNode.loading = true;
    setMountNodes(prev => [...prev]);

    try {
      const res = await api.get<{ data: VFSNode[] }>('/vfs/list', { path: mNode.mount.mount_path });
      mNode.children = res.data
        .filter(n => n.type === 'directory')
        .map(n => ({ node: n, children: null, expanded: false, loading: false }));
      mNode.expanded = true;
    } catch {
      mNode.children = [];
      mNode.expanded = true;
    }
    mNode.loading = false;
    setMountNodes(prev => [...prev]);
  }, []);

  const toggleDir = useCallback(async (dNode: DirNode) => {
    if (dNode.expanded) {
      dNode.expanded = false;
      setMountNodes(prev => [...prev]);
      return;
    }

    dNode.loading = true;
    setMountNodes(prev => [...prev]);

    try {
      const res = await api.get<{ data: VFSNode[] }>('/vfs/list', { path: dNode.node.path });
      dNode.children = res.data
        .filter(n => n.type === 'directory')
        .map(n => ({ node: n, children: null, expanded: false, loading: false }));
      dNode.expanded = true;
    } catch {
      dNode.children = [];
      dNode.expanded = true;
    }
    dNode.loading = false;
    setMountNodes(prev => [...prev]);
  }, []);

  // Check if a path is a source (can't be destination)
  const isSourcePath = (path: string) => sourcePaths.some(sp => sp === path || sp.startsWith(path + '/'));

  const canConfirm = selectedPath && !isSourcePath(selectedPath);
  const actionLabel = action === 'copy' ? 'Copy here' : 'Move here';
  const title = action === 'copy' ? 'Copy to...' : 'Move to...';

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as any,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 420, maxWidth: '90vw', maxHeight: '70vh',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            {title}
          </h3>
          <button
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tree */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px', minHeight: 200 }}>
          {loadingMounts ? (
            <div style={{ padding: 12, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Loading sources...</div>
          ) : mountNodes.length === 0 ? (
            <div style={{ padding: 12, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No storage sources found.</div>
          ) : (
            mountNodes.map(mNode => {
              const isRO = mNode.mount.read_only;
              const isActive = selectedPath === mNode.mount.mount_path;
              return (
                <div key={mNode.mount.id}>
                  <MountRow
                    mount={mNode.mount}
                    selected={isActive}
                    disabled={isRO}
                    expanded={mNode.expanded}
                    loading={mNode.loading}
                    onSelect={() => !isRO && setSelectedPath(mNode.mount.mount_path)}
                    onToggle={() => toggleMount(mNode)}
                  />
                  {mNode.expanded && mNode.children?.map(child => (
                    <DirTreeNode
                      key={child.node.path}
                      dNode={child}
                      depth={1}
                      selectedPath={selectedPath}
                      isReadOnly={isRO}
                      onSelect={setSelectedPath}
                      onToggle={toggleDir}
                    />
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-dim)', fontSize: '0.8125rem',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(selectedPath!)}
            disabled={!canConfirm}
            onMouseEnter={() => setConfirmHover(true)}
            onMouseLeave={() => setConfirmHover(false)}
            style={{
              padding: '6px 14px',
              background: canConfirm ? 'var(--amber)' : 'var(--surface)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: canConfirm ? '#000' : 'var(--text-muted)',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-sans)',
              opacity: canConfirm ? (confirmHover ? 0.9 : 1) : 0.5,
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function MountRow({ mount, selected, disabled, expanded, loading, onSelect, onToggle }: {
  mount: VFSMount;
  selected: boolean;
  disabled: boolean;
  expanded: boolean;
  loading: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const icon = getMountIcon(mount.provider_type);

  return (
    <div
      onClick={disabled ? undefined : onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 8px', borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'default' : 'pointer',
        background: selected ? 'var(--amber-dim)' : hovered && !disabled ? 'var(--surface-hover)' : 'transparent',
        color: disabled ? 'var(--text-muted)' : selected ? 'var(--amber)' : 'var(--text)',
        fontSize: '0.8125rem',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, display: 'flex', alignItems: 'center',
          color: 'inherit', width: 16, height: 16, flexShrink: 0,
        }}
      >
        {loading ? (
          <span style={{ fontSize: '0.625rem' }}>...</span>
        ) : expanded ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
      </button>
      {icon}
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {mount.name}
      </span>
      {disabled && <Lock size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </div>
  );
}

function DirTreeNode({ dNode, depth, selectedPath, isReadOnly, onSelect, onToggle }: {
  dNode: DirNode;
  depth: number;
  selectedPath: string | null;
  isReadOnly: boolean;
  onSelect: (path: string) => void;
  onToggle: (node: DirNode) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const selected = selectedPath === dNode.node.path;
  const hasChildren = dNode.children === null || dNode.children.length > 0;

  if (depth > 4) return null;

  return (
    <>
      <div
        onClick={isReadOnly ? undefined : () => onSelect(dNode.node.path)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px',
          paddingLeft: depth * 20 + 8,
          borderRadius: 'var(--radius-sm)',
          cursor: isReadOnly ? 'default' : 'pointer',
          background: selected ? 'var(--amber-dim)' : hovered && !isReadOnly ? 'var(--surface-hover)' : 'transparent',
          color: isReadOnly ? 'var(--text-muted)' : selected ? 'var(--amber)' : 'var(--text)',
          fontSize: '0.8125rem',
          opacity: isReadOnly ? 0.5 : 1,
        }}
      >
        <button
          onClick={e => { e.stopPropagation(); onToggle(dNode); }}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 0, display: 'flex', alignItems: 'center',
            color: 'inherit', width: 14, height: 14, flexShrink: 0,
            visibility: hasChildren ? 'visible' : 'hidden',
          }}
        >
          {dNode.loading ? (
            <span style={{ fontSize: '0.5625rem' }}>...</span>
          ) : dNode.expanded ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRight size={12} />
          )}
        </button>
        <FolderOpen size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {dNode.node.name}
        </span>
      </div>
      {dNode.expanded && dNode.children?.map(child => (
        <DirTreeNode
          key={child.node.path}
          dNode={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          isReadOnly={isReadOnly}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function getMountIcon(providerType: string) {
  switch (providerType) {
    case 'local':
      return <HardDrive size={14} style={{ color: 'var(--text-dim)' }} />;
    case 'gdrive':
      return <Cloud size={14} style={{ color: '#4285f4' }} />;
    case 'dropbox':
      return <Cloud size={14} style={{ color: '#0061fe' }} />;
    default:
      return <Cloud size={14} style={{ color: 'var(--text-dim)' }} />;
  }
}
