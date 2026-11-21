import { useState } from 'react';
import { useI18n } from '@/i18n';
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
  { icon: LayoutDashboard, label: 'mailServer.dashboard', path: '' },
  { icon: Globe, label: 'mailServer.domain', path: '/domains' },
  { icon: Inbox, label: 'mailServer.mailboxes', path: '/mailboxes' },
  { icon: ArrowRightLeft, label: 'mailServer.aliases', path: '/aliases' },
  { icon: Route, label: 'mailServer.relay', path: '/relays' },
];

const NAV_SECURITY: NavDef[] = [
  { icon: Search, label: 'mailServer.dnsHealth', path: '/dns' },
  { icon: Shield, label: 'mailServer.antispam', path: '/security/antispam' },
  { icon: Shield, label: 'mailServer.antivirus', path: '/security/antivirus' },
  { icon: Shield, label: 'mailServer.threats', path: '/security/threats' },
];

const NAV_MONITORING: NavDef[] = [
  { icon: Activity, label: 'mailServer.general', path: '/monitoring/overview' },
  { icon: Activity, label: 'mailServer.mailQueue', path: '/monitoring/queue' },
  { icon: Activity, label: 'mailServer.audit', path: '/monitoring/audit' },
];

const NAV_DELIVERY: NavDef[] = [
  { icon: Send, label: 'mailServer.smtpRelay', path: '/delivery/relay' },
  { icon: Send, label: 'mailServer.configuration', path: '/delivery/settings' },
];

const NAV_MANAGE: NavDef[] = [
  { icon: Crown, label: 'mailServer.administrators', path: '/administrators' },
  { icon: Megaphone, label: 'mailServer.broadcasts', path: '/broadcasts' },
  { icon: Monitor, label: 'mailServer.clientSetup', path: '/client-setup' },
];

export function MailServerSidebar() {
  const { t } = useI18n();
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
        {t('mailServer.title')}
      </div>

      {NAV_MAIN.map((n) => (
        <NavItem key={n.path} icon={n.icon} label={t(n.label)} active={isActive(n.path)} onClick={() => navigate(BASE + n.path)} />
      ))}

      <SectionHeader label={t('mailServer.security')} />
      {NAV_SECURITY.map((n) => (
        <NavItem key={n.path} icon={n.icon} label={t(n.label)} active={isActive(n.path)} onClick={() => navigate(BASE + n.path)} />
      ))}

      <SectionHeader label={t('mailServer.monitoring')} />
      {NAV_MONITORING.map((n) => (
        <NavItem key={n.path} icon={n.icon} label={t(n.label)} active={isActive(n.path)} onClick={() => navigate(BASE + n.path)} />
      ))}

      <SectionHeader label={t('mailServer.delivery')} />
      {NAV_DELIVERY.map((n) => (
        <NavItem key={n.path} icon={n.icon} label={t(n.label)} active={isActive(n.path)} onClick={() => navigate(BASE + n.path)} />
      ))}

      <Divider />

      <SectionHeader label={t('mailServer.management')} />
      {NAV_MANAGE.map((n) => (
        <NavItem key={n.path} icon={n.icon} label={t(n.label)} active={isActive(n.path)} onClick={() => navigate(BASE + n.path)} />
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
