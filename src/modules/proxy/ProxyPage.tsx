import { useState } from 'react';
import { useProxy } from './hooks/use-proxy';
import { useCloudflare } from './hooks/use-cloudflare-dns';
import { useSubdomain } from './hooks/use-subdomain';
import { ProxySidebar, type ProxySection } from './ProxySidebar';
import { OverviewSection } from './sections/OverviewSection';
import { ProxyHostsSection } from './sections/ProxyHostsSection';
import { SslSection } from './sections/SslSection';
import { DnsSection } from './sections/DnsSection';
import { SubdomainSection } from './sections/SubdomainSection';

export function Component() {
  const proxy = useProxy();
  const cloudflare = useCloudflare();
  const subdomain = useSubdomain();
  const [section, setSection] = useState<ProxySection>('overview');

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      <ProxySidebar
        active={section}
        onChange={setSection}
        status={proxy.status}
        routeCount={proxy.routes.length}
        hasCfConfig={!!cloudflare.config?.has_token}
      />

      <div style={{
        flex: 1, minWidth: 0,
        overflow: 'auto',
        background: 'var(--bg)',
        position: 'relative',
      }}>
        {section === 'overview' && (
          <OverviewSection
            status={proxy.status}
            routes={proxy.routes}
            loading={proxy.loading}
            onNavigate={setSection}
          />
        )}
        {section === 'hosts' && (
          <ProxyHostsSection
            routes={proxy.routes}
            loading={proxy.loading}
            onAdd={proxy.addRoute}
            onRemove={proxy.removeRoute}
            onRefresh={proxy.refresh}
          />
        )}
        {section === 'ssl' && (
          <SslSection
            status={proxy.status}
            domain={proxy.domain}
            loading={proxy.loading}
            onSetDomain={proxy.configureDomain}
          />
        )}
        {section === 'dns' && (
          <DnsSection
            config={cloudflare.config}
            records={cloudflare.records}
            loading={cloudflare.loading}
            onSaveConfig={cloudflare.saveConfig}
            onRemoveConfig={cloudflare.removeConfig}
            onCreateRecord={cloudflare.createRecord}
            onUpdateRecord={cloudflare.updateRecord}
            onDeleteRecord={cloudflare.deleteRecord}
            onRefresh={cloudflare.refresh}
          />
        )}
        {section === 'subdomain' && (
          <SubdomainSection
            request={subdomain.request}
            loading={subdomain.loading}
            onRequest={subdomain.requestSubdomain}
            onRelease={subdomain.release}
            onCheck={subdomain.checkStatus}
          />
        )}
      </div>
    </div>
  );
}
