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
import { Crown, RefreshCw, Globe, Server, BookOpen, Home } from 'lucide-react';

export type DnsSection = 'welcome' | 'subdomain' | 'ddns' | 'local-domains' | 'zones' | 'providers';

interface DnsSidebarProps {
  active: DnsSection;
  onChange: (section: DnsSection) => void;
  zoneCount: number;
  providerCount: number;
  localDomainCount: number;
  hasSubdomain: boolean;
}

export function DnsSidebar({ active, onChange, zoneCount, providerCount, localDomainCount, hasSubdomain }: DnsSidebarProps) {
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
        <Globe size={16} style={{ color: 'var(--amber)' }} />
        DNS
      </div>

      <NavItem icon={BookOpen} label="Empezar aquí" active={active === 'welcome'} onClick={() => onChange('welcome')} />

      <SectionHeader label="Management" />
      <NavItem icon={Crown} label="Mi subdominio" active={active === 'subdomain'} onClick={() => onChange('subdomain')} dot={hasSubdomain ? '#22c55e' : undefined} badge="PRO" />
      <NavItem icon={RefreshCw} label="DNS Dinámico" active={active === 'ddns'} onClick={() => onChange('ddns')} />
      <NavItem icon={Home} label="Dominios locales" active={active === 'local-domains'} onClick={() => onChange('local-domains')} count={localDomainCount} />

      <Divider />

      <SectionHeader label="Configuration" />
      <NavItem icon={Globe} label="Zonas" active={active === 'zones'} onClick={() => onChange('zones')} count={zoneCount} />
      <NavItem icon={Server} label="Proveedores" active={active === 'providers'} onClick={() => onChange('providers')} count={providerCount} />

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
          background: '#d4a01733',
          color: '#d4a017',
          padding: '1px 5px', borderRadius: 4,
          letterSpacing: '0.04em',
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}
