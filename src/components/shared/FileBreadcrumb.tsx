import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface FileBreadcrumbProps {
  path: string;
  rootLabel?: string;
  rootIcon?: LucideIcon;
  onNavigate: (path: string) => void;
}

export function FileBreadcrumb({ path, rootLabel = 'Root', rootIcon: RootIcon, onNavigate }: FileBreadcrumbProps) {
  // Split path into segments: "/drive/Documents/Projects/" → ["drive", "Documents", "Projects"]
  const segments = path.replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean);
  const isLast = (i: number) => i === segments.length - 1;

  // Build path for each segment
  const getPath = (idx: number) => '/' + segments.slice(0, idx + 1).join('/') + '/';

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
      {segments.map((seg, i) => {
        const label = i === 0 ? rootLabel : seg;
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
                {label}
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
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
