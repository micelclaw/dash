import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FileBreadcrumbProps {
  path: string;
  rootLabel?: string;
  rootIcon?: LucideIcon;
  rootBasePath?: string;
  onNavigate: (path: string) => void;
}

export function FileBreadcrumb({ path, rootLabel = 'Root', rootIcon: RootIcon, rootBasePath, onNavigate }: FileBreadcrumbProps) {
  // Split path into segments: "/drive/Documents/Projects/" → ["drive", "Documents", "Projects"]
  const allSegments = path.replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean);

  // Determine how many leading segments belong to the root (basePath)
  // e.g. basePath="/vfs/gdrive/" → rootSegCount=2 → skip "vfs","gdrive", show rootLabel instead
  const rootSegCount = rootBasePath
    ? rootBasePath.replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean).length
    : 1;

  // Segments to display: rootLabel + remaining path segments after root
  const segments = allSegments.slice(rootSegCount);
  // Prepend a synthetic root entry
  const displaySegments = [rootLabel, ...segments];

  const isLast = (i: number) => i === displaySegments.length - 1;

  // Build path for each segment (root = basePath, then append sub-segments)
  const rootPath = rootBasePath
    ? (rootBasePath.endsWith('/') ? rootBasePath : rootBasePath + '/')
    : '/' + allSegments.slice(0, rootSegCount).join('/') + '/';
  const getPath = (idx: number) => {
    if (idx === 0) return rootPath;
    return rootPath + segments.slice(0, idx).join('/') + '/';
  };

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        fontSize: '0.8125rem',
        fontFamily: 'var(--font-sans)',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {displaySegments.map((seg, i) => {
        const last = isLast(i);
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
            {last ? (
              <span
                style={{
                  color: 'var(--text)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {i === 0 && RootIcon && <RootIcon size={14} style={{ marginRight: 4, verticalAlign: -2, color: 'var(--text-dim)' }} />}
                {seg}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(getPath(i))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.8125rem',
                  padding: 0,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--amber)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
              >
                {i === 0 && RootIcon && <RootIcon size={14} style={{ marginRight: 4, verticalAlign: -2 }} />}
                {seg}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
