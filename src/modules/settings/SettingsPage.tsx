import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Globe, Cpu, RefreshCw, Mail, Image, Palette, Shield, CreditCard,
  Search as SearchIcon, Newspaper, HardDrive, Users, Network, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings.store';
import { useSecurityStore } from '@/stores/security.store';
import { useAuthStore } from '@/stores/auth.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { GeneralSection } from '@/components/settings/sections/GeneralSection';
import { AISection } from '@/components/settings/sections/AISection';
import { SyncSection } from '@/components/settings/sections/SyncSection';
import { MailSection } from '@/components/settings/sections/MailSection';
import { PhotosSection } from '@/components/settings/sections/PhotosSection';
import { DashSection } from '@/components/settings/sections/DashSection';
import { StorageSection } from '@/components/settings/sections/StorageSection';
import { SecuritySection } from '@/components/settings/sections/SecuritySection';
import { LicenseSection } from '@/components/settings/sections/LicenseSection';
import { DigestSection } from '@/components/settings/sections/DigestSection';
import { SearchSection } from '@/components/settings/sections/SearchSection';
import { UsersSection } from '@/components/settings/sections/UsersSection';
import { NetworkSection } from '@/components/settings/sections/NetworkSection';
import { EnergySection } from '@/components/settings/sections/EnergySection';

interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
  dividerBefore?: boolean;
}

function buildSections(isAdmin: boolean): SidebarItem[] {
  const sections: SidebarItem[] = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'ai', label: 'AI & Intelligence', icon: Cpu },
    { id: 'sync', label: 'Sync', icon: RefreshCw },
    { id: 'mail', label: 'Mail', icon: Mail },
    { id: 'photos', label: 'Photos', icon: Image },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'network', label: 'Red', icon: Network },
    { id: 'energy', label: 'Energia', icon: Zap },
    { id: 'dash', label: 'Dash', icon: Palette },
    { id: 'search', label: 'Search', icon: SearchIcon, dividerBefore: true },
    { id: 'digest', label: 'Digest', icon: Newspaper },
  ];
  if (isAdmin) {
    sections.push({ id: 'users', label: 'Users', icon: Users, dividerBefore: true });
  }
  sections.push({ id: 'security', label: 'Security', icon: Shield, dividerBefore: !isAdmin });
  sections.push({ id: 'license', label: 'License', icon: CreditCard });
  return sections;
}

function renderSection(section: string) {
  switch (section) {
    case 'general': return <GeneralSection />;
    case 'ai': return <AISection />;
    case 'sync': return <SyncSection />;
    case 'mail': return <MailSection />;
    case 'photos': return <PhotosSection />;
    case 'storage': return <StorageSection />;
    case 'network': return <NetworkSection />;
    case 'energy': return <EnergySection />;
    case 'dash': return <DashSection />;
    case 'users': return <UsersSection />;
    case 'security': return <SecuritySection />;
    case 'license': return <LicenseSection />;
    case 'search': return <SearchSection />;
    case 'digest': return <DigestSection />;
    default: return <GeneralSection />;
  }
}

export function Component() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const activeSection = section || 'general';

  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const fetchConfig = useSecurityStore((s) => s.fetchConfig);
  const loading = useSettingsStore((s) => s.loading);
  const settings = useSettingsStore((s) => s.settings);
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const SECTIONS = useMemo(() => buildSections(isAdmin), [isAdmin]);

  useEffect(() => {
    fetchSettings();
    fetchConfig();
  }, [fetchSettings, fetchConfig]);

  if (loading && !settings) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem' }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      {/* Sidebar / Mobile dropdown */}
      {isMobile ? (
        <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '8px 16px' }}>
          <select
            value={activeSection}
            onChange={(e) => navigate(`/settings/${e.target.value}`, { replace: true })}
            style={{
              width: '100%',
              height: 36,
              padding: '0 10px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text)',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
            }}
          >
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}{s.soon ? ' (soon)' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <nav
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
            padding: '16px 8px',
            overflowY: 'auto',
          }}
        >
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <div key={item.id}>
                {item.dividerBefore && (
                  <div style={{ height: 1, background: 'var(--border)', margin: '8px 4px' }} />
                )}
                <button
                  onClick={() => navigate(`/settings/${item.id}`, { replace: true })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '8px 12px',
                    background: isActive ? 'var(--surface-hover)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--amber)' : 'var(--text-dim)',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--surface)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Icon size={16} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.soon && (
                    <span
                      style={{
                        fontSize: '0.625rem',
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      soon
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? 16 : '24px 32px',
          position: 'relative',
        }}
      >
        {renderSection(activeSection)}
      </div>
    </div>
  );
}
