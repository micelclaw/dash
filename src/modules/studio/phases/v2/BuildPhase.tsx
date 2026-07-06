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

// ─── Studio v2 — BuildPhase ────────────────────────────────────────
//
// Two-column layout: workspace + activity feed (left) and chat (right).
// Header strip on top with status, counters and action buttons. Live
// state comes from useOpencodeStream (WS-driven) and project row.
// First-time entry posts /build/start automatically and shows the
// stream as it grows. Checklist UI / preview iframe / checkpoints /
// caps live in their own milestones (M6/M7/M8).

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, AlertCircle, Plug, Package } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useStudioStore, type StudioProject, type StudioProjectStatus, type StudioMountedRoute } from '@/stores/studio.store';
import { PhaseSidebar } from '../../components/PhaseSidebar';
import { CodeView } from '../../components/CodeView';
import { BuildHeaderStrip } from '../../components/v2/BuildHeaderStrip';
import { BuildSettingsPanel } from '../../components/v2/BuildSettingsPanel';
import { BuildChecklist } from '../../components/v2/BuildChecklist';
import { WorkspaceFileTree } from '../../components/v2/WorkspaceFileTree';
import { ActivityFeed } from '../../components/v2/ActivityFeed';
import { BuildChat } from '../../components/v2/BuildChat';
import { OpencodeEmbed } from '../../components/v2/OpencodeEmbed';
import { GuidedBuildPanel } from '../../components/v2/GuidedBuildPanel';
import { FriendlyError } from '../../components/v2/FriendlyError';
import { PlanApprovalBanner } from '../../components/v2/PlanApprovalBanner';
import { ConnectExternalEngineModal } from '../../components/v2/ConnectExternalEngineModal';
import { ResizeHandle } from '../../components/v2/ResizeHandle';
import { useOpencodeStream } from '../../hooks/useOpencodeStream';
import { useConfirm } from '../../lib/useConfirm';
import { useStudioMode } from '../../hooks/useStudioMode';
import { useStudioEngines } from '../../hooks/useStudioEngines';
import { PanelGroup, Panel } from 'react-resizable-panels';

interface Props {
  project: StudioProject;
  viewMode?: 'edit' | 'past';
  onSelectPhase?: (phase: StudioProjectStatus) => void;
}


