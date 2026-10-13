/** Native OpenClaw 2026.9.4 Skill Workshop, presented in MicelHub. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileText, Loader2, RefreshCw, Search, ShieldAlert, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { useNavigate } from 'react-router';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Agent = { id: string; name: string; display_name: string; avatar?: string | null };
type Proposal = Record<string, unknown>;
type ProposalDetail = {
  title: string;
  description: string;
  status: string;
  kind: string;
  revisionHash: string;
  content: string;
  installedContent: string | null;
  supportFiles: Array<{ path: string; content?: string; sizeBytes?: number; loaded?: boolean }>;
  scan: Record<string, unknown> | null;
  evaluation: Record<string, unknown> | null;
  events: Array<Record<string, unknown>>;
  proposal: Proposal;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function proposalList(value: unknown): Proposal[] {
  if (Array.isArray(value)) return value.filter((item): item is Proposal => !!item && typeof item === 'object');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.proposals)) return record.proposals.filter((item): item is Proposal => !!item && typeof item === 'object');
  }
  return [];
}

function text(value: unknown, fallback = '—'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function WorkshopTab() {
  const navigate = useNavigate();
  const selectAgent = useChatStore((state) => state.selectAgent);
  const startNewConversation = useChatStore((state) => state.startNewConversation);
  const role = useAuthStore((state) => state.user?.role);
  const canConfigure = role === 'owner' || role === 'admin';
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [section, setSection] = useState<'skills' | 'proposals'>('skills');
  const [searchTerm, setSearchTerm] = useState('');
  const [workshop, setWorkshop] = useState<Record<string, unknown> | null>(null);
  const [projectionSynced, setProjectionSynced] = useState(true);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<'off' | 'propose' | 'auto' | null>(null);
  const [detail, setDetail] = useState<{ title: string; content: string; meta: string } | null>(null);
  const [proposalDetail, setProposalDetail] = useState<ProposalDetail | null>(null);
  const [proposalDetailTab, setProposalDetailTab] = useState<'summary' | 'changes' | 'files' | 'security' | 'history'>('summary');
  const [revisionProposal, setRevisionProposal] = useState<Proposal | null>(null);
  const [revisionContent, setRevisionContent] = useState('');

  const selected = useMemo(() => agents.find((agent) => agent.id === agentId) ?? null, [agents, agentId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const agentResponse = await api.get<{ data: Agent[] }>('/managed-agents');
      const nextAgents = agentResponse.data ?? [];
      setAgents(nextAgents);
      const nextId = nextAgents.some((agent) => agent.id === agentId) ? agentId : nextAgents.find((agent) => agent.name === 'francis')?.id ?? nextAgents[0]?.id ?? '';
      setAgentId(nextId);
      if (nextId) {
        const response = await api.get<{ data: { workshop?: Record<string, unknown>; proposals?: unknown; projection_synced?: boolean } }>(`/managed-agents/${nextId}/workshop`);
        setWorkshop(response.data.workshop ?? null);
        setProposals(proposalList(response.data.proposals));
        setProjectionSynced(response.data.projection_synced !== false);
      } else {
        setWorkshop(null);
        setProposals([]);
        setProjectionSynced(true);
      }
      const config = await api.get<{ data: { mode?: 'off' | 'propose' | 'auto' } }>('/gateway/skill-workshop-config').catch(() => null);
      setMode(config?.data.mode ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar Skill Workshop');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { void load(); }, [load]);

  const mutateProposal = async (proposal: Proposal, action: 'evaluate' | 'apply' | 'reject' | 'revise' | 'quarantine', content?: string) => {
    if (!selected) return;
    const id = text(proposal.id, '');
    const revision = text(proposal.expected_revision_hash ?? proposal.revision_hash, '');
    if (!id || !revision) {
      toast.error('La propuesta no incluye una revisión válida. Actualiza la lista e inténtalo otra vez.');
      return;
    }
    setBusy(`${id}:${action}`);
    try {
      const response = await api.post<{ data: { projection_synced?: boolean } }>(`/managed-agents/${selected.id}/workshop/proposals/${encodeURIComponent(id)}/${action}`, {
        expected_revision_hash: revision,
        ...(action === 'revise' ? { content: content?.trim() } : {}),
      });
      if (action === 'revise') {
        setRevisionProposal(null);
        setRevisionContent('');
      }
      if (action === 'apply' && response.data.projection_synced === false) {
        toast.warning('Skill aplicada en OpenClaw; su acceso en el agente sigue sincronizándose. Actualiza Workshop para reintentarlo.');
      } else {
        toast.success(action === 'apply' ? 'Skill aplicada' : 'Propuesta actualizada');
      }
      if (proposalDetail?.proposal.id === id) setProposalDetail(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo completar la operación');
    } finally {
      setBusy(null);
    }
  };

  const beginRevision = async (proposal: Proposal) => {
    if (!selected) return;
    const id = text(proposal.id, '');
    if (!id) return;
    setBusy(`${id}:inspect`);
    try {
      const response = await api.get<{ data: { proposal?: { content?: string; revision_hash?: string }; revision_hash?: string; content?: string } }>(
        `/managed-agents/${selected.id}/workshop/proposals/${encodeURIComponent(id)}`,
      );
      const inspected = response.data;
      const revisionHash = text(inspected.revision_hash ?? inspected.proposal?.revision_hash, '');
      const content = text(inspected.content ?? inspected.proposal?.content, '');
      if (!revisionHash || !content) throw new Error('OpenClaw no devolvió el contenido y la revisión de la propuesta.');
      setRevisionProposal({ ...proposal, expected_revision_hash: revisionHash, revision_hash: revisionHash });
      setRevisionContent(content);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir la revisión');
    } finally {
      setBusy(null);
    }
  };

  const changeMode = async (next: 'off' | 'propose' | 'auto') => {
    if (!canConfigure) return;
    setBusy('mode');
    try {
      await api.patch('/gateway/skill-workshop-config', { mode: next });
      setMode(next);
      toast.success('Modo de Skill Workshop actualizado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el modo');
    } finally {
      setBusy(null);
    }
  };

  const installed = proposalList(workshop?.installed_skills ?? workshop?.skills);
  const needle = searchTerm.trim().toLocaleLowerCase();
  const visibleInstalled = needle ? installed.filter((skill) =>
    [skill.name, skill.title, skill.description, skill.skill_key].some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(needle))) : installed;
  const visibleProposals = needle ? proposals.filter((proposal) =>
    [proposal.title, proposal.skill_name, proposal.description, proposal.status].some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(needle))) : proposals;
  const openInstalledSkill = async (skill: Proposal) => {
    if (!selected) return;
    const name = text(skill.name, '');
    if (!name) return;
    try {
      const response = await api.get<{ data: Record<string, unknown> }>(`/managed-agents/${selected.id}/workshop/skills/${encodeURIComponent(name)}`);
      setDetail({ title: text(response.data.name, name), content: text(response.data.content, 'No hay contenido disponible.'), meta: `Skill instalada · ${text(response.data.skill_key, name)}` });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo abrir la skill'); }
  };
  const openProposal = async (proposal: Proposal) => {
    if (!selected) return;
    const id = text(proposal.id, ''); if (!id) return;
    try {
      const response = await api.get<{ data: { proposal?: Record<string, unknown>; events?: unknown } }>(`/managed-agents/${selected.id}/workshop/proposals/${encodeURIComponent(id)}`);
      const inspected = record(response.data.proposal);
      const metadata = record(inspected.record);
      const target = record(metadata.target);
      const filesByPath = new Map<string, { path: string; content?: string; sizeBytes?: number }>();
      for (const item of [
        ...(Array.isArray(metadata.support_files) ? metadata.support_files : []),
        ...(Array.isArray(inspected.support_files) ? inspected.support_files : []),
      ]) {
        const file = record(item);
        if (typeof file.path !== 'string') continue;
        filesByPath.set(file.path, {
          ...filesByPath.get(file.path), path: file.path,
          ...(typeof file.content === 'string' ? { content: file.content } : {}),
          ...(typeof file.size_bytes === 'number' ? { sizeBytes: file.size_bytes } : {}),
        });
      }
      const supportFiles = [...filesByPath.values()];
      const eventPayload = record(response.data.events);
      const events = Array.isArray(eventPayload.events) ? eventPayload.events.map(record) : [];
      let installedContent: string | null = null;
      if (metadata.kind === 'update' && typeof target.skill_name === 'string') {
        const current = await api.get<{ data: { content?: string } }>(`/managed-agents/${selected.id}/workshop/skills/${encodeURIComponent(target.skill_name)}`).catch(() => null);
        installedContent = typeof current?.data.content === 'string' ? current.data.content : null;
      }
      setProposalDetail({
        title: text(metadata.title ?? proposal.title ?? proposal.skill_name, 'Propuesta'),
        description: text(metadata.description ?? proposal.description, 'Sin descripción'),
        status: text(metadata.status ?? proposal.status, 'sin estado'),
        kind: text(metadata.kind ?? proposal.kind, 'desconocido'),
        revisionHash: text(inspected.revision_hash ?? proposal.revision_hash, 'no disponible'),
        content: text(inspected.content, 'El Workshop no devolvió contenido para esta revisión.'),
        installedContent,
        supportFiles,
        scan: metadata.scan && typeof metadata.scan === 'object' ? record(metadata.scan) : null,
        evaluation: metadata.evaluation && typeof metadata.evaluation === 'object' ? record(metadata.evaluation) : null,
        events,
        proposal,
      });
      setProposalDetailTab('summary');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo inspeccionar la propuesta'); }
  };
  const loadArtifact = async (path: string) => {
    if (!selected || !proposalDetail) return;
    const proposalId = text(proposalDetail.proposal.id, '');
    if (!proposalId) return;
    setBusy(`artifact:${path}`);
    try {
      const response = await api.get<{ data: { content?: string } }>(
        `/managed-agents/${selected.id}/workshop/proposals/${encodeURIComponent(proposalId)}/artifact`,
        { path },
      );
      setProposalDetail((current) => current && current.proposal.id === proposalId ? {
        ...current,
        supportFiles: current.supportFiles.map((file) => file.path === path
          ? { ...file, loaded: true, ...(typeof response.data.content === 'string' ? { content: response.data.content } : {}) }
          : file),
      } : current);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir el archivo de la propuesta');
    } finally {
      setBusy(null);
    }
  };
  const learnFromConversations = () => {
    if (!selected) return;
    selectAgent(selected.name);
    startNewConversation();
    useChatStore.getState().setPendingDraft('Analiza conversaciones anteriores relevantes y prepara una propuesta de skill o mejora. No apliques cambios automáticamente.');
    navigate('/chat');
  };

  return <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginRight: 'auto' }}><Sparkles size={17} color="var(--amber)" /><strong style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Skill Workshop</strong></div>
      <select value={agentId} onChange={(event) => setAgentId(event.target.value)} style={selectStyle}>
        {agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.avatar ?? '🤖'} {agent.display_name}</option>)}
      </select>
      {canConfigure ? <select value={mode ?? ''} disabled={busy === 'mode' || mode === null} onChange={(event) => void changeMode(event.target.value as 'off' | 'propose' | 'auto')} style={selectStyle} title="Modo global de aprendizaje">
        <option value="" disabled>Modo no disponible</option><option value="off">Desactivado</option><option value="propose">Proponer</option><option value="auto">Automático</option>
      </select> : <span style={muted}>Modo global: {mode === null ? 'no disponible' : mode === 'off' ? 'Desactivado' : mode === 'auto' ? 'Automático' : 'Proponer'} · solo lectura</span>}
      <button onClick={learnFromConversations} disabled={!selected} style={buttonStyle}><Sparkles size={13} /> Aprender de conversaciones</button>
      <button onClick={() => void load()} disabled={loading} style={buttonStyle}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualizar</button>
    </div>
    {!projectionSynced && <div role="status" style={{ border: '1px solid var(--amber)', borderRadius: 7, padding: '8px 10px', color: 'var(--amber)', fontSize: '0.75rem' }}>
      Las skills instaladas están visibles, pero el acceso del agente aún no se ha sincronizado. Pulsa Actualizar para reintentarlo.
    </div>}
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 420, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', padding: '6px 9px', color: 'var(--text-dim)' }}>
      <Search size={14} aria-hidden="true" />
      <input aria-label="Buscar en Workshop" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar skills o sugerencias…" style={{ border: 0, outline: 0, background: 'transparent', color: 'var(--text)', width: '100%', minWidth: 0, fontSize: '0.75rem' }} />
    </label>
    <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
      <TabButton active={section === 'skills'} onClick={() => setSection('skills')} label={`Skills${installed.length ? ` (${installed.length})` : ''}`} />
      <TabButton active={section === 'proposals'} onClick={() => setSection('proposals')} label={`Sugerencias${proposals.length ? ` (${proposals.length})` : ''}`} />
    </div>
    {loading ? <div style={emptyStyle}><Loader2 size={18} className="animate-spin" /> Cargando Workshop…</div> : section === 'skills' ? (
      visibleInstalled.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>{visibleInstalled.map((skill, index) => <button key={`${text(skill.name)}-${index}`} onClick={() => void openInstalledSkill(skill)} style={{ ...cardStyle, cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{text(skill.title ?? skill.name, 'Skill')}</strong><span style={pillStyle}>{text(skill.status, 'Instalada')}</span></div><span style={muted}>Versión {text(skill.version, '—')}</span><span style={muted}>{text(skill.description, 'Skill creada o gestionada por el Workshop nativo.')}</span></button>)}</div> : <div style={emptyStyle}><FileText size={28} /><span>{needle ? 'No hay skills que coincidan con la búsqueda.' : 'No hay skills de Workshop instaladas para este agente.'}</span></div>
    ) : (
      visibleProposals.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 10 }}>{visibleProposals.map((proposal, index) => {
        const id = text(proposal.id, String(index)); const state = text(proposal.status, 'Pendiente'); const isBusy = busy?.startsWith(`${id}:`);
        const blockedByScan = ['failed', 'blocked'].includes(text(proposal.scan_state, '').toLowerCase());
        const actionable = ['pending', 'evaluated', 'ready'].includes(state.toLowerCase());
        return <div key={id} style={cardStyle}><button onClick={() => void openProposal(proposal)} style={{ display: 'contents', textAlign: 'left', color: 'inherit' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{text(proposal.title ?? proposal.skill_name, 'Propuesta')}</strong><span style={pillStyle}>{state}</span></div><span style={muted}>{text(proposal.description, 'Sin descripción')}</span></button>{blockedByScan && <span style={{ color: 'var(--error)', fontSize: '0.72rem' }}>El escaneo bloquea la aplicación; revisa Seguridad.</span>}{actionable ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}><Action onClick={() => void mutateProposal(proposal, 'evaluate')} disabled={!!isBusy} icon={<ShieldAlert size={12} />} label="Evaluar" /><Action onClick={() => void beginRevision(proposal)} disabled={!!isBusy} icon={<RefreshCw size={12} />} label="Editar revisión" /><Action onClick={() => void mutateProposal(proposal, 'reject')} disabled={!!isBusy} icon={<X size={12} />} label="Rechazar" /><Action onClick={() => void mutateProposal(proposal, 'apply')} disabled={!!isBusy || blockedByScan} icon={<Check size={12} />} label="Aplicar" primary /></div> : <span style={muted}>Esta propuesta no tiene acciones pendientes.</span>}</div>;
      })}</div> : <div style={emptyStyle}><Sparkles size={28} /><span>{needle ? 'No hay sugerencias que coincidan con la búsqueda.' : 'No hay sugerencias pendientes. El Workshop propondrá cambios antes de aplicarlos.'}</span></div>
    )}
    <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) setDetail(null); }}><DialogContent className="max-w-[720px]"><DialogHeader><DialogTitle>{detail?.title}</DialogTitle><DialogDescription>{detail?.meta}</DialogDescription></DialogHeader><pre style={{ maxHeight: '55dvh', overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0, padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }}>{detail?.content}</pre></DialogContent></Dialog>
    <ProposalInspectionDialog
      detail={proposalDetail}
      tab={proposalDetailTab}
      onTabChange={setProposalDetailTab}
      onClose={() => setProposalDetail(null)}
      onQuarantine={() => { if (proposalDetail) void mutateProposal(proposalDetail.proposal, 'quarantine'); }}
      onLoadArtifact={(path) => void loadArtifact(path)}
      busy={!!busy}
      busyArtifact={busy?.startsWith('artifact:') ? busy.slice('artifact:'.length) : null}
    />
    <Dialog open={revisionProposal !== null} onOpenChange={(open) => { if (!open) setRevisionProposal(null); }}><DialogContent className="max-w-[720px]"><DialogHeader><DialogTitle>Editar revisión de la propuesta</DialogTitle><DialogDescription>Modifica el contenido de la propuesta nativa. Se guardará como nueva revisión sin instalar la skill. La revisión automática por agente no está disponible en chats aislados de OpenClaw.</DialogDescription></DialogHeader>
      <textarea aria-label="Contenido de la revisión" value={revisionContent} onChange={(event) => setRevisionContent(event.target.value)} maxLength={120_000} rows={16} style={{ ...selectStyle, width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" style={buttonStyle} onClick={() => setRevisionProposal(null)}>Cancelar</button><button type="button" style={buttonStyle} disabled={!revisionContent.trim() || !!busy} onClick={() => { if (revisionProposal) void mutateProposal(revisionProposal, 'revise', revisionContent); }}>Guardar revisión</button></div>
    </DialogContent></Dialog>
  </div>;
}

type ProposalTab = 'summary' | 'changes' | 'files' | 'security' | 'history';
function ProposalInspectionDialog({ detail, tab, onTabChange, onClose, onQuarantine, onLoadArtifact, busy, busyArtifact }: {
  detail: ProposalDetail | null;
  tab: ProposalTab;
  onTabChange: (tab: ProposalTab) => void;
  onClose: () => void;
  onQuarantine: () => void;
  onLoadArtifact: (path: string) => void;
  busy: boolean;
  busyArtifact: string | null;
}) {
  if (!detail) return null;
  const scan = detail.scan;
  const findings = Array.isArray(scan?.findings) ? scan.findings.map(record) : [];
  const critical = typeof scan?.critical === 'number' ? scan.critical : 0;
  const tabs: Array<[ProposalTab, string]> = [
    ['summary', 'Resumen'], ['changes', 'Cambios'], ['files', 'Archivos'], ['security', 'Seguridad'], ['history', 'Historial'],
  ];
  const codeStyle: React.CSSProperties = { margin: 0, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)', fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflow: 'auto', maxHeight: '42dvh' };
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-w-[920px] max-h-[90dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>{detail.title}</DialogTitle><DialogDescription>{detail.description}</DialogDescription></DialogHeader>
    <div role="tablist" aria-label="Detalle de propuesta" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => onTabChange(key)} style={{ ...buttonStyle, color: tab === key ? 'var(--amber)' : 'var(--text-dim)', borderColor: tab === key ? 'var(--amber)' : 'var(--border)' }}>{label}</button>)}
    </div>
    {tab === 'summary' && <div style={{ display: 'grid', gap: 8, fontSize: '0.8rem', color: 'var(--text)' }}>
      <span>Estado: {detail.status} · Tipo: {detail.kind}</span>
      <span>Revisión: <code>{detail.revisionHash}</code></span>
      <span>Evaluación: {detail.evaluation ? `${Array.isArray(detail.evaluation.outcomes) ? detail.evaluation.outcomes.length : 0} resultados` : 'No disponible'}</span>
      <span>Escaneo: {scan ? text(scan.state, 'Sin estado') : 'No disponible'}</span>
    </div>}
    {tab === 'changes' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 10 }}>
      <div><strong style={muted}>Versión instalada</strong>{detail.installedContent === null ? <p style={muted}>No hay una versión instalada comparable para esta propuesta.</p> : <pre style={codeStyle}>{detail.installedContent}</pre>}</div>
      <div><strong style={muted}>Versión propuesta</strong><pre style={codeStyle}>{detail.content}</pre></div>
    </div>}
    {tab === 'files' && <div style={{ display: 'grid', gap: 8 }}>
      <details><summary style={{ cursor: 'pointer', color: 'var(--text)' }}>PROPOSAL.md</summary><pre style={codeStyle}>{detail.content}</pre></details>
      {detail.supportFiles.length ? detail.supportFiles.map((file) => <details key={file.path}><summary style={{ cursor: 'pointer', color: 'var(--text)' }}>{file.path}{typeof file.sizeBytes === 'number' ? ` · ${file.sizeBytes} B` : ''}</summary>{typeof file.content === 'string' ? <pre style={codeStyle}>{file.content}</pre> : file.loaded ? <p style={muted}>OpenClaw ha omitido el contenido de este archivo por su límite de lectura.</p> : <button type="button" style={{ ...buttonStyle, marginTop: 8 }} disabled={busy} onClick={() => onLoadArtifact(file.path)}>{busyArtifact === file.path ? 'Abriendo…' : 'Abrir archivo'}</button>}</details>) : <span style={muted}>Esta revisión no incluye archivos de apoyo.</span>}
    </div>}
    {tab === 'security' && <div style={{ display: 'grid', gap: 8, fontSize: '0.8rem', color: 'var(--text)' }}>
      {scan ? <><span>Escaneo: {text(scan.state, 'Sin estado')} · Críticos: {critical} · Avisos: {typeof scan.warn === 'number' ? scan.warn : 0} · Informativos: {typeof scan.info === 'number' ? scan.info : 0}</span>
        {findings.length ? findings.map((finding, index) => <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 7, padding: 9 }}><strong>{text(finding.severity ?? finding.level, 'Hallazgo')}</strong><p style={{ ...muted, margin: '4px 0 0' }}>{text(finding.message ?? finding.description, 'Sin descripción')}</p></div>) : <span style={muted}>El escaneo no registró hallazgos.</span>}
      </> : <span style={muted}>Todavía no hay un resultado de seguridad para esta revisión.</span>}
      {detail.status === 'pending' && critical > 0 && <button type="button" style={{ ...buttonStyle, justifySelf: 'start' }} disabled={busy} onClick={onQuarantine}>Poner en cuarentena</button>}
    </div>}
    {tab === 'history' && <div style={{ display: 'grid', gap: 7 }}>
      {detail.events.length ? detail.events.map((event, index) => <div key={text(event.event_id, String(index))} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 7, fontSize: '0.78rem', color: 'var(--text)' }}>{text(event.type, 'Evento')} <span style={muted}>{typeof event.occurred_at === 'string' ? new Date(event.occurred_at).toLocaleString() : ''}</span></div>) : <span style={muted}>No hay eventos registrados.</span>}
    </div>}
  </DialogContent></Dialog>;
}

const selectStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', padding: '6px 9px', fontSize: '0.75rem' };
const buttonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', color: 'var(--text)', cursor: 'pointer', padding: '6px 9px', fontSize: '0.75rem' };
const cardStyle: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 9, padding: 12, display: 'flex', flexDirection: 'column', gap: 7 };
const muted: React.CSSProperties = { color: 'var(--text-dim)', fontSize: '0.74rem', lineHeight: 1.45 };
const pillStyle: React.CSSProperties = { color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)', borderRadius: 999, padding: '2px 7px', fontSize: '0.65rem', whiteSpace: 'nowrap' };
const emptyStyle: React.CSSProperties = { minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center' };
function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button onClick={onClick} style={{ ...buttonStyle, borderColor: active ? 'var(--amber)' : 'var(--border)', background: active ? 'var(--amber-dim)' : 'transparent', color: active ? 'var(--amber)' : 'var(--text-dim)' }}>{label}</button>; }
function Action({ onClick, disabled, icon, label, primary }: { onClick: () => void; disabled: boolean; icon: React.ReactNode; label: string; primary?: boolean }) { return <button onClick={onClick} disabled={disabled} style={{ ...buttonStyle, borderColor: primary ? 'var(--amber)' : 'var(--border)', color: primary ? 'var(--amber)' : 'var(--text)', opacity: disabled ? 0.6 : 1 }}>{icon}{label}</button>; }
