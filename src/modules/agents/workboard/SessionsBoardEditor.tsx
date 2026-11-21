import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { sessionsBoardApi as service, type SessionColumn, type SessionRule, type SessionSnapshot, type WorkboardAgentOption } from './sessions-board.service';
import { SESSION_BOARD_COLORS } from './sessions-board-colors';
const choices = { health: ['on-track', 'grinding', 'stuck', 'waiting-on-user', 'wrapping-up', 'done', 'failed'], run: ['active', 'idle', 'failed'], pull_request: ['none', 'open', 'draft', 'merged', 'closed'] } as const;
const label: Record<string, string> = { 'on-track': 'En marcha', grinding: 'Persistiendo', stuck: 'Atascada', 'waiting-on-user': 'Espera tu respuesta', 'wrapping-up': 'Finalizando', done: 'Terminada', failed: 'Error', active: 'Activo', idle: 'En reposo', none: 'Sin PR', open: 'Abierta', draft: 'Borrador', merged: 'Integrada', closed: 'Cerrada' };
export function SessionsBoardEditor({ snapshot, agents, onSaved, onCancel }: { snapshot: SessionSnapshot; agents: WorkboardAgentOption[]; onSaved(): void; onCancel(): void }) {
  const [name, setName] = useState(snapshot.board.name), [icon, setIcon] = useState(snapshot.board.icon ?? ''), [color, setColor] = useState(snapshot.board.color ?? '');
  const [clearAppearance, setClearAppearance] = useState(false), [columns, setColumns] = useState<SessionColumn[]>(structuredClone(snapshot.columns));
  const [scope, setScope] = useState({ ...snapshot.board.scope }), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const modify = (index: number, change: Partial<SessionColumn>) => setColumns(previous => previous.map((column, i) => i === index ? { ...column, ...change } : column));
  const reorder = (from: number, delta: number) => setColumns(previous => { const next = [...previous], to = from + delta; if (to < 0 || to >= next.length) return previous; [next[from], next[to]] = [next[to]!, next[from]!]; return next; });
  const save = async () => {
    if (!name.trim() || columns.some(column => !column.label.trim() || !column.description?.trim()) || columns.length < 2 || columns.filter(column => column.fallback).length !== 1) { setError('Añade al menos dos columnas y elige una como destino por defecto.'); return; }
    setBusy(true); setError(''); let rulesSaved = false;
    try {
      if (JSON.stringify(columns) !== JSON.stringify(snapshot.columns) || JSON.stringify(scope) !== JSON.stringify(snapshot.board.scope ?? {})) {
        await service.update(snapshot.board.id, columns, scope, snapshot.configuration_revision); rulesSaved = true;
      }
      if (name !== snapshot.board.name || icon !== (snapshot.board.icon ?? '') || color !== (snapshot.board.color ?? '') || clearAppearance)
        await service.appearance(snapshot.board.id, { name, icon, color, ...(clearAppearance ? { clearAppearance: ['icon', 'color'] } : {}) });
      toast.success('Tablero guardado'); onSaved();
    } catch (cause) { setError(`${rulesSaved ? 'Las reglas se guardaron, pero la apariencia sigue pendiente. ' : ''}${cause instanceof Error ? cause.message : 'No se pudo guardar.'}`); }
    finally { setBusy(false); }
  };
  return <section aria-label="Editar tablero" className="flex min-w-0 flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
    <h4 className="font-semibold">Editar tablero</h4>
    <div className="grid gap-3 sm:grid-cols-3"><label>Nombre<Input aria-label="Nombre del tablero" value={name} onChange={e => setName(e.target.value)} /></label><label>Icono<Input aria-label="Icono del tablero" value={icon} maxLength={32} onChange={e => setIcon(e.target.value)} /></label><label>Color<Input aria-label="Color del tablero" value={color} maxLength={64} onChange={e => setColor(e.target.value)} /></label></div>
    <label className="text-sm"><input type="checkbox" checked={clearAppearance} onChange={e => setClearAppearance(e.target.checked)} /> Restaurar icono y color originales</label>
    <div className="flex flex-wrap items-center justify-between gap-2"><h5 className="font-medium">Columnas y reglas</h5><Button variant="outline" disabled={columns.length >= 12} onClick={() => setColumns([...columns, { id: `column-${crypto.randomUUID().slice(0, 8)}`, label: 'Nueva columna', description: 'Columna de conversaciones', match: { run: ['idle'] } }])}><Plus size={14} /> Columna</Button></div>
    <p className="text-xs text-[var(--text-muted)]">Se aplica la primera regla que coincide. Las alternativas se unen con «o»; los grupos salud, ejecución y PR se combinan con «y». La colocación manual tiene prioridad.</p>
    {columns.map((column, index) => <fieldset key={column.id} className="min-w-0 rounded-lg border border-[var(--border)] p-3"><legend className="px-1 text-sm">{index + 1}. {column.label}</legend>
      <div className="flex flex-wrap gap-2"><Input className="min-w-36 flex-1" aria-label={`Nombre columna ${index + 1}`} value={column.label} maxLength={60} onChange={e => modify(index, { label: e.target.value })} /><Input className="min-w-36 flex-1" aria-label={`Descripción columna ${index + 1}`} value={column.description ?? ''} maxLength={400} onChange={e => modify(index, { description: e.target.value })} />
        <Button variant="ghost" aria-label={`Subir columna ${index + 1}`} disabled={index === 0} onClick={() => reorder(index, -1)}><ArrowUp size={14} /></Button><Button variant="ghost" aria-label={`Bajar columna ${index + 1}`} disabled={index === columns.length - 1} onClick={() => reorder(index, 1)}><ArrowDown size={14} /></Button>
        <Button variant="ghost" aria-label={`Eliminar columna ${index + 1}`} disabled={columns.length <= 2} onClick={() => setColumns(columns.filter((_, i) => i !== index))}><Trash2 size={14} /></Button></div>
      <div className="mt-2 flex flex-wrap items-center gap-1" aria-label={`Color columna ${index + 1}`}><span className="mr-2 text-xs">Color</span>{Object.entries(SESSION_BOARD_COLORS).map(([value, item]) => <Button key={value} size="sm" variant={column.color === value ? 'secondary' : 'ghost'} aria-label={`Color ${item.label} columna ${index + 1}`} onClick={() => modify(index, { color: value })}><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</Button>)}</div>
      <label className="mt-2 block text-sm"><input type="radio" name="fallback-column" checked={column.fallback === true} onChange={() => setColumns(columns.map((item, i) => ({ ...item, fallback: i === index })))} /> Destino por defecto</label>
      {(column.match ? Array.isArray(column.match) ? column.match : [column.match] : [{}]).map((rule, ruleIndex, rules) => <div key={ruleIndex} className="mt-3 border-t border-[var(--border)] pt-2">
        <span className="text-xs font-medium">Alternativa {ruleIndex + 1}</span>
        {(Object.keys(choices) as Array<keyof typeof choices>).map(field => <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs" key={field}><span className="w-16 font-medium">{field === 'health' ? 'Salud' : field === 'run' ? 'Ejecución' : 'PR'}</span>{choices[field].map(choice => <label key={choice} className="inline-flex items-center gap-1"><input type="checkbox" checked={rule[field]?.includes(choice) ?? false} onChange={e => {
          const nextRules = rules.map(item => ({ ...item })); const values = rule[field] ?? []; const next = e.target.checked ? [...values, choice] : values.filter(value => value !== choice); const changed: SessionRule = { ...rule }; if (next.length) changed[field] = next; else delete changed[field]; nextRules[ruleIndex] = changed; modify(index, { match: nextRules.length === 1 ? nextRules[0] : nextRules });
        }} />{label[choice] ?? choice}</label>)}</div>)}
        <label className="mt-2 block text-xs"><input type="checkbox" checked={rule.archived === true} onChange={e => { const next = [...rules]; next[ruleIndex] = { ...rule, archived: e.target.checked ? true : undefined }; modify(index, { match: next }); }} /> Solo archivadas</label>
        {rules.length > 1 && <Button variant="ghost" onClick={() => modify(index, { match: rules.filter((_, i) => i !== ruleIndex) })}>Quitar alternativa</Button>}
      </div>)}
      <Button variant="ghost" className="mt-2" onClick={() => modify(index, { match: [...(column.match ? Array.isArray(column.match) ? column.match : [column.match] : []), { run: ['idle'] }] })}>Añadir alternativa «o»</Button>
    </fieldset>)}
    <fieldset className="rounded-lg border border-[var(--border)] p-3"><legend>Conversaciones incluidas</legend><div className="mb-3 flex flex-wrap gap-3 text-xs"><span>Agentes · sin selección se incluyen todos:</span>{agents.map(agent => <label key={agent.id}><input type="checkbox" checked={scope.agent_ids?.includes(agent.id) ?? false} onChange={e => setScope({ ...scope, agent_ids: e.target.checked ? [...(scope.agent_ids ?? []), agent.id] : scope.agent_ids?.filter(id => id !== agent.id) })} /> {agent.label}</label>)}</div><div className="flex flex-wrap gap-4 text-sm">
      <label><input type="checkbox" checked={scope.include_archived ?? false} onChange={e => setScope({ ...scope, include_archived: e.target.checked })} /> Archivadas</label><label><input type="checkbox" checked={scope.include_automation ?? false} onChange={e => setScope({ ...scope, include_automation: e.target.checked })} /> Automatizaciones</label><label><input type="checkbox" checked={scope.include_home ?? false} onChange={e => setScope({ ...scope, include_home: e.target.checked })} /> Conversaciones de inicio</label>
      <label className="flex items-center gap-2">Últimas horas<Input className="w-24" aria-label="Horas incluidas" type="number" min={1} max={87600} value={scope.max_age_hours ?? 72} onChange={e => setScope({ ...scope, max_age_hours: Number(e.target.value) })} /></label></div></fieldset>
    {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
    <div className="flex gap-2"><Button disabled={busy} onClick={() => void save()}>Guardar tablero</Button><Button variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button></div>
  </section>;
}
