/** Unified security control plane at /settings/security. */

import { useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  Bot,
  Boxes,
  ClipboardCheck,
  FileClock,
  Globe2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { ApprovalInbox } from '@/modules/approvals/ApprovalInbox';
import { SandboxSection } from './SandboxSection';
import { AgentExecutionPanel } from './security/AgentExecutionPanel';
import { ApprovalDeliveryPanel } from './security/ApprovalDeliveryPanel';
import { BrowserSafetyPanel } from './security/BrowserSafetyPanel';
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
  { id: 'overview', label: 'General', description: 'Security status and global limits', icon: ShieldCheck },
  { id: 'agent-execution', label: 'Agent security', description: 'Agent settings and shared command profiles', icon: Bot },
  { id: 'tool-policy', label: 'Tools & permissions', description: 'Tool access, consent and chat display', icon: ShieldCheck },
  { id: 'protected-actions', label: 'Protections', description: 'Your PIN and required confirmations', icon: LockKeyhole },
  { id: 'isolation', label: 'Global isolation', description: 'Defaults inherited by agents', icon: Boxes },
  { id: 'action-approvals', label: 'Approvals', description: 'Requests, reminders and delivery', icon: ClipboardCheck },
  { id: 'browser-safety', label: 'Browser safety', description: 'Network and session boundaries', icon: Globe2 },
  { id: 'audit-log', label: 'Security changes', description: 'History of policy and configuration changes', icon: FileClock },
];

export type SecurityPage = Exclude<SecurityTab, 'command-profiles' | 'approval-delivery'>;
const TAB_IDS = new Set<SecurityTab>([...SECURITY_TABS.map((tab) => tab.id), 'command-profiles', 'approval-delivery']);

function isSecurityTab(value: string | null): value is SecurityTab {
  return value !== null && TAB_IDS.has(value as SecurityTab);
}

/** Old deep links address blocks without creating another page or editor instance. */
export function resolveSecurityDestination(value: string | null): { page: SecurityPage; target?: string } {
  const tab = isSecurityTab(value) ? value : 'overview';
  if (tab === 'command-profiles') return { page: 'agent-execution', target: 'security-command-profiles' };
  if (tab === 'approval-delivery') return { page: 'action-approvals', target: 'security-approval-delivery' };
  if (tab === 'agent-execution') return { page: tab, target: 'security-agent-settings' };
  if (tab === 'action-approvals') return { page: tab, target: 'security-approval-requests' };
  return { page: tab };
}

/** Sidebar selection follows the page even when a link addresses one of its blocks. */
export function normalizeSecuritySettingsTarget(target: string): string {
  const [pathname, query = ''] = target.split('?');
  if (pathname !== '/settings/security') return target;
  const { page } = resolveSecurityDestination(new URLSearchParams(query).get('security_tab'));
  return page === 'overview' ? '/settings/security' : `/settings/security?security_tab=${page}`;
}

function IsolationPanel() {
  return (
    <div className="space-y-4">
      <div><h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><Boxes size={19} className="text-[var(--amber)]" />Global isolation</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">Defaults inherited by agents. Adjust an individual agent in Agent security or Agent → Security.</p></div>
      <SandboxSection />
    </div>
  );
}

function ActionApprovalsPanel() {
  return (
    <div className="space-y-8">
      <header><h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-[var(--text)]"><ClipboardCheck size={19} className="text-[var(--amber)]" />Approvals</h2><p className="mt-1 max-w-3xl text-sm text-[var(--text-dim)]">Review requests and choose how their notifications reach you.</p></header>
      <section aria-labelledby="security-approval-requests">
        <h3 id="security-approval-requests" tabIndex={-1} className="mb-3 scroll-mt-4 text-base font-semibold text-[var(--text)]">Requests</h3>
        <ApprovalInbox embedded />
      </section>
      <section aria-labelledby="security-approval-delivery" className="border-t border-[var(--border)] pt-6">
        <h3 id="security-approval-delivery" tabIndex={-1} className="mb-3 scroll-mt-4 text-base font-semibold text-[var(--text)]">Reminders & delivery</h3>
        <ApprovalDeliveryPanel embedded />
      </section>
    </div>
  );
}

function TabContent({ tab }: { tab: SecurityPage }) {
  if (tab === 'overview') return <SecurityOverviewPanel />;
  if (tab === 'agent-execution') return <AgentExecutionPanel />;
  if (tab === 'protected-actions') return <ProtectedActionsPanel />;
  if (tab === 'tool-policy') return <ToolPolicyPanel />;
  if (tab === 'action-approvals') return <ActionApprovalsPanel />;
  if (tab === 'isolation') return <IsolationPanel />;
  if (tab === 'audit-log') return <SecurityAuditPanel />;
  return <BrowserSafetyPanel />;
}

export function SecuritySection() {
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('security_tab');
  const { page: activeTab, target } = resolveSecurityDestination(requested);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!target || !content) return;
    const heading = document.getElementById(target);
    if (!heading) return;

    let stopped = false;
    let alignmentFrame = 0;
    let settledFrame = 0;
    const interactionEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(alignmentFrame);
      cancelAnimationFrame(settledFrame);
      resize.disconnect();
      mutations.disconnect();
      for (const event of interactionEvents) document.removeEventListener(event, stop, true);
      document.removeEventListener('focusin', focusChanged, true);
    };
    const focusChanged = () => { if (document.activeElement !== heading) stop(); };
    const loading = () => content.matches('[aria-busy="true"]') || !!content.querySelector('[aria-busy="true"]');
    const scheduleAlignment = () => {
      if (stopped) return;
      cancelAnimationFrame(settledFrame);
      if (alignmentFrame) return;
      alignmentFrame = requestAnimationFrame(() => {
        alignmentFrame = 0;
        if (stopped || document.activeElement !== heading) { stop(); return; }
        heading.scrollIntoView({ block: 'start' });
        // Only follow the initial load and its layout. Polling or later edits must
        // never keep dragging a reader back to a deep-linked block.
        if (!loading()) settledFrame = requestAnimationFrame(() => {
          settledFrame = 0;
          if (loading()) scheduleAlignment();
          else if (!alignmentFrame) stop();
        });
      });
    };
    const resize = new ResizeObserver(scheduleAlignment);
    const mutations = new MutationObserver(scheduleAlignment);
    heading.focus({ preventScroll: true });
    resize.observe(content);
    mutations.observe(content, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy'] });
    for (const event of interactionEvents) document.addEventListener(event, stop, { capture: true, passive: true });
    document.addEventListener('focusin', focusChanged, true);
    scheduleAlignment();
    return stop;
  }, [activeTab, target]);

  return (
    <div className="min-w-0 font-[var(--font-sans)]">
      <header className="mb-5">
        <h1 className="m-0 flex items-center gap-2 text-xl font-semibold text-[var(--text)]"><ShieldCheck size={22} className="text-[var(--amber)]" />Security</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">Manage agent permissions, global protections and requests for approval.</p>
      </header>

      <main ref={contentRef} id={`security-panel-${activeTab}`} className="min-w-0" aria-live="polite">
        <TabContent tab={activeTab} />
      </main>
    </div>
  );
}
