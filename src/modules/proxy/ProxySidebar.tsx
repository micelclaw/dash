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

import { useState } from 'react';
import {
  LayoutDashboard, Server, ArrowLeftRight, Ban,
  ShieldCheck, Lock, FileText, Settings, Radio,
} from 'lucide-react';
import type { ProxyStatus } from './hooks/use-proxy-status';
import { useI18n } from '@/i18n';

export type ProxySection =
  | 'overview' | 'hosts' | 'redirects' | 'streams' | '404_hosts'
  | 'certificates' | 'access_lists'
  | 'audit_log' | 'settings';

interface ProxySidebarProps {
  active: ProxySection;
  onChange: (section: ProxySection) => void;
  status: ProxyStatus | null;
  hostCounts: { proxy: number; redirect: number; notfound: number };
  certCount: number;
  aclCount: number;
}

export function ProxySidebar({
  active, onChange, status, hostCounts, certCount, aclCount,
}: ProxySidebarProps) {
  const { t } = useI18n();
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
        {t('proxy.reverseProxy')}
      </div>

      {/* ─── PROXY ─── */}
      <SectionHeader label={t('proxy.section')} />
      <NavItem icon={LayoutDashboard} label={t('proxy.dashboard')} active={active === 'overview'} onClick={() => onChange('overview')} />
      <NavItem icon={Server} label={t('proxy.hosts')} active={active === 'hosts'} onClick={() => onChange('hosts')} count={hostCounts.proxy} />
      <NavItem icon={ArrowLeftRight} label={t('proxy.redirections')} active={active === 'redirects'} onClick={() => onChange('redirects')} count={hostCounts.redirect} />
      <NavItem icon={Radio} label={t('proxy.streams')} active={active === 'streams'} onClick={() => onChange('streams')} badge={t('proxy.soon')} />
      <NavItem icon={Ban} label={t('proxy.notFoundHosts')} active={active === '404_hosts'} onClick={() => onChange('404_hosts')} count={hostCounts.notfound} />

      <Divider />

      {/* ─── SECURITY ─── */}
      <SectionHeader label={t('proxy.security')} />
      <NavItem icon={Lock} label={t('proxy.certificates')} active={active === 'certificates'} onClick={() => onChange('certificates')} count={certCount} />
      <NavItem icon={ShieldCheck} label={t('proxy.accessLists')} active={active === 'access_lists'} onClick={() => onChange('access_lists')} count={aclCount} />

      <Divider />

      {/* ─── SYSTEM ─── */}
      <SectionHeader label={t('proxy.system')} />
      <NavItem icon={FileText} label={t('proxy.auditLog')} active={active === 'audit_log'} onClick={() => onChange('audit_log')} />
      <NavItem icon={Settings} label={t('proxy.settings')} active={active === 'settings'} onClick={() => onChange('settings')} />

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
