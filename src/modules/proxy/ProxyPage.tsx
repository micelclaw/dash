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

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useProxyStatus } from './hooks/use-proxy-status';
import { useProxyHosts } from './hooks/use-proxy-hosts';
import { api } from '@/services/api';
import { ProxySidebar, type ProxySection } from './ProxySidebar';
import { DashboardSection } from './sections/DashboardSection';
import { ProxyHostsSection } from './sections/ProxyHostsSection';
import { RedirectsSection } from './sections/RedirectsSection';
import { NotFoundHostsSection } from './sections/NotFoundHostsSection';
import { StreamsSection } from './sections/StreamsSection';
import { CertificatesSection } from './sections/CertificatesSection';
import { AccessListsSection } from './sections/AccessListsSection';
import { AuditLogSection } from './sections/AuditLogSection';
import { ProxySettingsSection } from './sections/ProxySettingsSection';

export function Component() {
  const proxyStatus = useProxyStatus();
  const allHosts = useProxyHosts();
  const [section, setSection] = useState<ProxySection>('overview');

  // Aterrizaje del chip `proxy_host` del chat: /proxy?host=<uuid>.
  //
  // Sin esto el chip llevaba al panel general y el usuario tenía que buscar su
  // host a mano entre los 21 que hay — o sea, la mitad del valor del chip. Se
  // resuelve el tipo de host para abrir la sección correcta (una redirección no
  // vive en la misma pestaña que un proxy) y se limpia el parámetro para que un
  // F5 no reabra el editor.
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusHostId, setFocusHostId] = useState<string | null>(null);
  useEffect(() => {
    const wanted = searchParams.get('host');
    if (!wanted || allHosts.loading) return;
    const h = allHosts.hosts.find((x) => x.id === wanted);
    if (h) {
      setSection(h.host_type === 'redirect' ? 'redirects' : h.host_type === '404_host' ? '404_hosts' : 'hosts');
      setFocusHostId(h.id);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('host');
    setSearchParams(next, { replace: true });
  }, [searchParams, allHosts.loading, allHosts.hosts, setSearchParams]);

  const hostCounts = useMemo(() => ({
    proxy: allHosts.hosts.filter(h => h.host_type === 'proxy').length,
    redirect: allHosts.hosts.filter(h => h.host_type === 'redirect').length,
    notfound: allHosts.hosts.filter(h => h.host_type === '404_host').length,
  }), [allHosts.hosts]);

  // Lightweight counts for sidebar badges
  const [certCount, setCertCount] = useState(0);
  const [aclCount, setAclCount] = useState(0);
  useEffect(() => {
    api.get<{ data: unknown[] }>('/hal/network/proxy/certificates').then(r => setCertCount(r.data.length)).catch(() => {});
    api.get<{ data: unknown[] }>('/hal/network/proxy/access-lists').then(r => setAclCount(r.data.length)).catch(() => {});
  }, []);

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
        status={proxyStatus.status}
        hostCounts={hostCounts}
        certCount={certCount}
        aclCount={aclCount}
      />

      <div style={{
        flex: 1, minWidth: 0,
        overflow: 'auto',
        background: 'var(--bg)',
        position: 'relative',
      }}>
        {section === 'overview' && (
          <DashboardSection
            status={proxyStatus.status}
            hosts={allHosts.hosts}
            loading={proxyStatus.loading || allHosts.loading}
            actionInProgress={proxyStatus.actionInProgress}
            processLog={proxyStatus.processLog}
            onClearLog={proxyStatus.clearProcessLog}
            onNavigate={setSection}
            onStart={proxyStatus.start}
            onStop={proxyStatus.stop}
            onSync={allHosts.sync}
          />
        )}
        {section === 'hosts' && (
          <ProxyHostsSection
          focusHostId={focusHostId}
          onFocusHandled={() => setFocusHostId(null)}
            hosts={allHosts.hosts.filter(h => h.host_type === 'proxy')}
            loading={allHosts.loading}
            onCreate={allHosts.createHost}
            onUpdate={allHosts.updateHost}
            onDelete={allHosts.deleteHost}
            onToggle={allHosts.toggleHost}
            onTest={allHosts.testHost}
            onRefresh={allHosts.refresh}
          />
        )}
        {section === 'redirects' && (
          <RedirectsSection
            hosts={allHosts.hosts.filter(h => h.host_type === 'redirect')}
            loading={allHosts.loading}
            onCreate={allHosts.createHost}
            onDelete={allHosts.deleteHost}
            onToggle={allHosts.toggleHost}
            onRefresh={allHosts.refresh}
          />
        )}
        {section === 'streams' && <StreamsSection />}
        {section === '404_hosts' && (
          <NotFoundHostsSection
            hosts={allHosts.hosts.filter(h => h.host_type === '404_host')}
            loading={allHosts.loading}
            onCreate={allHosts.createHost}
            onDelete={allHosts.deleteHost}
            onToggle={allHosts.toggleHost}
            onRefresh={allHosts.refresh}
          />
        )}
        {section === 'certificates' && <CertificatesSection />}
        {section === 'access_lists' && <AccessListsSection />}
        {section === 'audit_log' && <AuditLogSection />}
        {section === 'settings' && <ProxySettingsSection />}
      </div>
    </div>
  );
}
