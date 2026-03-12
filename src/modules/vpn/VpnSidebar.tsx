import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Download,
  Globe, ExternalLink, Lightbulb, Menu, X,
} from 'lucide-react';
import type { VpnStatus } from './hooks/use-vpn';
import type { TailscaleStatus } from './hooks/use-tailscale';
import type { WgEasyStatus } from './hooks/use-wg-easy';

export type VpnSection = 'overview' | 'wg-easy' | 'peers' | 'backup' | 'tailscale' | 'ideas';

interface VpnSidebarProps {
  active: VpnSection;
  onChange: (section: VpnSection) => void;
  vpnStatus: VpnStatus | null;
  peerCount: number;
  wgEasyStatus: WgEasyStatus | null;
  tailscaleStatus: TailscaleStatus | null;
}

const WG_ITEMS: { id: VpnSection; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'peers', label: 'Peers', icon: Users },
  { id: 'wg-easy', label: 'WireGuard Panel', icon: ExternalLink },
  { id: 'backup', label: 'Backup', icon: Download },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
];

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

const SECTION_LABELS: Record<VpnSection, string> = {
  overview: 'Overview',
  peers: 'Peers',
  'wg-easy': 'WireGuard Panel',
  backup: 'Backup',
  tailscale: 'Tailscale',
  ideas: 'Ideas',
};

export function VpnSidebar({
  active, onChange, vpnStatus, peerCount, wgEasyStatus, tailscaleStatus,
}: VpnSidebarProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleNav = (section: VpnSection) => {
    onChange(section);
    setOpen(false);
  };

  const navContent = (
    <>
      {/* Overview — shared */}
      <NavItem
        icon={LayoutDashboard}
        label="Overview"
        active={active === 'overview'}
        onClick={() => handleNav('overview')}
      />

      <div style={{ height: 1, background: 'var(--border)', margin: '8px 12px' }} />

      {/* WireGuard section */}
      <SectionHeader label="WireGuard" />
      {WG_ITEMS.map(item => (
        <NavItem
          key={item.id}
          icon={item.icon}
          label={item.id === 'peers' ? `Peers (${peerCount})` : item.label}
          active={active === item.id}
          onClick={() => handleNav(item.id)}
          dot={item.id === 'wg-easy'
            ? (wgEasyStatus?.running ? '#22c55e' : '#6b7280')
            : undefined
          }
        />
      ))}

      {/* Separator */}
      <div style={{ height: 1, background: 'var(--border)', margin: '8px 12px' }} />

      {/* Tailscale section */}
      <SectionHeader label="Tailscale" />
      <NavItem
        icon={Globe}
        label="Status"
        active={active === 'tailscale'}
        onClick={() => handleNav('tailscale')}
        dot={
          tailscaleStatus?.logged_in ? '#22c55e'
          : tailscaleStatus?.installed ? '#f59e0b'
          : '#6b7280'
        }
      />
    </>
  );

  if (isMobile) {
    return (
      <div style={{ flexShrink: 0, fontFamily: 'var(--font-sans)' }}>
        {/* Collapsed bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          <button
            onClick={() => setOpen(!open)}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--text)', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: wgEasyStatus?.running ? '#22c55e' : vpnStatus?.enabled ? '#22c55e' : '#6b7280',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            VPN — {SECTION_LABELS[active]}
          </span>
        </div>

        {/* Expandable nav */}
        {open && (
          <div style={{
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg)',
            paddingBottom: 8,
          }}>
            {navContent}
          </div>
        )}
      </div>
    );
  }

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
          background: wgEasyStatus?.running ? '#22c55e' : vpnStatus?.enabled ? '#22c55e' : '#6b7280',
          flexShrink: 0,
        }} />
        VPN
      </div>

      {navContent}

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

function NavItem({ icon: Icon, label, active, onClick, dot }: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
  dot?: string;
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
    </button>
  );
}
