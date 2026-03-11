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

  const handleOpenPanel = useCallback(() => setSection('wg-easy'), []);
  const handleGoTailscale = useCallback(() => setSection('tailscale'), []);

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
            vpnStatus={vpn.status}
            tailscaleStatus={tailscale.status}
            loading={vpn.loading || tailscale.loading}
            wgEasyStatus={wgEasy.status}
            wgEasyStarting={wgEasy.starting}
            onOpenPanel={handleOpenPanel}
            onGoTailscale={handleGoTailscale}
            onWgStart={wgEasy.start}
            onWgStop={wgEasy.stop}
            onTailscaleInstall={tailscale.install}
            onTailscaleLogin={tailscale.login}
            onTailscaleLogout={tailscale.logout}
            tailscaleActing={tailscale.acting}
            onRefreshVpn={vpn.refresh}
          />
        )}
        {section === 'peers' && (
          <WgPeersSection
            clients={wgClients.clients}
            loading={wgClients.loading}
            endpointChanged={wgEasy.status?.endpoint_changed ?? false}
            endpointReachable={wgEasy.status?.endpoint_reachable ?? true}
            endpointMethod={wgEasy.status?.endpoint_method ?? 'none'}
            onDismissIpChange={wgEasy.dismissIpChange}
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
            currentAction={tailscale.currentAction}
            installLogs={tailscale.installLogs}
            uninstallLogs={tailscale.uninstallLogs}
            authUrl={tailscale.authUrl}
            onInstall={tailscale.install}
            onLogin={tailscale.login}
            onLogout={tailscale.logout}
            onUninstall={tailscale.uninstall}
            onRefresh={tailscale.refresh}
          />
        )}
      </div>
    </div>
  );
}
