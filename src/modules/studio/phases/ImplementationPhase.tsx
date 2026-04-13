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

// ─── Studio Phase 6 — implementation viewport ───────────────────────
//
// Three-pane layout: session board (left) | file tree (middle) | code
// viewer (right). The user runs sessions sequentially; each completes,
// new files appear in the tree, and clicking one shows the generated
// content. Read-only viewer for MVP — CodeMirror is post-MVP per the plan.

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, RefreshCw, AlertCircle, Check, Play, FileText, Folder, Database, Code2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  useStudioStore,
  type StudioProject,
  type StudioSessionRow,
  type StudioImplementationPlan,
  type StudioGeneratedFile,
  type StudioPlannedSession,
} from '@/stores/studio.store';
import { useStudioStream } from '../hooks/useStudioStream';
import { StreamDebugOverlay } from '../components/StreamDebugOverlay';
import { TestResultsPanel } from '../components/TestResultsPanel';
import { PreviewPanel } from '../components/PreviewPanel';
import { SkillTestChat } from '../components/SkillTestChat';
import { RewindButton } from '../components/RewindButton';

interface Props {
  project: StudioProject;
  viewMode?: 'edit' | 'past';
}

export function ImplementationPhase({ project, viewMode = 'edit' }: Props) {
  const isPast = viewMode === 'past';
  const buildPlan = useStudioStore((s) => s.buildPlan);
  const fetchSessions = useStudioStore((s) => s.fetchSessions);
  const runSession = useStudioStore((s) => s.runSession);
  const refetchProject = useStudioStore((s) => s.refetchProject);

  const [plan, setPlan] = useState<StudioImplementationPlan | null>(null);
  const [sessions, setSessions] = useState<StudioSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'plan' | number | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'code' | 'preview'>('code');

  // Phase tracking — planner streams as 'planner', sessions as 'session'
  const plannerStream = useStudioStream(project.id, 'planner');
  const sessionStream = useStudioStream(project.id, 'session');
  // Pick the more interesting stream for the overlay: prefer the
  // session stream when an actual session is running, otherwise show
  // planner stream activity. This avoids overlapping overlays.
  const debugStream = sessionStream.state.status !== 'idle' ? sessionStream : plannerStream;

  async function refresh() {
    setLoading(true);
    try {
      const data = await fetchSessions(project.id);
      setPlan(data.plan);
      setSessions(data.sessions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [project.id]);

  async function handleBuildPlan() {
    if (busy) return;
    try {
      setBusy('plan');
      plannerStream.reset();
      const result = await buildPlan(project.id);
      setPlan(result.plan);
      await refresh();
      toast.success(`Plan generated — ${result.plan.sessions.length} sessions`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Plan generation failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleRunSession(n: number) {
    if (busy) return;
    try {
      setBusy(n);
      sessionStream.reset();
      const result = await runSession(project.id, n);
      await Promise.all([refresh(), refetchProject(project.id)]);
      toast.success(`Sesión ${n} completada — ${result.files_generated.length} archivo(s)${result.route_count > 0 ? `, ${result.route_count} routes` : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Session ${n} failed`);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  // Map plan + db rows into a single ordered list of "session cards"
  const sessionCards = mergeSessions(plan, sessions);
  const files = (project.generated_files ?? []) as StudioGeneratedFile[];
  const fileTree = buildFileTree(files);
  const selected = selectedFile ? files.find((f) => f.path === selectedFile) : null;
  // Auto-select first file once content shows up
  useEffect(() => {
    if (!selectedFile && files.length > 0) setSelectedFile(files[0].path);
  }, [files, selectedFile]);

  if (loading) return <div style={loadingHint}><Loader2 size={14} className="animate-spin" /> Cargando…</div>;

  // ─── No plan yet — show planner CTA ───────────────────────
  if (!plan || plan.sessions.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={toolbarStyle}>
          <h2 style={titleStyle}><Sparkles size={14} style={{ color: 'var(--amber)' }} /> Implementación</h2>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{
            maxWidth: 480, textAlign: 'center', padding: 32,
            background: 'var(--card)', border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-dim)',
          }}>
            <Sparkles size={32} style={{ color: 'var(--amber)', marginBottom: 12 }} />
            <h3 style={{ fontSize: '1rem', color: 'var(--text)', margin: '0 0 8px' }}>
              Construyamos tu plan de implementación
            </h3>
            <p style={{ fontSize: '0.8125rem', lineHeight: 1.6, margin: '0 0 16px' }}>
              Studio Builder leerá la foundation aprobada y dividirá el trabajo en
              sesiones secuenciales. Después podrás ejecutarlas una a una.
            </p>
            {isPast ? (
              <RewindButton projectId={project.id} target="foundation" label="Rewind a foundation" />
            ) : (
              <button
                type="button"
                onClick={handleBuildPlan}
                disabled={busy !== null}
                style={primaryBtn(busy === 'plan')}
              >
                {busy === 'plan' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {busy === 'plan' ? 'Generando plan…' : 'Generar plan'}
              </button>
            )}
            {plannerStream.state.status === 'error' && !isPast && (
              <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--danger)' }}>
                {plannerStream.state.error}
              </div>
            )}
          </div>
        </div>
        <StreamDebugOverlay
          state={debugStream.state}
          debug={debugStream.debug}
          projectId={project.id}
          phase={debugStream === sessionStream ? 'session' : 'planner'}
        />
      </div>
    );
  }

  // ─── Plan exists — three-pane layout ──────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={toolbarStyle}>
        <h2 style={titleStyle}><Sparkles size={14} style={{ color: 'var(--amber)' }} /> Implementación</h2>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {sessionCards.filter((c) => c.dbStatus === 'completed').length} / {sessionCards.length} completadas
        </span>
        {!isPast && <SkillTestChat projectId={project.id} compact />}
        {!isPast && (
          <button type="button" onClick={refresh} style={secondaryBtn}>
            <RefreshCw size={12} /> Actualizar
          </button>
        )}
        {isPast && (
          <RewindButton projectId={project.id} target="foundation" label="Rewind a foundation" />
        )}
      </div>

      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '320px 240px minmax(0, 1fr)',
        overflow: 'hidden',
      }}>
        {/* ── Left: session board ── */}
        <aside style={paneStyle}>
          <div style={paneHeader}>Sesiones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8 }}>
            {sessionCards.map((card) => {
              const isCurrent = busy === card.number;
              const canRun = card.dbStatus !== 'completed' && card.dbStatus !== 'running' && busy === null
                && sessionCards.slice(0, card.number - 1).every((c) => c.dbStatus === 'completed');
              return (
                <div key={card.number} style={sessionCardStyle(card.dbStatus)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <SessionStatusIcon status={card.dbStatus} loading={isCurrent} />
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      #{card.number}
                    </span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
                      {card.title}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                    {card.description}
                  </p>
                  {card.errorLog && (
                    <div style={{
                      padding: '6px 8px', marginBottom: 8,
                      background: 'color-mix(in srgb, var(--danger) 12%, var(--card))',
                      border: '1px solid color-mix(in srgb, var(--danger) 40%, var(--border))',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.625rem', color: 'var(--text)',
                    }}>
                      <AlertCircle size={10} style={{ display: 'inline', marginRight: 4 }} />
                      {card.errorLog.slice(0, 200)}
                    </div>
                  )}
                  {card.dbStatus === 'completed' ? (
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      ✓ {card.dbFiles?.length ?? 0} archivo(s){card.creditsCost ? ` · ${card.creditsCost} tokens` : ''}
                      {(card.retryCount ?? 0) > 0 && ` · ${card.retryCount} fix${card.retryCount === 1 ? '' : 'es'}`}
                    </div>
                  ) : isPast ? (
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      {card.dbStatus === 'failed' ? 'Sesión fallida' : 'Sin ejecutar'}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canRun}
                      onClick={() => handleRunSession(card.number)}
                      style={runBtn(canRun, isCurrent)}
                    >
                      {isCurrent ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                      {isCurrent ? 'Ejecutando…' : (card.dbStatus === 'failed' ? 'Reintentar' : 'Ejecutar')}
                    </button>
                  )}
                  {card.testResults && card.testResults.total > 0 && (
                    <TestResultsPanel results={card.testResults} />
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Middle: file tree ── */}
        <aside style={paneStyle}>
          <div style={paneHeader}>Archivos</div>
          {files.length === 0 ? (
            <div style={{ padding: 16, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              No hay archivos generados todavía.
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {fileTree.map((node) => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  selected={selectedFile}
                  onSelect={setSelectedFile}
                />
              ))}
            </div>
          )}
        </aside>

        {/* ── Right: code viewer / preview tab ── */}
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...paneHeader, display: 'flex', alignItems: 'center', gap: 0, padding: 0 }}>
            <button
              type="button"
              onClick={() => setRightTab('code')}
              style={tabBtn(rightTab === 'code')}
            >
              <Code2 size={11} /> Código
            </button>
            <button
              type="button"
              onClick={() => setRightTab('preview')}
              style={tabBtn(rightTab === 'preview')}
            >
              <Eye size={11} /> Preview
            </button>
            <div style={{ flex: 1 }} />
            {rightTab === 'code' && selected && (
              <span style={{
                padding: '0 12px', fontSize: '0.625rem',
                color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <FileText size={11} /> {selected.path}
                {selected.session && <span>· sesión {selected.session}</span>}
              </span>
            )}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {rightTab === 'code' ? (
              <div style={{ height: '100%', overflow: 'auto' }}>
                {selected ? (
                  <pre style={{
                    margin: 0, padding: 16,
                    fontSize: '0.6875rem', fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text)', background: 'var(--surface)',
                    whiteSpace: 'pre', minHeight: '100%',
                  }}>
                    {selected.content}
                  </pre>
                ) : (
                  <div style={{ padding: 32, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                    Ejecuta una sesión y los archivos generados aparecerán aquí.
                  </div>
                )}
              </div>
            ) : (
              <PreviewPanel projectId={project.id} />
            )}
          </div>
        </div>
      </div>
      <StreamDebugOverlay
        state={debugStream.state}
        debug={debugStream.debug}
        projectId={project.id}
        phase={debugStream === sessionStream ? 'session' : 'planner'}
      />
    </div>
  );
}

// ─── Session card helpers ───────────────────────────────────────────

interface SessionCard extends StudioPlannedSession {
  dbStatus: StudioSessionRow['status'] | 'pending';
  dbFiles?: StudioGeneratedFile[];
  errorLog?: string | null;
  creditsCost?: number;
  testResults?: import('@/stores/studio.store').StudioTestResults | null;
  retryCount?: number;
}

function mergeSessions(plan: StudioImplementationPlan | null, dbRows: StudioSessionRow[]): SessionCard[] {
  if (!plan) return [];
  const byNumber = new Map(dbRows.map((r) => [r.session_number, r]));
  return plan.sessions.map((p) => {
    const row = byNumber.get(p.number);
    return {
      ...p,
      dbStatus: row?.status ?? 'pending',
      dbFiles: row?.files_generated ?? [],
      errorLog: row?.error_log ?? null,
      creditsCost: row?.credits_cost ?? 0,
      testResults: row?.test_results ?? null,
      retryCount: row?.retry_count ?? 0,
    };
  });
}

function SessionStatusIcon({ status, loading }: { status: SessionCard['dbStatus']; loading: boolean }) {
  if (loading) return <Loader2 size={12} className="animate-spin" style={{ color: 'var(--amber)' }} />;
  switch (status) {
    case 'completed': return <Check size={12} style={{ color: '#22c55e' }} />;
    case 'running':   return <Loader2 size={12} className="animate-spin" style={{ color: 'var(--amber)' }} />;
    case 'failed':    return <AlertCircle size={12} style={{ color: 'var(--danger)' }} />;
    default:          return <Database size={12} style={{ color: 'var(--text-muted)' }} />;
  }
}

// ─── Tiny file tree ─────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
}

function buildFileTree(files: StudioGeneratedFile[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      if (!node.children) node.children = [];
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: isFile ? f.path : parts.slice(0, i + 1).join('/'),
          isDir: !isFile,
          children: isFile ? undefined : [],
        };
        node.children.push(child);
      }
      node = child;
    }
  }
  // Sort: dirs first, then alpha
  const sortNode = (n: TreeNode) => {
    if (n.children) {
      n.children.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      n.children.forEach(sortNode);
    }
  };
  sortNode(root);
  return root.children ?? [];
}

function FileTreeNode({
  node, selected, onSelect, depth = 0,
}: { node: TreeNode; selected: string | null; onSelect: (p: string) => void; depth?: number }) {
  const isSelected = !node.isDir && selected === node.path;
  return (
    <>
      <div
        onClick={() => !node.isDir && onSelect(node.path)}
        style={{
          padding: `4px 12px 4px ${12 + depth * 14}px`,
          fontSize: '0.75rem',
          color: isSelected ? 'var(--text)' : (node.isDir ? 'var(--text-dim)' : 'var(--text)'),
          background: isSelected ? 'var(--card-hover)' : 'transparent',
          borderLeft: `2px solid ${isSelected ? 'var(--amber)' : 'transparent'}`,
          cursor: node.isDir ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--font-mono, monospace)',
          userSelect: 'none',
        }}
      >
        {node.isDir ? <Folder size={11} /> : <FileText size={11} />}
        {node.name}
      </div>
      {node.children?.map((c) => (
        <FileTreeNode key={c.path} node={c} selected={selected} onSelect={onSelect} depth={depth + 1} />
      ))}
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = {
  padding: '12px 24px', borderBottom: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
};
const titleStyle: React.CSSProperties = {
  fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text)',
  display: 'flex', alignItems: 'center', gap: 8,
};
const paneStyle: React.CSSProperties = {
  borderRight: '1px solid var(--border)',
  background: 'var(--surface)', overflowY: 'auto',
};
const paneHeader: React.CSSProperties = {
  padding: '10px 14px', fontSize: '0.6875rem',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--text-muted)', fontWeight: 600,
  borderBottom: '1px solid var(--border)',
  background: 'var(--card)',
  position: 'sticky', top: 0, zIndex: 1,
};
const sessionCardStyle = (status: SessionCard['dbStatus']): React.CSSProperties => ({
  padding: 10,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderLeft: `2px solid ${
    status === 'completed' ? '#22c55e' :
    status === 'failed' ? 'var(--danger)' :
    status === 'running' ? 'var(--amber)' : 'var(--border)'
  }`,
  borderRadius: 'var(--radius-sm)',
});
const runBtn = (enabled: boolean, busy: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '4px 10px',
  background: enabled ? 'var(--amber)' : 'var(--surface)',
  color: enabled ? '#000' : 'var(--text-dim)',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontSize: '0.6875rem', fontWeight: 600,
  cursor: busy ? 'wait' : (enabled ? 'pointer' : 'not-allowed'),
  fontFamily: 'var(--font-sans)',
});
const primaryBtn = (busy: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 18px',
  background: 'var(--amber)', color: '#000',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: '0.8125rem', fontWeight: 600,
  cursor: busy ? 'wait' : 'pointer',
  fontFamily: 'var(--font-sans)',
});
const secondaryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '6px 12px', background: 'transparent',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
};
const loadingHint: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: '100%', gap: 8, color: 'var(--text-dim)', fontSize: '0.875rem',
};
const tabBtn = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '10px 14px',
  background: active ? 'var(--surface)' : 'transparent',
  border: 'none',
  borderBottom: `2px solid ${active ? 'var(--amber)' : 'transparent'}`,
  color: active ? 'var(--text)' : 'var(--text-dim)',
  fontSize: '0.6875rem', fontWeight: active ? 600 : 400,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
});
