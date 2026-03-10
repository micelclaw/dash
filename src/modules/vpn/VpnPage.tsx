import { useState, useCallback } from 'react';
import { useVpn } from './hooks/use-vpn';
import { useTailscale } from './hooks/use-tailscale';
import { useWgEasy } from './hooks/use-wg-easy';
import { useWgClients } from './hooks/use-wg-clients';
import { VpnSidebar, type VpnSection } from './VpnSidebar';
import { OverviewSection } from './sections/OverviewSection';
import { WgPeersSection } from './sections/WgPeersSection';
import { BackupSection } from './sections/BackupSection';
import { TailscaleSection } from './sections/TailscaleSection';
import { WgEasyIframe } from './sections/WgEasyIframe';
import { IdeasSection } from './sections/IdeasSection';

export function Component() {
  const vpn = useVpn();
  const tailscale = useTailscale();
  const wgEasy = useWgEasy();
  const wgClients = useWgClients();
  const [section, setSection] = useState<VpnSection>('overview');

  const handleOpenPanel = useCallback(() => {
    setSection('wg-easy');
  }, []);

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      <VpnSidebar
        active={section}
        onChange={setSection}
        vpnStatus={vpn.status}
        peerCount={wgClients.clients.length}
        wgEasyStatus={wgEasy.status}
        tailscaleStatus={tailscale.status}
      />

      <div style={{
        flex: 1, minWidth: 0,
        overflow: 'auto',
        background: 'var(--bg)',
        position: 'relative',
      }}>
        {section === 'overview' && (
          <OverviewSection
            status={vpn.status}
            loading={vpn.loading}
            wgEasyStatus={wgEasy.status}
            onOpenPanel={handleOpenPanel}
          />
        )}
        {section === 'peers' && (
          <WgPeersSection
            clients={wgClients.clients}
            loading={wgClients.loading}
            onCreate={wgClients.create}
            onRemove={wgClients.remove}
            onToggle={wgClients.toggle}
            onRename={wgClients.rename}
            onGetConfig={wgClients.getConfig}
            onGetQrCode={wgClients.getQrCode}
          />
        )}
        {section === 'wg-easy' && (
          <WgEasyIframe
            status={wgEasy.status}
            loading={wgEasy.loading}
            starting={wgEasy.starting}
            onStart={wgEasy.start}
          />
        )}
        {section === 'backup' && (
          <BackupSection
            onExport={vpn.exportConfig}
            onImport={vpn.importConfig}
          />
        )}
        {section === 'ideas' && (
          <IdeasSection onOpenPanel={handleOpenPanel} />
        )}
        {section === 'tailscale' && (
          <TailscaleSection
            status={tailscale.status}
            loading={tailscale.loading}
            acting={tailscale.acting}
            onInstall={tailscale.install}
            onLogin={tailscale.login}
            onLogout={tailscale.logout}
          />
        )}
      </div>
    </div>
  );
}
