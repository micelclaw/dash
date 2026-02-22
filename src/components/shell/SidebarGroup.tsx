interface SidebarGroupProps {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}

export function SidebarGroup({ label, collapsed, children }: SidebarGroupProps) {
  return (
    <div style={{ paddingTop: 16 }}>
      {!collapsed && (
        <>
          <div
            style={{
              height: 1,
              background: 'var(--border)',
              marginBottom: 12,
            }}
          />
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 500,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0 12px',
              marginBottom: 4,
            }}
          >
            {label}
          </div>
        </>
      )}
      {collapsed && (
        <div
          style={{
            height: 1,
            background: 'var(--border)',
            marginBottom: 8,
            marginLeft: 8,
            marginRight: 8,
          }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {children}
      </div>
    </div>
  );
}
