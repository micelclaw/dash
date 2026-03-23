import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard, Globe, Inbox, ArrowRightLeft, Route,
  Crown, Megaphone, Monitor, Search, Shield, Activity,
  Send, Server,
} from 'lucide-react';

const BASE = '/mail-server';

interface NavDef {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  path: string;
}

const NAV_MAIN: NavDef[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '' },
  { icon: Globe, label: 'Dominios', path: '/domains' },
  { icon: Inbox, label: 'Buzones', path: '/mailboxes' },
  { icon: ArrowRightLeft, label: 'Aliases', path: '/aliases' },
  { icon: Route, label: 'Relay', path: '/relays' },
];

const NAV_SECURITY: NavDef[] = [
  { icon: Search, label: 'DNS Health', path: '/dns' },
  { icon: Shield, label: 'Antispam', path: '/security/antispam' },
  { icon: Shield, label: 'Antivirus', path: '/security/antivirus' },
  { icon: Shield, label: 'Amenazas', path: '/security/threats' },
];

const NAV_MONITORING: NavDef[] = [
  { icon: Activity, label: 'General', path: '/monitoring/overview' },
  { icon: Activity, label: 'Cola de correo', path: '/monitoring/queue' },
  { icon: Activity, label: 'Auditoría', path: '/monitoring/audit' },
];

const NAV_DELIVERY: NavDef[] = [
  { icon: Send, label: 'SMTP Relay', path: '/delivery/relay' },
  { icon: Send, label: 'Configuración', path: '/delivery/settings' },
];

const NAV_MANAGE: NavDef[] = [
  { icon: Crown, label: 'Administradores', path: '/administrators' },
  { icon: Megaphone, label: 'Comunicados', path: '/broadcasts' },
  { icon: Monitor, label: 'Config. cliente', path: '/client-setup' },
];

export function MailServerSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    const full = BASE + path;
    if (path === '') return location.pathname === BASE || location.pathname === BASE + '/';
    return location.pathname.startsWith(full);
  };

  return (
    <div style={{
      width: 210, flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      overflow: 'auto',
    }}>
      <div style={{
        padding: '16px 14px 8px',
        fontSize: '0.875rem', fontWeight: 600,
        color: 'var(--text)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Server size={16} style={{ color: 'var(--amber)' }} />
        Mail Server
      </div>

      {NAV_MAIN.map((n) => (
        <NavItem key={n.path} icon={n.icon} label={n.label} active={isActive(n.path)} onClick={() => navigate(BASE + n.path)} />
      ))}

      <SectionHeader label="Seguridad" />
      {NAV_SECURITY.map((n) => (
        <NavItem key={n.path} icon={n.icon} label={n.label} active={isActive(n.path)} onClick={() => navigate(BASE + n.path)} />
      ))}

      <SectionHeader label="Monitorización" />
      {NAV_MONITORING.map((n) => (
        <NavItem key={n.path} icon={n.icon} label={n.label} active={isActive(n.path)} onClick={() => navigate(BASE + n.path)} />
      ))}

      <SectionHeader label="Entrega" />
      {NAV_DELIVERY.map((n) => (
        <NavItem key={n.path} icon={n.icon} label={n.label} active={isActive(n.path)} onClick={() => navigate(BASE + n.path)} />
      ))}

      <Divider />

      <SectionHeader label="Gestión" />
      {NAV_MANAGE.map((n) => (
        <NavItem key={n.path} icon={n.icon} label={n.label} active={isActive(n.path)} onClick={() => navigate(BASE + n.path)} />
      ))}

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

function NavItem({ icon: Icon, label, active, onClick }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
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
        background: active || hovered ? 'var(--surface-hover)' : 'transparent',
        border: 'none', borderLeft: active ? '2px solid var(--amber)' : '2px solid transparent',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        color: active ? 'var(--amber)' : 'var(--text-dim)',
        fontFamily: 'var(--font-sans)',
        textAlign: 'left',
        transition: 'background var(--transition-fast)',
      }}
    >
      <Icon size={14} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}
