import { useState } from 'react';
import {
  LayoutDashboard, Server, ArrowLeftRight, Ban,
  ShieldCheck, Lock, FileText, Settings,
  Globe, Crown, Radio, RefreshCw,
} from 'lucide-react';
import type { ProxyStatus } from './hooks/use-proxy-status';

export type ProxySection =
  | 'overview' | 'hosts' | 'redirects' | 'streams' | '404_hosts'
  | 'certificates' | 'access_lists'
  | 'audit_log' | 'settings'
  | 'dns' | 'ddns' | 'subdomain';

interface ProxySidebarProps {
  active: ProxySection;
  onChange: (section: ProxySection) => void;
  status: ProxyStatus | null;
  hostCounts: { proxy: number; redirect: number; notfound: number };
  certCount: number;
  aclCount: number;
  hasCfConfig: boolean;
}

export function ProxySidebar({
  active, onChange, status, hostCounts, certCount, aclCount, hasCfConfig,
}: ProxySidebarProps) {
  return (
    <div style={{
      width: 210, flexShrink: 0,
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
          boxShadow: status?.running ? '0 0 6px rgba(34,197,94,0.4)' : 'none',
          flexShrink: 0,
        }} />
        Reverse Proxy
      </div>

      {/* ─── PROXY ─── */}
      <SectionHeader label="Proxy" />
      <NavItem icon={LayoutDashboard} label="Dashboard" active={active === 'overview'} onClick={() => onChange('overview')} />
      <NavItem icon={Server} label="Proxy Hosts" active={active === 'hosts'} onClick={() => onChange('hosts')} count={hostCounts.proxy} />
      <NavItem icon={ArrowLeftRight} label="Redirections" active={active === 'redirects'} onClick={() => onChange('redirects')} count={hostCounts.redirect} />
      <NavItem icon={Radio} label="Streams" active={active === 'streams'} onClick={() => onChange('streams')} badge="SOON" />
      <NavItem icon={Ban} label="404 Hosts" active={active === '404_hosts'} onClick={() => onChange('404_hosts')} count={hostCounts.notfound} />

      <Divider />

      {/* ─── SECURITY ─── */}
      <SectionHeader label="Security" />
      <NavItem icon={Lock} label="SSL Certificates" active={active === 'certificates'} onClick={() => onChange('certificates')} count={certCount} />
      <NavItem icon={ShieldCheck} label="Access Lists" active={active === 'access_lists'} onClick={() => onChange('access_lists')} count={aclCount} />

      <Divider />

      {/* ─── SYSTEM ─── */}
      <SectionHeader label="System" />
      <NavItem icon={FileText} label="Audit Log" active={active === 'audit_log'} onClick={() => onChange('audit_log')} />
      <NavItem icon={Settings} label="Settings" active={active === 'settings'} onClick={() => onChange('settings')} />

      <Divider />

      {/* ─── DNS ─── */}
      <SectionHeader label="DNS" />
      <NavItem icon={Globe} label="DNS Records" active={active === 'dns'} onClick={() => onChange('dns')} dot={hasCfConfig ? '#22c55e' : undefined} />
      <NavItem icon={RefreshCw} label="Dynamic DNS" active={active === 'ddns'} onClick={() => onChange('ddns')} />
      <NavItem icon={Crown} label="Subdomain" active={active === 'subdomain'} onClick={() => onChange('subdomain')} badge="PRO" />

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

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '8px 12px' }} />;
}

function NavItem({ icon: Icon, label, active, onClick, dot, badge, count }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
  dot?: string;
  badge?: string;
  count?: number;
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
      {typeof count === 'number' && count > 0 && (
        <span style={{
          fontSize: '0.625rem', fontWeight: 600,
          background: 'var(--surface-hover)', color: 'var(--text-muted)',
          padding: '1px 6px', borderRadius: 10,
          minWidth: 18, textAlign: 'center',
        }}>
          {count}
        </span>
      )}
      {badge && (
        <span style={{
          fontSize: '0.5625rem', fontWeight: 700,
          background: badge === 'SOON' ? 'rgba(107,114,128,0.2)' : '#d4a01733',
          color: badge === 'SOON' ? '#6b7280' : '#d4a017',
          padding: '1px 5px', borderRadius: 4,
          letterSpacing: '0.04em',
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}
