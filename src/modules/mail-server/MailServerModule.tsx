import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router';
import { ClawMailApiProvider } from './ClawMailApiProvider';
import { MailServerSidebar } from './MailServerSidebar';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Domains = lazy(() => import('./pages/Domains'));
const DomainDetail = lazy(() => import('./pages/DomainDetail'));
const Mailboxes = lazy(() => import('./pages/Mailboxes'));
const MailboxDetail = lazy(() => import('./pages/MailboxDetail'));
const Aliases = lazy(() => import('./pages/Aliases'));
const Relays = lazy(() => import('./pages/Relays'));
const Administrators = lazy(() => import('./pages/Administrators'));
const Broadcasts = lazy(() => import('./pages/Broadcasts'));
const ClientSetup = lazy(() => import('./pages/ClientSetup'));
const DnsHealth = lazy(() => import('./pages/DnsHealth'));
const Antispam = lazy(() => import('./pages/Antispam'));
const Antivirus = lazy(() => import('./pages/Antivirus'));
const Threats = lazy(() => import('./pages/Threats'));
const MonitoringOverview = lazy(() => import('./pages/MonitoringOverview'));
const MailQueue = lazy(() => import('./pages/MailQueue'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const SmtpRelay = lazy(() => import('./pages/SmtpRelay'));
const SmtpSettings = lazy(() => import('./pages/SmtpSettings'));

export function Component() {
  return (
    <ClawMailApiProvider>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <MailServerSidebar />
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', background: 'var(--bg)', position: 'relative' }}>
          <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-dim)' }}>Cargando...</div>}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="domains" element={<Domains />} />
              <Route path="domains/:domain" element={<DomainDetail />} />
              <Route path="mailboxes" element={<Mailboxes />} />
              <Route path="mailboxes/:email" element={<MailboxDetail />} />
              <Route path="aliases" element={<Aliases />} />
              <Route path="relays" element={<Relays />} />
              <Route path="administrators" element={<Administrators />} />
              <Route path="broadcasts" element={<Broadcasts />} />
              <Route path="client-setup" element={<ClientSetup />} />
              <Route path="dns" element={<DnsHealth />} />
              <Route path="security/antispam" element={<Antispam />} />
              <Route path="security/antivirus" element={<Antivirus />} />
              <Route path="security/threats" element={<Threats />} />
              <Route path="monitoring/overview" element={<MonitoringOverview />} />
              <Route path="monitoring/queue" element={<MailQueue />} />
              <Route path="monitoring/audit" element={<AuditLog />} />
              <Route path="delivery/relay" element={<SmtpRelay />} />
              <Route path="delivery/settings" element={<SmtpSettings />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </ClawMailApiProvider>
  );
}
