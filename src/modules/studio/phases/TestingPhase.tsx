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

// ─── Studio Phase 7 — Testing viewport ──────────────────────────────
//
// Two columns: live app preview (full size) + Studio Tester chat
// sidebar. Top toolbar with three actions:
//   ▶ Run all tests       — re-execute the entire auto suite
//   ⤺ Back to fix         — moves project back to Implementation
//   ✓ Sign off → Package  — moves project to Packaging
//
// The user interacts with the iframe to actually USE the app; the
// Tester is for advice and diagnoses; Run all tests is the only
// authoritative pass/fail signal.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FlaskConical, Play, ArrowLeft, CheckCircle2, Loader2, AlertTriangle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioProject, type StudioProjectStatus, type StudioTestResults } from '@/stores/studio.store';
import { useAuthStore } from '@/stores/auth.store';
import { useUiModulesStore } from '@/stores/ui-modules.store';
import { resolveInstalledModule } from '../lib/installedApp';
import { TesterChat } from '../components/TesterChat';
import { PhaseSidebar } from '../components/PhaseSidebar';
import { useStudioMode } from '../hooks/useStudioMode';

interface Props {
  project: StudioProject;
  viewMode?: 'edit' | 'past';
  onSelectPhase?: (phase: StudioProjectStatus) => void;
}

