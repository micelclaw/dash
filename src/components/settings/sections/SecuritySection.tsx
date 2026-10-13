/** Unified security control plane at /settings/security. */

import type { LucideIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  BellRing,
  Bot,
  Boxes,
  ClipboardCheck,
  FileClock,
  Globe2,
  Layers3,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { ApprovalInbox } from '@/modules/approvals/ApprovalInbox';
import { SandboxSection } from './SandboxSection';
import { AgentExecutionPanel } from './security/AgentExecutionPanel';
import { ApprovalDeliveryPanel } from './security/ApprovalDeliveryPanel';
import { BrowserSafetyPanel } from './security/BrowserSafetyPanel';
import { CommandProfilesPanel } from './security/CommandProfilesPanel';
import { ProtectedActionsPanel } from './security/ProtectedActionsPanel';
import { SecurityAuditPanel } from './security/SecurityAuditPanel';
import { SecurityOverviewPanel } from './security/SecurityOverviewPanel';
import { ToolPolicyPanel } from './security/ToolPolicyPanel';

export type SecurityTab =
  | 'overview'
  | 'agent-execution'
  | 'command-profiles'
  | 'protected-actions'
  | 'action-approvals'
  | 'isolation'
  | 'approval-delivery'
  | 'audit-log'
  | 'browser-safety'
  | 'tool-policy';

interface TabDefinition {
  id: SecurityTab;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SECURITY_TABS: TabDefinition[] = [
  { id: 'overview', label: 'Overview', description: 'Posture and reconciliation', icon: ShieldCheck },
  { id: 'agent-execution', label: 'Agent execution', description: 'Desired and effective policy', icon: Bot },
  { id: 'command-profiles', label: 'Command profiles', description: 'Versioned command rules', icon: Layers3 },
  { id: 'protected-actions', label: 'Protected actions', description: 'Platform security floors', icon: LockKeyhole },
  { id: 'tool-policy', label: 'Tools & approvals', description: 'Access, chat display and approval gates', icon: ShieldCheck },
  { id: 'action-approvals', label: 'Action approvals', description: 'Inbox and decisions', icon: ClipboardCheck },
  { id: 'isolation', label: 'Isolation', description: 'Sandbox and workspace access', icon: Boxes },
  { id: 'approval-delivery', label: 'Approval delivery', description: 'Timing and forwarding', icon: BellRing },
  { id: 'audit-log', label: 'Audit log', description: 'Append-only policy events', icon: FileClock },
  { id: 'browser-safety', label: 'Browser safety', description: 'Network and session boundaries', icon: Globe2 },
];

const TAB_IDS = new Set<SecurityTab>(SECURITY_TABS.map((tab) => tab.id));

function isSecurityTab(value: string | null): value is SecurityTab {
  return value !== null && TAB_IDS.has(value as SecurityTab);
}

function IsolationPanel() {
  return (
    <div className="space-y-4">
      <div><h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><Boxes size={19} className="text-[var(--amber)]" />Isolation</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">Global container defaults. Per-agent sandbox overrides live in Agent execution and Agent → Security.</p></div>
      <SandboxSection />
    </div>
  );
}

function ActionApprovalsPanel() {
  return (
    <div>
      <div className="mb-4"><h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><ClipboardCheck size={19} className="text-[var(--amber)]" />Action approvals</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">One inbox across Core actions, host commands, runtime-native requests and external authorities.</p></div>
      <ApprovalInbox embedded />
    </div>
  );
}

function TabContent({ tab }: { tab: SecurityTab }) {
  if (tab === 'overview') return <SecurityOverviewPanel />;
  if (tab === 'agent-execution') return <AgentExecutionPanel />;
  if (tab === 'command-profiles') return <CommandProfilesPanel />;
  if (tab === 'protected-actions') return <ProtectedActionsPanel />;
  if (tab === 'tool-policy') return <ToolPolicyPanel />;
  if (tab === 'action-approvals') return <ActionApprovalsPanel />;
  if (tab === 'isolation') return <IsolationPanel />;
  if (tab === 'approval-delivery') return <ApprovalDeliveryPanel />;
  if (tab === 'audit-log') return <SecurityAuditPanel />;
  return <BrowserSafetyPanel />;
}

export function SecuritySection() {
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('security_tab');
  const activeTab: SecurityTab = isSecurityTab(requested) ? requested : 'overview';

  return (
    <div className="min-w-0 font-[var(--font-sans)]">
      <header className="mb-5">
        <h1 className="m-0 flex items-center gap-2 text-xl font-semibold text-[var(--text)]"><ShieldCheck size={22} className="text-[var(--amber)]" />Security</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">Configure durable policy in Core, inspect what the runtime actually enforces and resolve actions without conflating model choice with execution authority.</p>
      </header>

      <main id={`security-panel-${activeTab}`} className="min-w-0" aria-live="polite">
        <TabContent tab={activeTab} />
      </main>
    </div>
  );
}
