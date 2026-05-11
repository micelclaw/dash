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
import { TesterChat } from '../components/TesterChat';
import { PhaseSidebar } from '../components/PhaseSidebar';

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

  const [busy, setBusy] = useState<'tests' | 'back' | 'signoff' | null>(null);
  const [results, setResults] = useState<StudioTestResults | null>(
    (project.test_results as StudioTestResults | null) ?? null,
  );
  const [confirmSignoff, setConfirmSignoff] = useState(false);

  // Iframe URL with token (same pattern as ImplementationPhase preview)
  const baseUrl = import.meta.env.VITE_API_URL ?? '';
  const token = useAuthStore.getState().tokens?.accessToken ?? '';
  const previewUrl = `${baseUrl}/api/v1/studio/projects/${project.id}/ui-preview${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const hasUiFiles = ((project.generated_files ?? []) as Array<{ path: string }>).some(
    (f) => f.path.startsWith('ui/'),
  );

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
        <h2 style={titleStyle}><FlaskConical size={14} style={{ color: 'var(--amber)' }} /> Testing</h2>

        {/* Test results summary */}
        {results && (
          <span style={resultsBadge(failingTests ?? false)}>
            {failingTests ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
            {results.passed} / {results.total} passing
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
              Run all tests
            </button>
            <button
              type="button"
              onClick={handleBack}
              disabled={busy !== null}
              style={secondaryBtn(busy === 'back')}
            >
              {busy === 'back' ? <Loader2 size={12} className="animate-spin" /> : <ArrowLeft size={12} />}
              Back to fix
            </button>
            <button
              type="button"
              onClick={() => setConfirmSignoff(true)}
              disabled={busy !== null}
              style={primaryBtn(busy === 'signoff')}
            >
              {busy === 'signoff' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Sign off → Package
            </button>
          </>
        )}
      </div>

      <PhaseSidebar project={project} viewedPhase="testing" onSelect={onSelectPhase} />

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
                No hay archivos UI todavía
              </div>
              <div>Vuelve a Implementation y genera al menos una sesión que produzca archivos en <code>ui/</code>.</div>
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
              ¿Firmar y pasar a Packaging?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
              La app se moverá a la fase de empaquetado. Podrás volver atrás más tarde si descubres problemas.
            </p>
            {failingTests && (
              <div style={warningBox}>
                <AlertTriangle size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
                  Hay <strong>{results!.failed}</strong> test{results!.failed === 1 ? '' : 's'} fallando.
                  Puedes firmar igualmente, pero se recomienda arreglarlo antes.
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
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSignOff}
                disabled={busy !== null}
                style={primaryBtn(busy === 'signoff')}
              >
                {busy === 'signoff' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Sí, firmar
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