export function BuildPhase({ project, viewMode = 'edit', onSelectPhase }: Props) {
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirm();
  const startBuild = useStudioStore((s) => s.startBuild);
  const finishBuild = useStudioStore((s) => s.finishBuild);
  const fetchWorkspaceFile = useStudioStore((s) => s.fetchWorkspaceFile);
  const fetchSandboxRoutes = useStudioStore((s) => s.fetchSandboxRoutes);

  const stream = useOpencodeStream(project.id, project.status === 'build' ? 'idle' : 'idle');

  // Guided/Pro lens for the WHOLE build screen (D5 progressive disclosure).
  // Owned here so it governs both the left technical pane and the embed.
  const [studioMode, setStudioMode] = useStudioMode();
  const guided = studioMode === 'guided';

  // Live engine readiness — powers the proactive degradation banner when
  // this project's ACP engine stopped being ready (key removed, acpx off).
  const { engines } = useStudioEngines();
  const engineInfo = engines.find((e) => e.id === project.engine);
  const engineDegraded = (project.engine === 'acp_claude' || project.engine === 'acp_codex')
    && !!engineInfo && !engineInfo.ready;

  const [tab, setTab] = useState<'code' | 'api'>('code');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<{ path: string; content: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [routes, setRoutes] = useState<StudioMountedRoute[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // True iff we know there is (or has been) an active OpenCode session
  // for this project — derived from real signals, NOT from project.status
  // (which is set to 'build' by approveFoundation BEFORE any session
  // exists). Without this distinction we never auto-start.
  const isStarted = stream.messages.length > 0 || stream.status === 'running';
  const isPast = viewMode === 'past';

  // Tracks the latest file_edit timestamp so the file tree refetches
  // on every edit. Using `.length` was buggy: re-edits to the SAME path
  // dedupe and don't change length, so the agent rewriting db.mjs
  // multiple times went unseen. Timestamp always changes.
  const refreshKey = stream.recentEdits.length > 0
    ? stream.recentEdits[stream.recentEdits.length - 1]!.ts
    : 0;

  // ─── Auto-record startedAt the first time we observe activity ───
  useEffect(() => {
    if (startedAt) return;
    if (stream.messages.length > 0) setStartedAt(Date.now());
  }, [stream.messages.length, startedAt]);

  // ─── Fetch the selected file's content when it changes ─────────
  useEffect(() => {
    if (!selectedFile) { setFileContent(null); return; }
    let cancelled = false;
    setFileLoading(true);
    setFileError(null);
    void (async () => {
      try {
        const f = await fetchWorkspaceFile(project.id, selectedFile);
        if (!cancelled) setFileContent({ path: f.path, content: f.content });
      } catch (err) {
        if (!cancelled) setFileError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setFileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedFile, project.id, fetchWorkspaceFile]);

  // ─── Refetch the selected file when a file_edit hits its path ──
  useEffect(() => {
    if (!selectedFile) return;
    const hit = stream.recentEdits.find((e) => e.path.endsWith(selectedFile));
    if (!hit) return;
    void (async () => {
      try {
        const f = await fetchWorkspaceFile(project.id, selectedFile);
        setFileContent({ path: f.path, content: f.content });
      } catch { /* swallow */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // ─── Pull mounted routes when API tab opens ────────────────────
  useEffect(() => {
    if (tab !== 'api') return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetchSandboxRoutes(project.id);
        if (!cancelled) setRoutes(r);
      } catch { /* swallow */ }
    })();
    return () => { cancelled = true; };
  }, [tab, project.id, fetchSandboxRoutes, refreshKey]);

  // ─── Build session lifecycle ──────────────────────────────────
  // The user enters Build via "approve foundation" which transitions
  // status='foundation' → 'build' on the BACKEND. When they land here,
  // we automatically POST /build/start: the backend materializes the
  // workspace, generates the checklist, creates the OC session and
  // sends BUILDER_WELCOME_PROMPT. The agent kicks off without needing
  // the user to type anything. The auto-start effect below decides
  // when to fire it — once the hook has hydrated and confirmed there
  // is no existing session.

  const handleStart = useCallback(async (opts?: { silent?: boolean }) => {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      await startBuild(project.id);
      setStartedAt(Date.now());
      if (!opts?.silent) {
        toast.success('Plan turn started — the Builder is reading specs and writing the plan.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Race: another tab / a previous mount already started the
      // session. The other path is the source of truth — treat as
      // success, the hook will hydrate from /build/messages.
      if (/BUILD_BUSY/i.test(msg)) {
        return;
      }
      setStartError(msg);
      if (!opts?.silent) {
        toast.error(`Failed to start build: ${msg}`);
      }
    } finally {
      setStarting(false);
    }
  }, [project.id, startBuild, starting]);

  // ─── No auto-start ────────────────────────────────────────────
  // The user explicitly asked NOT to fire the LLM on phase entry —
  // they want to see the upcoming prompt + a Start button first. The
  // PreBuildPanel inside BuildChat renders the explanation + CTA, and
  // clicking Start calls `handleStart` directly.

  const handleFinish = useCallback(async (force: boolean) => {
    if (finishing) return;
    setFinishing(true);
    try {
      await finishBuild(project.id, force);
      toast.success('Build finished — moving to Testing');
      onSelectPhase?.('testing');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 409 CHECKLIST_INCOMPLETE → ask the user to confirm with force.
      if (/CHECKLIST_INCOMPLETE/i.test(msg)) {
        const ok = await confirm({
          title: 'The checklist isn\'t complete',
          body: 'Move to Testing anyway? Some acceptance items are still pending.',
          confirmLabel: 'Move to Testing',
        });
        if (ok) {
          setFinishing(false);
          return handleFinish(true);
        }
      } else {
        toast.error(`Finish failed: ${msg}`);
      }
    } finally {
      setFinishing(false);
    }
  }, [project.id, finishBuild, finishing, onSelectPhase]);

  // ─── Render ───────────────────────────────────────────────────

  if (isPast) {
    // Read-only view of HOW the app was built — never a dead-end. A compact
    // summary header (what/how + checklist progress + a way back) followed by
    // a browsable, read-only workspace (file tree | code) so the user can SEE
    // the code that was built — the Build-phase equivalent of the other
    // phases' read-only doc. (Fixes: it used to show only a summary card, so
    // Build looked "empty" compared to every other phase — worse when the
    // checklist is empty, e.g. a BYO/Claude-Code build.)
    const checklist = (project.build_checklist ?? []) as Array<{ id: string; text: string; status: string }>;
    const doneCount = checklist.filter((c) => c.status === 'done').length;
    const isPublished = project.status === 'published';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
        <div style={{ padding: '6px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <PhaseSidebar project={project} viewedPhase="build" onSelect={onSelectPhase} guided={guided} />
        </div>
        {/* Compact summary header */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
              <Package size={16} /> {guided ? 'Your app is built' : 'Build complete'}
              {checklist.length > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>· {doneCount}/{checklist.length} steps built</span>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>
              {isPublished
                ? 'You\'re viewing how your app was built (read-only). It\'s installed and running — open or use it from "My apps". Browse the files below.'
                : 'You\'re viewing the build phase in read-only mode. Browse the files below, or go back to the current phase to keep working.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectPhase?.(project.status)}
            style={{ flexShrink: 0, padding: '8px 14px', background: 'var(--amber)', color: '#000', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            Back to where I was
          </button>
        </div>
        {/* Read-only workspace browser — the actual built files */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
            <WorkspaceFileTree
              projectId={project.id}
              refreshKey={0}
              recentEdits={[]}
              selected={selectedFile}
              onSelect={setSelectedFile}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
            {fileLoading && (
              <div style={overlayLoaderStyle}><Loader2 size={14} className="spin" /></div>
            )}
            {fileError && (
              <div style={{ padding: 16, color: 'var(--danger)', fontSize: '0.75rem' }}>{fileError}</div>
            )}
            {!fileError && (
              <CodeView
                selected={fileContent}
                emptyHint="Pick a file from the tree to see what was built."
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      overflow: 'hidden', fontFamily: 'var(--font-sans)', position: 'relative',
    }}>
      {/* PhaseSidebar — phase pill strip (already shows v2 'build' slot) */}
      <div style={{ padding: '6px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <PhaseSidebar project={project} viewedPhase="build" onSelect={onSelectPhase} guided={guided} />
      </div>

      {/* Header strip */}
      <BuildHeaderStrip
        status={stream.status}
        tokensUsed={stream.tokensUsed}
        tokenCap={project.build_token_cap}
        turnsUsed={stream.turnsUsed}
        turnCap={project.build_turn_cap}
        startedAt={startedAt}
        onStop={() => { void useStudioStore.getState().abortBuild(project.id); }}
        onFinish={(force) => { void handleFinish(force); }}
        onOpenSettings={() => setShowSettings(true)}
        checklist={stream.checklist}
        turnsHaveStarted={isStarted && stream.status !== 'running'}
        // Before any session exists `stream.mode` is null. Show PLAN MODE
        // anyway because it's the mode the next /build/start will use,
        // unless the user has flipped force-plan off (still plan today,
        // build later via approve). Once the session exists the bridge
        // updates `stream.mode` and the chip reflects reality.
        mode={stream.mode ?? 'plan'}
        forcePlanMode={project.build_force_plan_mode}
        isStarted={isStarted}
        starting={starting}
        onStart={() => { void handleStart(); }}
        projectId={project.id}
        guided={guided}
      />

      {/* Engine degradation banner — this project's server-side engine is
          no longer ready (key removed / acpx off / harness gone). Proactive:
          the user learns BEFORE a send fails, with the two ways out. */}
      {engineDegraded && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 16px', flexShrink: 0,
          background: 'color-mix(in srgb, var(--amber) 10%, var(--card))',
          borderBottom: '1px solid color-mix(in srgb, var(--amber) 40%, var(--border))',
          fontSize: '0.75rem', color: 'var(--text)',
        }}>
          <AlertCircle size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ flex: 1, lineHeight: 1.4 }}>
            {engineInfo?.label} isn't ready on this server{engineInfo?.reason ? ` — ${engineInfo.reason}` : '.'}
          </span>
          <button type="button" onClick={() => navigate('/settings/studio-engines')} style={degradedBtn(true)}>
            Configure
          </button>
          <button type="button" onClick={() => setShowSettings(true)} style={degradedBtn(false)}>
            Switch engine
          </button>
        </div>
      )}

      {/* BYO control row: open the project in the user's own Claude Code /
          Cursor via MCP (not ACP — OpenCode does not take part; the user
          spends their own subscription). Visible in BOTH modes — Guided
          gets jargon-free copy (the create-time toasts promise this). */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: 8, padding: '6px 16px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: 'var(--card)',
      }}>
        {guided && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Prefer your own coding tool?
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowConnect(true)}
          title="Build this project from your own Claude Code / Cursor via MCP (not ACP)"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', fontSize: '0.72rem', fontWeight: 600,
            background: 'transparent', color: 'var(--text-dim)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          <Plug size={12} /> {guided ? 'Open this project in it' : 'Open in my tool'}
        </button>
      </div>

      {/* Build checklist panel — collapsible. Hidden when no items
          yet (project just entered Build, generation in flight). In
          Guided mode the human milestone list (GuidedBuildPanel) shows
          this same data, so we hide the raw technical checklist here. */}
      {!guided && <BuildChecklist projectId={project.id} items={stream.checklist} />}

      {/* Plan-mode approval CTA. Visible whenever the session is NOT
          yet in build-mode — covers `mode === 'plan'` AND `mode === null`
          (state still hydrating after first mount, but we know the
          default for fresh sessions is plan). The button is disabled
          while streaming so the user actually reads the plan first. */}
      {isStarted && stream.mode !== 'build' && (
        <PlanApprovalBanner
          projectId={project.id}
          streamingInProgress={stream.status === 'running'}
          checklistCount={stream.checklist.length}
          status={stream.status}
          guided={guided}
        />
      )}

      {showSettings && (
        <BuildSettingsPanel
          projectId={project.id}
          workspacePath={project.workspace_path}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showConnect && (
        <ConnectExternalEngineModal
          projectId={project.id}
          onClose={() => setShowConnect(false)}
        />
      )}

      {confirmDialog}

      {/* Top error surfaces. In Guided mode the empathetic template (§8):
          what happened in plain words + reassurance + ways out (never a
          dead end, never a stack trace up front). In Pro, the raw banner. */}
      {startError && (/ENGINE_NOT_READY|ACP_HARNESS_MISSING/i.test(startError) ? (
        guided ? (
          <FriendlyError
            title="This engine isn't ready yet"
            message="The engine this project uses needs a one-time setup on the server before it can build."
            detail={startError}
            actions={[
              { label: 'Open Settings › Studio Engines', onClick: () => navigate('/settings/studio-engines'), primary: true },
              { label: 'Switch engine', onClick: () => setShowSettings(true) },
              { label: 'Dismiss', onClick: () => setStartError(null) },
            ]}
          />
        ) : (
          <Banner kind="error" icon={<AlertCircle size={14} />}>
            {startError}{' '}
            <button type="button" onClick={() => navigate('/settings/studio-engines')} style={bannerLinkBtn}>
              Open Settings › Studio Engines
            </button>
          </Banner>
        )
      ) : guided ? (
        <FriendlyError
          title="I couldn't start building your app"
          message="I tried, but something got in the way. It usually works on a retry."
          detail={startError}
          actions={[
            { label: 'Retry', onClick: () => { void handleStart(); }, primary: true },
            { label: 'Dismiss', onClick: () => setStartError(null) },
          ]}
        />
      ) : (
        <Banner kind="error" icon={<AlertCircle size={14} />}>
          {startError}
        </Banner>
      ))}
      {stream.error && (guided ? (
        <FriendlyError
          title="The Builder hit a problem"
          message="I can try again. If it keeps failing, go back to the plan (bottom left) and tweak something."
          detail={stream.error}
          actions={[
            { label: 'Try again', onClick: () => { void handleStart(); }, primary: true },
          ]}
        />
      ) : (
        <Banner kind="error" icon={<AlertCircle size={14} />}>
          Build session error: {stream.error}
        </Banner>
      ))}

      {/* Body — resizable splits: workspace | chat (horizontal),
          inside workspace: code/api ↕ activity feed,
          inside code/api: filetree | code (horizontal). All persisted
          via autoSaveId so user-resized layouts survive page reloads. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <PanelGroup direction="horizontal" autoSaveId="studio-build-h-main">
          {/* Left: in Guided mode a human milestone panel (curtain over the
              engine); in Pro mode the full technical workspace. The outer
              2-panel layout is identical in both modes so react-resizable
              -panels keeps a stable autoSaveId. */}
          <Panel defaultSize={55} minSize={25}>
            {guided ? (
              <GuidedBuildPanel
                projectId={project.id}
                status={stream.status}
                checklist={stream.checklist}
                tokensUsed={stream.tokensUsed}
                tokenCap={project.build_token_cap}
                isStarted={isStarted}
                starting={starting}
              />
            ) : (
            <PanelGroup direction="vertical" autoSaveId="studio-build-v-ws">
              {/* Top: tabs + (filetree | code) split */}
              <Panel defaultSize={70} minSize={30}>
                <div style={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  minHeight: 0, overflow: 'hidden',
                }}>
                  <Tabs tab={tab} onChange={setTab} />
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {tab === 'code' && (
                      <PanelGroup direction="horizontal" autoSaveId="studio-build-h-ws">
                        <Panel defaultSize={25} minSize={15} maxSize={50}>
                          <div style={{ height: '100%', overflow: 'hidden' }}>
                            <WorkspaceFileTree
                              projectId={project.id}
                              refreshKey={refreshKey}
                              recentEdits={stream.recentEdits}
                              selected={selectedFile}
                              onSelect={setSelectedFile}
                            />
                          </div>
                        </Panel>
                        <ResizeHandle direction="horizontal" ariaLabel="Resize file tree" />
                        <Panel minSize={30}>
                          <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
                            {fileLoading && (
                              <div style={overlayLoaderStyle}><Loader2 size={14} className="spin" /></div>
                            )}
                            {fileError && (
                              <div style={{ padding: 16, color: 'var(--danger)', fontSize: '0.75rem' }}>
                                {fileError}
                              </div>
                            )}
                            {!fileError && (
                              <CodeView
                                selected={fileContent}
                                emptyHint="Pick a file from the tree to view its content."
                              />
                            )}
                          </div>
                        </Panel>
                      </PanelGroup>
                    )}
                    {tab === 'api' && (
                      <div style={{ height: '100%', overflow: 'auto', padding: 14 }}>
                        <ApiList routes={routes} />
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
              <ResizeHandle direction="vertical" ariaLabel="Resize activity feed" />
              <Panel defaultSize={30} minSize={10}>
                <div style={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  minHeight: 0,
                }}>
                  <div style={paneHeader}>Activity feed</div>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                    <ActivityFeed toolHistory={stream.toolHistory} recentEdits={stream.recentEdits} />
                  </div>
                </div>
              </Panel>
            </PanelGroup>
            )}
          </Panel>

          <ResizeHandle direction="horizontal" ariaLabel="Resize chat" />

          {/* Right: native OpenCode UI embedded in an iframe (its composer
              hidden by the embed proxy) + a Core-owned input — Core keeps
              ownership of the prompt so plan/build gating + caps stay
              enforced (hybrid-governed, D1). Degrades to the classic
              BuildChat if the embed can't be reached. */}
          <Panel defaultSize={45} minSize={20}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <OpencodeEmbed
                projectId={project.id}
                status={stream.status}
                mode={stream.mode}
                isStarted={isStarted}
                starting={starting}
                checklist={stream.checklist}
                studioMode={studioMode}
                onStudioModeChange={setStudioMode}
                onAutoStart={handleStart}
                engine={project.engine}
                fallback={
                  <BuildChat
                    projectId={project.id}
                    status={stream.status}
                    messages={stream.messages}
                    activitySummary={stream.activitySummary}
                    silentForMs={stream.silentForMs}
                    isStarted={isStarted}
                    starting={starting}
                    mode={stream.mode}
                    onAutoStart={handleStart}
                    pushUserMessage={stream.pushUserMessage}
                  />
                }
              />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Floating back link in case the user lands here without phase strip */}
      <button
        onClick={() => navigate('/studio')}
        style={floatingBackStyle}
        aria-label="Back to projects"
      >
        <ChevronLeft size={12} /> projects
      </button>
    </div>
  );
}

function Tabs({ tab, onChange }: { tab: 'code' | 'api'; onChange: (t: 'code' | 'api') => void }) {
  return (
    <div style={{
      display: 'flex', gap: 0,
      borderBottom: '1px solid var(--border)', flexShrink: 0,
      background: 'var(--card)',
    }}>
      {(['code', 'api'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: '8px 16px', fontSize: '0.75rem',
            background: tab === t ? 'var(--surface)' : 'transparent',
            color: tab === t ? 'var(--text)' : 'var(--text-dim)',
            border: 'none',
            borderBottom: tab === t ? '2px solid var(--amber)' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600,
          }}
        >{t}</button>
      ))}
    </div>
  );
}

function ApiList({ routes }: { routes: StudioMountedRoute[] }) {
  if (routes.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
        No routes mounted yet. Once the agent writes <code>api/*.route.mjs</code> and calls
        <code> mount_project</code>, they'll show up here.
      </div>
    );
  }
  return (
    <table style={{
      width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem',
      fontFamily: 'var(--font-mono)',
    }}>
      <thead>
        <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
          <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>Method</th>
          <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>Pattern</th>
        </tr>
      </thead>
      <tbody>
        {routes.map((r, i) => (
          <tr key={i} style={{ color: 'var(--text)' }}>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
              <strong>{r.method}</strong>
            </td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
              {r.pattern}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Banner({ kind, icon, children }: { kind: 'error' | 'info'; icon: React.ReactNode; children: React.ReactNode }) {
  const isErr = kind === 'error';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '8px 16px',
      background: isErr ? 'color-mix(in srgb, var(--danger) 8%, var(--card))' : 'var(--card)',
      borderBottom: '1px solid var(--border)',
      color: isErr ? 'var(--danger)' : 'var(--text-dim)',
      fontSize: '0.75rem', flexShrink: 0,
    }}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

const paneHeader: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em',
  fontWeight: 600, color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)', background: 'var(--card)',
};
const overlayLoaderStyle: React.CSSProperties = {
  position: 'absolute', top: 8, right: 12, color: 'var(--text-muted)',
  zIndex: 1,
};
const degradedBtn = (primary: boolean): React.CSSProperties => ({
  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', fontSize: '0.7rem', fontWeight: 600,
  background: primary ? 'var(--amber)' : 'transparent',
  color: primary ? '#000' : 'var(--text-dim)',
  border: primary ? 'none' : '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
});
const bannerLinkBtn: React.CSSProperties = {
  padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
  color: 'inherit', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit',
};
const floatingBackStyle: React.CSSProperties = {
  position: 'absolute', top: 14, left: 14, zIndex: 5,
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '4px 8px', fontSize: '0.7rem',
  background: 'var(--card)', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

// Re-export for callers that referenced the placeholder by default.
export default BuildPhase;
