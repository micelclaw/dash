import { useEffect, useRef, useState } from 'react';
import { Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { inspectClawsExport, downloadClawsExport, type ClawsExportPreview } from '@/services/agentar.service';
import type { ManagedAgent } from './types';

export function ClawsShareSection({ agent }: { agent: ManagedAgent }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<ClawsExportPreview | null>(null);
  const [busy, setBusy] = useState<'inspect' | 'build' | null>(null);
  const [error, setError] = useState(''); const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const candidates = agent.skills.map(s => s.skill_id ?? s.id).filter(s => /^[a-z0-9][a-z0-9_-]{0,79}$/.test(s));
  async function inspect() {
    const turn = ++generation.current; setBusy('inspect'); setError(''); setPreview(null);
    try { const p = await inspectClawsExport(agent.id, selected); if (generation.current === turn) setPreview(p); }
    catch (e) { if (generation.current === turn) setError(e instanceof Error ? e.message : 'Could not inspect export'); }
    finally { if (generation.current === turn) setBusy(null); }
  }
  async function download() {
    if (!preview || busy) return;
    const turn = ++generation.current; setBusy('build'); setError('');
    try {
      const result = await downloadClawsExport(agent.id, preview, selected);
      if (generation.current !== turn) return;
      const url = URL.createObjectURL(result.blob); const link = document.createElement('a');
      link.href = url; link.download = result.filename; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success('Claws package generated');
    } catch (e) { if (generation.current === turn) { setError(e instanceof Error ? e.message : 'Export failed'); setPreview(null); } }
    finally { if (generation.current === turn) setBusy(null); }
  }
  const button = { padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 };
  return <section style={{ display: 'grid', gap: 10 }} aria-label="Share agent as Claws">
    <h4 style={{ margin: 0 }}>Share &amp; distribute · Claws</h4>
    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Share public identity, instructions and selected skill files. Core keeps managing the agent; this does not create a native Claw installation record.</p>
    {candidates.length > 0 && <fieldset disabled={!!busy} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10 }}><legend style={{ fontSize: 12 }}>Skill instructions to share</legend>{[...new Set(candidates)].map(skill => <label key={skill} style={{ display: 'flex', gap: 7, fontSize: 12, padding: 4 }}><input type="checkbox" checked={selected.includes(skill)} onChange={e => { setSelected(old => e.target.checked ? [...old, skill] : old.filter(s => s !== skill)); setPreview(null); }} />{skill}</label>)}</fieldset>}
    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Always excluded: credentials, USER.md, private memory, sessions, approvals and grants. Review the included instructions before distributing them.</p>
    <button style={button} disabled={!!busy} onClick={() => void inspect()}>{busy === 'inspect' ? 'Inspecting…' : 'Inspect files and differences'}</button>
    {preview && <div style={{ fontSize: 12, overflowWrap: 'anywhere' }}><strong>Included files</strong><ul style={{ paddingLeft: 18 }}>{preview.files.map(file => <li key={file.path}>{file.path} · {file.bytes} bytes</li>)}</ul><p>Excluded fields: {preview.excluded_fields.join(', ')}.</p><p>Snapshot SHA-256: <code>{preview.preview_hash}</code></p><button style={button} disabled={!!busy} onClick={() => void download()}>{busy === 'build' ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />} {busy === 'build' ? 'Validating and building…' : 'Generate Claws package'}</button></div>}
    {error && <p role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>{error}</p>}
  </section>;
}
