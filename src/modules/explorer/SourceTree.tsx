import { useMemo } from 'react';
import { SOURCE_ROOTS } from './types';
import { SourceTreeItem } from './SourceTreeItem';
import { useAuthStore } from '@/stores/auth.store';

interface SourceTreeProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function SourceTree({ currentPath, onNavigate }: SourceTreeProps) {
  const { user } = useAuthStore();
  const userRole = user?.role ?? 'user';

  const visibleSources = useMemo(
    () => SOURCE_ROOTS.filter(s => !s.requiredRoles || s.requiredRoles.includes(userRole)),
    [userRole],
  );

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
      <div
        style={{
          fontSize: '0.625rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          padding: '4px 8px 6px',
        }}
      >
        Sources
      </div>
      {visibleSources.map(source => (
        <SourceTreeItem
          key={source.id}
          source={source}
          depth={0}
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}
