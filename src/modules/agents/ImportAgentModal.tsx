import { useState, useRef, useEffect } from 'react';
import { Loader2, Package, Upload, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { validateAgentarPackage, installAgentarPackage, type AgentarValidationResult, type AgentarInstallResult } from '@/services/agentar.service';

interface ImportAgentModalProps { onClose: () => void; onInstalled: (result: AgentarInstallResult) => void }
const box: React.CSSProperties = { padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' };
const button: React.CSSProperties = { padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)', cursor: 'pointer' };

export function ImportAgentModal({ onClose, onInstalled }: ImportAgentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AgentarValidationResult | null>(null);
  const [result, setResult] = useState<AgentarInstallResult | null>(null);
  const [busy, setBusy] = useState<'inspect' | 'create' | null>(null);
  const [error, setError] = useState(''); const [name, setName] = useState('');
  const [includeUser, setIncludeUser] = useState(false); const [includeMemory, setIncludeMemory] = useState(false);
  const [skills, setSkills] = useState<string[]>([]); const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null); const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function inspect(chosen: File) {
    const turn = ++generation.current; setFile(chosen); setPreview(null); setResult(null); setError(''); setBusy('inspect'); setIncludeUser(false); setIncludeMemory(false); setSkills([]);
    try {
      const data = await validateAgentarPackage(chosen);
      if (turn !== generation.current) return;
      setPreview(data); setName(data.manifest.name);
    } catch (e) { if (turn === generation.current) setError(e instanceof Error ? e.message : 'Package inspection failed'); }
    finally { if (turn === generation.current) setBusy(null); }
  }
  async function create() {
    if (!file || !preview || busy) return;
    const turn = generation.current; setBusy('create'); setError('');
    try {
      const data = await installAgentarPackage(file, { preview_hash: preview.preview_hash, name, include_user: includeUser, include_memory: includeMemory, selected_skills: skills });
      if (turn !== generation.current) return;
      setResult(data); onInstalled(data); toast.success('New agent created');
    } catch (e) { if (turn === generation.current) setError(e instanceof Error ? e.message : 'Agent creation failed'); }
    finally { if (turn === generation.current) setBusy(null); }
  }
  return <div onClick={() => !busy && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.65)' }}>
    <section role="dialog" aria-modal="true" aria-labelledby="import-agent-title" onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: 'min(92vw,560px)', maxHeight: '85vh', overflowY: 'auto', padding: 20, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 id="import-agent-title" style={{ margin: 0, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><Package size={19} /> Import agent</h2>
        <button aria-label="Close import" style={button} disabled={!!busy} onClick={onClose}><X size={16} /></button>
      </div>
      {!result && <>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Inspect a Claws package or an older Agentar archive. Import always creates a new agent managed by Micelclaw.</p>
        <div onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const chosen = e.dataTransfer.files[0]; if (chosen && !busy) void inspect(chosen); }} style={{ ...box, borderStyle: 'dashed', borderColor: dragging ? 'var(--amber)' : 'var(--border)' }}>
          <button style={button} disabled={!!busy} onClick={() => input.current?.click()}><Upload size={14} /> {file ? 'Choose another package' : 'Choose package'}</button>
          <span style={{ marginLeft: 8, fontSize: 12 }}>{file?.name ?? '.tgz or .tar.gz · up to 16 MiB'}</span>
          <input ref={input} type="file" accept=".tar.gz,.tgz,application/gzip" style={{ display: 'none' }} disabled={!!busy} onChange={e => { const f = e.target.files?.[0]; if (f) void inspect(f); e.target.value = ''; }} />
        </div>
        {busy === 'inspect' && <p role="status"><Loader2 size={15} className="animate-spin" /> Inspecting and validating package…</p>}
        {preview && <>
          <div style={box}>
            <strong>{preview.manifest.display_name}</strong> <span style={{ color: 'var(--text-muted)' }}>v{preview.manifest.version} · {preview.format === 'claws' ? 'Claws' : 'Legacy Agentar'}</span>
            {preview.manifest.description && <p>{preview.manifest.description}</p>}
            <p style={{ fontSize: 12 }}>Model: {preview.manifest.model ?? 'Configure after import'} · {preview.file_count} inspected files</p>
            <p style={{ fontSize: 12 }}>Apps, permissions, schedules and connections are never granted by the package.</p>
          </div>
          <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>New agent name
            <input value={name} maxLength={31} disabled={!!busy} onChange={e => setName(e.target.value)} aria-label="New agent name" style={{ ...button, cursor: 'text' }} />
          </label>
          {preview.embedded_skills.length > 0 && <fieldset style={box}><legend>Skill instructions to include</legend>
            <p style={{ fontSize: 12 }}>These files add instructions, not tool permissions.</p>
            {preview.embedded_skills.map(skill => <label key={skill} style={{ display: 'flex', gap: 8, padding: 4 }}><input type="checkbox" checked={skills.includes(skill)} disabled={!!busy} onChange={e => setSkills(old => e.target.checked ? [...old, skill] : old.filter(s => s !== skill))} />{skill}</label>)}
          </fieldset>}
          {preview.format === 'agentar' && preview.private_files.length > 0 && <fieldset style={{ ...box, borderColor: 'var(--warning, #d4a017)' }}><legend>Private data in the legacy package</legend>
            <p style={{ fontSize: 12 }}>Excluded by default. Include only if you intend to copy the original person's information.</p>
            {preview.private_files.includes('USER.md') && <label style={{ display: 'block' }}><input type="checkbox" disabled={!!busy} checked={includeUser} onChange={e => setIncludeUser(e.target.checked)} /> Include USER.md</label>}
            {preview.private_files.includes('MEMORY.md') && <label style={{ display: 'block' }}><input type="checkbox" disabled={!!busy} checked={includeMemory} onChange={e => setIncludeMemory(e.target.checked)} /> Include MEMORY.md</label>}
          </fieldset>}
          <div style={box}><strong style={{ fontSize: 13 }}>Inspected files</strong><ul style={{ paddingLeft: 20, fontSize: 12, overflowWrap: 'anywhere', maxHeight: 150, overflowY: 'auto' }}>{preview.files.map(f => <li key={f.path}>{f.path} · {f.bytes} bytes</li>)}</ul></div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>Not imported: {preview.excluded_fields.join(', ')}.<br />Package SHA-256: <code>{preview.preview_hash}</code></div>
        </>}
      </>}
      {error && <p role="alert" style={{ ...box, color: 'var(--error)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{error}</p>}
      {result && <div style={box}><h3><CheckCircle2 size={18} /> New agent created</h3><p>Core manages this agent. Configure its apps and access through the normal settings.</p><p style={{ fontSize: 12 }}>Imported: {result.installed_files.join(', ') || 'Portable identity only'}</p>{result.missing_skills.length > 0 && <p style={{ fontSize: 12 }}>Review requirements in MicelHub: {result.missing_skills.join(', ')}</p>}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button style={button} disabled={!!busy} onClick={onClose}>{result ? 'Done' : 'Cancel'}</button>
        {!result && preview && <button style={{ ...button, background: 'var(--amber)', color: '#000', opacity: busy ? .6 : 1 }} disabled={!!busy || !preview.valid || !/^[a-z][a-z0-9_-]{0,30}$/.test(name)} onClick={() => void create()}>{busy === 'create' ? 'Creating…' : 'Create with this configuration'}</button>}
      </div>
    </section>
  </div>;
}
