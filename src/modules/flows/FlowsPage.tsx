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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Workflow, CheckCircle2, Clock } from 'lucide-react';
import { useFlowsStore } from '@/stores/flows.store';
import { FlowCardGrid, FlowCardList, FlowCardBanner } from './components/FlowCard';
import { ViewModeToggle } from './components/ViewModeToggle';
import { TemplateGallery } from './components/TemplateGallery';
import { TemplateWizard } from './components/TemplateWizard';
import { RunHistory } from './components/RunHistory';
import { GlobalStats } from './components/GlobalStats';
import { toast } from 'sonner';

export function Component() {
  const navigate = useNavigate();
  const flows = useFlowsStore((s) => s.flows);
  const pendingRuns = useFlowsStore((s) => s.pendingRuns);
  const loading = useFlowsStore((s) => s.loading);
  const viewMode = useFlowsStore((s) => s.viewMode);
  const fetchFlows = useFlowsStore((s) => s.fetchFlows);
  const fetchPendingRuns = useFlowsStore((s) => s.fetchPendingRuns);
  const approveRun = useFlowsStore((s) => s.approveRun);
  const rejectRun = useFlowsStore((s) => s.rejectRun);

  const [tab, setTab] = useState<'flows' | 'templates' | 'history'>('flows');
  const [wizardTemplate, setWizardTemplate] = useState<any>(null);

  useEffect(() => {
    fetchFlows();
    fetchPendingRuns();
  }, [fetchFlows, fetchPendingRuns]);

  const activeFlows = flows.filter((f) => f.enabled && !f.is_template);
  const disabledFlows = flows.filter((f) => !f.enabled && !f.is_template);

  // Empty state
  if (!loading && flows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 40 }}>
        <Workflow size={48} style={{ color: 'var(--mod-flows)' }} />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Automate your daily tasks</h2>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', textAlign: 'center', maxWidth: 400, margin: 0 }}>
          Pick a template to get started, or create your own flow from scratch.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => setTab('templates')}
            style={{
              padding: '8px 16px', background: 'var(--mod-flows)', color: '#fff', border: 'none',
              borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Explore templates
          </button>
          <button
            onClick={() => navigate('/flows/new')}
            style={{
              padding: '8px 16px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Create from scratch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Workflow size={20} style={{ color: 'var(--mod-flows)' }} />
          Flows
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ViewModeToggle />
          <button
            onClick={() => navigate('/flows/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', background: 'var(--mod-flows)', color: '#fff', border: 'none',
              borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <Plus size={14} /> New flow
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
        {(['flows', 'templates', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--mod-flows)' : '2px solid transparent',
              color: tab === t ? 'var(--text)' : 'var(--text-dim)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              fontWeight: tab === t ? 500 : 400,
            }}
          >
            {t === 'flows' ? 'My Flows' : t === 'templates' ? 'Templates' : 'History'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {tab === 'flows' && (
          <>
            {/* Motivational stats */}
            <GlobalStats />

            {/* Pending approvals */}
            {pendingRuns.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Waiting for approval
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingRuns.map((run) => {
                    const flow = flows.find((f) => f.id === run.flow_id);
                    return (
                      <div key={run.id} style={{
                        background: 'var(--card)', border: '1px solid var(--amber)', borderRadius: 8,
                        padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                            {flow?.name ?? 'Flow'} — {run.approval_prompt ?? 'Needs approval'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                            {run.steps_completed}/{run.steps_total} steps completed
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => rejectRun(run.flow_id, run.id).then(() => toast.success('Rejected')).catch((e) => toast.error(e.message))}
                            style={{
                              padding: '4px 10px', background: 'none', border: '1px solid var(--border)',
                              borderRadius: 4, color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            }}
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => approveRun(run.flow_id, run.id).then(() => toast.success('Approved')).catch((e) => toast.error(e.message))}
                            style={{
                              padding: '4px 10px', background: 'var(--success)', border: 'none',
                              borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            }}
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active flows */}
            {activeFlows.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active ({activeFlows.length})
                </div>
                {viewMode === 'grid' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                    {activeFlows.map((f) => <FlowCardGrid key={f.id} flow={f} recentRuns={[]} />)}
                  </div>
                )}
                {viewMode === 'list' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {activeFlows.map((f) => <FlowCardList key={f.id} flow={f} recentRuns={[]} />)}
                  </div>
                )}
                {viewMode === 'banner' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activeFlows.map((f) => <FlowCardBanner key={f.id} flow={f} recentRuns={[]} />)}
                  </div>
                )}
              </div>
            )}

            {/* Disabled flows */}
            {disabledFlows.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Disabled ({disabledFlows.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {disabledFlows.map((f) => <FlowCardList key={f.id} flow={f} recentRuns={[]} />)}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'templates' && (
          <TemplateGallery onSelect={(t) => setWizardTemplate(t)} />
        )}

        {/* Template wizard modal */}
        {wizardTemplate && (
          <TemplateWizard
            template={wizardTemplate}
            onClose={() => { setWizardTemplate(null); fetchFlows(); }}
          />
        )}

        {tab === 'history' && (
          <RunHistory />
        )}
      </div>
    </div>
  );
}