export function TestingPhase({ project, viewMode = 'edit', onSelectPhase }: Props) {
  const isPast = viewMode === 'past';
  const runAutoTestsForProject = useStudioStore((s) => s.runAutoTestsForProject);
  const backToBuild = useStudioStore((s) => s.backToBuild);
  const signOffTesting = useStudioStore((s) => s.signOffTesting);
  const navigate = useNavigate();
  const [studioMode] = useStudioMode();
  const guided = studioMode === 'guided';

  const [busy, setBusy] = useState<'tests' | 'back' | 'signoff' | null>(null);
  const [results, setResults] = useState<StudioTestResults | null>(
    (project.test_results as StudioTestResults | null) ?? null,
  );
  const [confirmSignoff, setConfirmSignoff] = useState(false);

  // Iframe URL with token (same pattern as ImplementationPhase preview)
  const baseUrl = import.meta.env.VITE_API_URL ?? '';
  const token = useAuthStore.getState().tokens?.accessToken ?? '';
  const sandboxPreviewUrl = `${baseUrl}/api/v1/studio/projects/${project.id}/ui-preview${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  // For a PUBLISHED app, the real running app exists (installed L3 module) and
  // its API works — the build-time sandbox API does NOT (its schema is gone
  // after packaging → the preview renders "[object Object]"). So when the app
  // is published, point the preview at the REAL installed app (same /app-ui
  // route the dash module uses). Match the module by the clean name (the
  // project slug is the raw scoping text, so we can't read it off the project).
  const uiModules = useUiModulesStore((s) => s.modules);
  const appModule = project.status === 'published'
    ? resolveInstalledModule(project, uiModules)
    : undefined;
  const previewUrl = appModule
    ? `${baseUrl}/api/v1/app-ui/${appModule.app_name}/${token ? `?token=${encodeURIComponent(token)}` : ''}`
    : sandboxPreviewUrl;
  // v2/v3 builds write the UI to the WORKSPACE filesystem, NEVER to the legacy
  // `generated_files` JSONB column — so gating on that column wrongly shows "no
  // UI" for every real (built) project. The reliable signal is the phase: once
  // the project reached Build, the workspace has `ui/` and the preview endpoint
  // (which reads the workspace) renders it. (If it's somehow empty, the endpoint
  // itself returns an error page — never a false "no files" from the dash.)
  const BUILT_PHASES = ['build', 'testing', 'packaging', 'packaged', 'published'];
  const hasUiFiles = BUILT_PHASES.includes(project.status)
    || ((project.generated_files ?? []) as Array<{ path: string }>).some((f) => f.path.startsWith('ui/'));

  async function handleRunTests() {
    if (busy) return;
    setBusy('tests');
    try {
      const r = await runAutoTestsForProject(project.id);
      setResults(r);
      if (r.failed === 0) {
        toast.success(`✓ ${r.total} tests pasan`);
      } else {
        toast.error(`${r.failed}/${r.total} tests fallan`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo correr los tests');
    } finally {
      setBusy(null);
    }
  }

  async function handleBack() {
    if (busy) return;
    setBusy('back');
    try {
      await backToBuild(project.id);
      // Land on the Build chat — that's where the user describes
      // bugs and the agent iterates. The Builder already has the
      // latest Tester findings in its context.
      navigate(`/studio/${project.id}?tab=chat`, { replace: true });
      toast('Vuelto a Build — describe los bugs en el chat');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo volver');
    } finally {
      setBusy(null);
    }
  }

  async function handleSignOff() {
    if (busy) return;
    setBusy('signoff');
    try {
      await signOffTesting(project.id);
      toast.success('Firmado — pasamos a Packaging');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo firmar');
    } finally {
      setBusy(null);
      setConfirmSignoff(false);
    }
  }

  const failingTests = results && results.failed > 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={toolbarStyle}>
        <h2 style={titleStyle}><FlaskConical size={14} style={{ color: 'var(--amber)' }} /> {guided ? 'Try it yourself' : 'Testing'}</h2>

        {/* Test results summary */}
        {results && (
          <span style={resultsBadge(failingTests ?? false)}>
            {failingTests ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
            {guided ? `${results.passed} de ${results.total} comprobaciones OK` : `${results.passed} / ${results.total} passing`}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {!isPast && (
          <>
            <button
              type="button"
              onClick={handleRunTests}
              disabled={busy !== null}
              style={secondaryBtn(busy === 'tests')}
            >
              {busy === 'tests' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {guided ? 'Comprobar que funciona' : 'Run all tests'}
            </button>
            <button
              type="button"
              onClick={handleBack}
              disabled={busy !== null}
              style={secondaryBtn(busy === 'back')}
            >
              {busy === 'back' ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeft size={12} />}
              {guided ? 'Esto no va bien' : 'Back to fix'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmSignoff(true)}
              disabled={busy !== null}
              style={primaryBtn(busy === 'signoff')}
            >
              {busy === 'signoff' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              {guided ? 'All good · Install' : 'Sign off → Package'}
            </button>
          </>
        )}
      </div>

      {/* Sandbox reassurance (§3.7): it's a test, nothing is sent for real */}
      {guided && !isPast && (
        <div style={sandboxBanner}>
          <span aria-hidden>🟢</span>
          Es una <strong>prueba</strong>: haz como si fueras tu clienta. Nada se envía a nadie de verdad.
        </div>
      )}

      <PhaseSidebar project={project} viewedPhase="testing" onSelect={onSelectPhase} guided={guided} />

      {/* Main: iframe + chat sidebar */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 380px',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', overflow: 'hidden', background: '#fff' }}>
          {hasUiFiles ? (
            <iframe
              title="testing-preview"
              src={previewUrl}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            />
          ) : (
            <div style={emptyPreviewStyle}>
              <Eye size={28} style={{ color: 'var(--amber)', marginBottom: 12 }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text)', marginBottom: 6 }}>
                {guided ? 'Your app doesn\'t have any screens yet' : 'No UI files yet'}
              </div>
              <div>{guided
                ? 'Press "This isn\'t right" to go back and ask me to add a screen.'
                : <>Go back to Implementation and run at least one session that produces files under <code>ui/</code>.</>}</div>
            </div>
          )}
        </div>
        <TesterChat projectId={project.id} />
      </div>

      {/* Sign-off confirmation modal */}
      {confirmSignoff && (
        <div style={modalBackdrop} onClick={() => !busy && setConfirmSignoff(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
              {guided ? 'Is your app ready?' : 'Sign off and move to Packaging?'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              {guided
                ? 'I\'ll get it ready to install. If you spot something later, you can always go back.'
                : 'The app moves to the packaging phase. You can go back later if you find issues.'}
            </p>
            {failingTests && (
              <div style={warningBox}>
                <AlertTriangle size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
                  <strong>{results!.failed}</strong> test{results!.failed === 1 ? '' : 's'} failing.
                  You can sign off anyway, but it\'s better to fix it first.
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setConfirmSignoff(false)}
                disabled={busy !== null}
                style={secondaryBtn(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSignOff}
                disabled={busy !== null}
                style={primaryBtn(busy === 'signoff')}
              >
                {busy === 'signoff' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                {guided ? 'Yes, it\'s ready' : 'Yes, sign off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = {
  padding: '12px 24px', borderBottom: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
};
const titleStyle: React.CSSProperties = {
  fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text)',
  display: 'flex', alignItems: 'center', gap: 8,
};
const primaryBtn = (busy: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px',
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontSize: '0.75rem', fontWeight: 600,
  cursor: busy ? 'wait' : 'pointer',
  fontFamily: 'var(--font-sans)',
});
const secondaryBtn = (busy: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px',
  background: 'transparent', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontSize: '0.75rem',
  cursor: busy ? 'wait' : 'pointer',
  fontFamily: 'var(--font-sans)',
});
const resultsBadge = (failing: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px',
  background: failing
    ? 'color-mix(in srgb, var(--danger) 8%, var(--surface))'
    : 'color-mix(in srgb, #22c55e 8%, var(--surface))',
  color: failing ? 'var(--danger)' : '#22c55e',
  border: `1px solid ${failing ? 'color-mix(in srgb, var(--danger) 30%, var(--border))' : 'color-mix(in srgb, #22c55e 30%, var(--border))'}`,
  borderRadius: 'var(--radius-full)',
  fontSize: '0.6875rem', fontWeight: 600,
});
const sandboxBanner: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
  padding: '8px 24px', fontSize: '0.78rem', color: 'var(--text)',
  background: 'color-mix(in srgb, #22c55e 8%, var(--card))',
  borderBottom: '1px solid color-mix(in srgb, #22c55e 25%, var(--border))',
  fontFamily: 'var(--font-sans)',
};
const emptyPreviewStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  height: '100%', padding: 32, textAlign: 'center',
  color: 'var(--text-dim)', fontSize: '0.8125rem', lineHeight: 1.6,
};
const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modalStyle: React.CSSProperties = {
  width: 480, maxWidth: '90vw',
  padding: 20,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};
const warningBox: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  padding: 12,
  background: 'color-mix(in srgb, var(--amber) 8%, var(--surface))',
  border: '1px solid color-mix(in srgb, var(--amber) 30%, var(--border))',
  borderRadius: 'var(--radius-sm)',
};
