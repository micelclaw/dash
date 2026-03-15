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
import { DnsSidebar, type DnsSection } from './DnsSidebar';
import { useDdns } from './hooks/use-ddns';
import { useSubdomain } from './hooks/use-subdomain';
import { useDnsZones } from './hooks/use-dns-zones';
import { useDnsProviders } from './hooks/use-dns-providers';
import { useLocalDomains } from './hooks/use-local-domains';
import { MicelclawSubdomain } from './sections/MicelclawSubdomain';
import { DdnsSection } from './sections/DdnsSection';
import { ZonesSection } from './sections/ZonesSection';
import { ProvidersSection } from './sections/ProvidersSection';
import { LocalDomainsSection } from './sections/LocalDomainsSection';
import { DnsWelcomeBanner } from './components/DnsWelcomeBanner';

export function Component() {
  const ddns = useDdns();
  const subdomain = useSubdomain();
  const zones = useDnsZones();
  const providerHook = useDnsProviders();
  const localDomains = useLocalDomains();
  const [section, setSection] = useState<DnsSection>('welcome');

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      <DnsSidebar
        active={section}
        onChange={setSection}
        zoneCount={zones.zones.length}
        providerCount={providerHook.providers.length}
        localDomainCount={localDomains.domains.length}
        hasSubdomain={!!subdomain.request}
      />

      <div style={{
        flex: 1, minWidth: 0,
        overflow: 'auto',
        background: 'var(--bg)',
        position: 'relative',
      }}>
        {section === 'welcome' && (
          <DnsWelcomeBanner onNavigate={setSection} />
        )}
        {section === 'subdomain' && (
          <MicelclawSubdomain
            request={subdomain.request}
            loading={subdomain.loading}
            onRequest={subdomain.requestSubdomain}
            onRelease={subdomain.release}
            onCheck={subdomain.checkStatus}
          />
        )}
        {section === 'ddns' && (
          <DdnsSection
            status={ddns.status}
            config={ddns.config}
            history={ddns.history}
            loading={ddns.loading}
            updating={ddns.updating}
            onUpdateConfig={ddns.updateConfig}
            onAddProvider={ddns.addProvider}
            onUpdateProvider={ddns.updateProvider}
            onRemoveProvider={ddns.removeProvider}
            onForceUpdate={ddns.forceUpdate}
            hasCfConfig={false}
          />
        )}
        {section === 'local-domains' && (
          <LocalDomainsSection
            domains={localDomains.domains}
            setup={localDomains.setup}
            loading={localDomains.loading}
            onAdd={localDomains.addDomain}
            onRemove={localDomains.removeDomain}
            onDownloadCa={localDomains.downloadCaCertificate}
          />
        )}
        {section === 'zones' && (
          <ZonesSection
            zones={zones.zones}
            records={zones.records}
            templates={zones.templates}
            providers={providerHook.providers}
            loading={zones.loading}
            recordsLoading={zones.recordsLoading}
            selectedZoneId={zones.selectedZoneId}
            onSelectZone={zones.selectZone}
            onAddZone={zones.addZone}
            onRemoveZone={zones.removeZone}
            onSyncZone={zones.syncZone}
            onVerifyNs={zones.verifyNs}
            onUpdateDdns={zones.updateZoneDdns}
            onCreateRecord={zones.createRecord}
            onUpdateRecord={zones.updateRecord}
            onDeleteRecord={zones.deleteRecord}
            onApplyTemplate={zones.applyTemplate}
            onGetPublicIp={zones.getPublicIp}
            onCheckPort53={zones.checkPort53}
            onGetDnssecStatus={zones.getDnssecStatus}
            onEnableDnssec={zones.enableDnssec}
            onDisableDnssec={zones.disableDnssec}
            onNavigateSubdomain={() => setSection('subdomain')}
          />
        )}
        {section === 'providers' && (
          <ProvidersSection
            providers={providerHook.providers}
            loading={providerHook.loading}
            onAdd={providerHook.addProvider}
            onTest={providerHook.testConnection}
            onRemove={providerHook.removeProvider}
          />
        )}
      </div>
    </div>
  );
}
