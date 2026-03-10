import { useState } from 'react';
import {
  LayoutDashboard, Server, ShieldCheck,
  Globe, Crown,
} from 'lucide-react';
import type { ProxyStatus } from './hooks/use-proxy';

export type ProxySection = 'overview' | 'hosts' | 'ssl' | 'dns' | 'subdomain';

interface ProxySidebarProps {
  active: ProxySection;
  onChange: (section: ProxySection) => void;
  status: ProxyStatus | null;
  routeCount: number;
  hasCfConfig: boolean;
}

const PROXY_ITEMS: { id: ProxySection; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'hosts', label: 'Proxy Hosts', icon: Server },
  { id: 'ssl', label: 'SSL / Certificates', icon: ShieldCheck },
];

const DNS_ITEMS: { id: ProxySection; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'dns', label: 'DNS Records', icon: Globe },
];

export function ProxySidebar({
  active, onChange, status, routeCount, hasCfConfig,
}: ProxySidebarProps) {
  return (
    <div style={{
      width: 200, flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 14px 8px',
        fontSize: '0.875rem', fontWeight: 600,
        color: 'var(--text)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: status?.running ? '#22c55e' : '#6b7280',
          flexShrink: 0,
        }} />
        Reverse Proxy
      </div>

      {/* Proxy section */}
      <SectionHeader label="Proxy" />
      {PROXY_ITEMS.map(item => (
        <NavItem
          key={item.id}
          icon={item.icon}
          label={item.id === 'hosts' ? `Proxy Hosts (${routeCount})` : item.label}
          active={active === item.id}
          onClick={() => onChange(item.id)}
        />
      ))}

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--border)', margin: '8px 12px' }} />

      {/* DNS section */}
      <SectionHeader label="DNS" />
      {DNS_ITEMS.map(item => (
        <NavItem
          key={item.id}
          icon={item.icon}
          label={item.label}
          active={active === item.id}
          onClick={() => onChange(item.id)}
          dot={hasCfConfig ? '#22c55e' : undefined}
        />
      ))}
      <NavItem
        icon={Crown}
        label="Subdomain"
        active={active === 'subdomain'}
        onClick={() => onChange('subdomain')}
        badge="PRO"
      />

      <div style={{ flex: 1 }} />
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: '0.625rem', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      color: 'var(--text-muted)',
      padding: '10px 14px 4px',
    }}>
      {label}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, dot, badge }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
  dot?: string;
  badge?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', height: 32,
        padding: '0 14px',
        background: active ? 'var(--surface-hover)' : hovered ? 'var(--surface-hover)' : 'transparent',
        border: 'none', borderLeft: active ? '2px solid var(--amber)' : '2px solid transparent',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        color: active ? 'var(--amber)' : 'var(--text-dim)',
        fontFamily: 'var(--font-sans)',
        textAlign: 'left',
        transition: 'background var(--transition-fast)',
      }}
    >
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dot, flexShrink: 0,
        }} />
      )}
      <Icon size={14} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {badge && (
        <span style={{
          fontSize: '0.5625rem', fontWeight: 700,
          background: '#d4a01733', color: '#d4a017',
          padding: '1px 5px', borderRadius: 4,
          letterSpacing: '0.04em',
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}
