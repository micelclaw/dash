import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAgentDecisionModel,
  listDecisionModels,
  testAgentDecisionModel,
  updateAgentDecisionModel,
  DECISION_MODELS_CHANGED,
  type AgentDecisionModelState,
  type DecisionModelEntry,
} from '@/services/agents-admin.service';

export function AgentDecisionModel({ agentId }: { agentId: string }) {
  const activeAgent = useRef(agentId);
  const activeGeneration = useRef(0);
  activeAgent.current = agentId;
  const [state, setState] = useState<AgentDecisionModelState | null>(null);
  const [models, setModels] = useState<DecisionModelEntry[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selection, setSelection] = useState('inherit');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [text, setText] = useState('Necesito cambiar la fecha de una reunión con el equipo.');
  const [testType, setTestType] = useState<'choice' | 'score' | 'boolean'>('choice');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    activeGeneration.current++;
    setState(null); setResult(null); setSelection('inherit'); setLoadError(null);
    setSaving(false); setTesting(false); setTestOpen(false); setModels([]); setCatalogLoaded(false); setCatalogError(null);
    getAgentDecisionModel(agentId).then((next) => {
      if (!active) return;
      setState(next);
      setSelection(next.mode === 'model' ? `model:${next.model}` : next.mode);
    }).catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : 'No se pudo cargar el modelo de decisión'); });
    listDecisionModels().then((catalog) => {
      if (!active) return;
      setModels(catalog.models ?? []);
      setCatalogLoaded(true);
      setCatalogError(null);
    }).catch((error) => { if (active) setCatalogError(error instanceof Error ? error.message : 'No se pudo cargar el catálogo'); });
    return () => { active = false; activeGeneration.current++; };
  }, [agentId]);

  useEffect(() => {
    let active = true;
    const refresh = (event: Event) => {
      const changedId = (event as CustomEvent<{ agentId?: string }>).detail?.agentId;
      if (changedId && changedId !== agentId) return;
      void Promise.all([getAgentDecisionModel(agentId), listDecisionModels()]).then(([next, catalog]) => {
        if (!active) return;
        // Refresh effective state; never discard an unsaved selector draft.
        setState(next); setModels(catalog.models ?? []); setCatalogLoaded(true); setCatalogError(null);
      }).catch(error => { if (active) setCatalogError(error instanceof Error ? error.message : 'No se pudo actualizar el catálogo'); });
    };
    window.addEventListener(DECISION_MODELS_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(DECISION_MODELS_CHANGED, refresh); };
  }, [agentId]);

  const retryCatalog = async () => {
    setCatalogError(null);
    try {
      const catalog = await listDecisionModels();
      setModels(catalog.models ?? []);
      setCatalogLoaded(true);
    } catch (error) { setCatalogError(error instanceof Error ? error.message : 'No se pudo cargar el catálogo'); }
  };

  const refs = useMemo(() => new Set(models.map((model) => `${model.provider}/${model.id}`)), [models]);
  const savedUnavailable = state?.mode === 'model' && state.model && !refs.has(state.model) ? state.model : null;

  const save = async () => {
    const generation = activeGeneration.current;
    setSaving(true);
    try {
      const body = selection.startsWith('model:')
        ? { mode: 'model' as const, model: selection.slice(6) }
        : { mode: selection as 'inherit' | 'disabled' };
      const next = await updateAgentDecisionModel(agentId, body);
      if (activeAgent.current !== agentId || activeGeneration.current !== generation) return;
      setState(next);
      toast.success('Modelo de decisión guardado');
    } catch (error) { if (activeAgent.current === agentId && activeGeneration.current === generation) toast.error(error instanceof Error ? error.message : 'No se pudo guardar'); }
    finally { if (activeAgent.current === agentId && activeGeneration.current === generation) setSaving(false); }
  };

  const runTest = async () => {
    if (!text.trim()) return;
    const generation = activeGeneration.current;
    setTesting(true); setResult(null);
    try {
      const next = await testAgentDecisionModel(agentId, {
        type: testType, text,
        criteria: testType === 'choice'
          ? { Calendario: 'Reuniones, fechas y agenda', Correo: 'Lectura y gestión de mensajes', Tareas: 'Seguimiento del trabajo' }
          : testType === 'score'
            ? ['No prioritario', 'Prioridad media', 'Urgente']
            : { true: 'Sí, requiere actuación', false: 'No requiere actuación' },
      });
      if (activeAgent.current !== agentId || activeGeneration.current !== generation) return;
      setResult(next);
    } catch (error) { if (activeAgent.current === agentId && activeGeneration.current === generation) toast.error(error instanceof Error ? error.message : 'La evaluación ha fallado'); }
    finally { if (activeAgent.current === agentId && activeGeneration.current === generation) setTesting(false); }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
      <div>
        <strong style={{ fontSize: '0.82rem', color: 'var(--text)' }}>Modelo de decisión</strong>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Clasificación ligera y pruebas manuales; no cambia la delegación del agente.</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select value={selection} onChange={(event) => setSelection(event.target.value)} style={{ flex: '1 1 300px', minWidth: 0, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px' }}>
          <option value="inherit">Heredar configuración global</option>
          <option value="disabled">Desactivado para este agente</option>
          {savedUnavailable && <option value={`model:${savedUnavailable}`}>{savedUnavailable} · {catalogLoaded ? 'No disponible' : 'Catálogo pendiente'}</option>}
          {models.map((model) => {
            const ref = `${model.provider}/${model.id}`;
            return <option key={ref} value={`model:${ref}`} disabled={model.availability === false}>{model.label ?? model.name ?? ref}{model.availability === false ? ' · No disponible' : ''}</option>;
          })}
        </select>
        <button disabled={saving || !state} onClick={() => void save()} style={buttonStyle}>{saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}</button>
        <button disabled={!state?.effective_model} onClick={() => setTestOpen((value) => !value)} style={buttonStyle}><Play size={14} /> Probar decisión</button>
      </div>
      <span style={{ fontSize: '0.72rem', color: state?.effective_model ? 'var(--text-dim)' : 'var(--text-muted)' }}>Efectivo: {state?.effective_model ?? 'Desactivado'}</span>
      {loadError && <p role="alert" style={{ fontSize: '0.72rem', color: 'var(--error)', margin: 0 }}>{loadError}</p>}
      {state?.assistance && <div style={{ display: 'grid', gap: 4, color: 'var(--text-dim)', fontSize: '0.72rem' }}>
        <span>Herramienta de decisión: {state.assistance.native_tool_available === true ? 'nativa disponible' : state.assistance.native_tool_available === false ? 'no disponible en este runtime' : 'disponibilidad nativa sin comprobar'}</span>
        <span>Asistencia automática: {state.assistance.effective === true ? 'activa en peticiones compatibles' : state.assistance.reason === 'disabled' ? 'desactivada' : state.assistance.reason === 'decision-model-missing' ? 'falta un modelo efectivo' : state.assistance.reason === 'unsupported-runtime' ? 'runtime no compatible' : 'compatibilidad del runtime pendiente de comprobar'}</span>
        {state.assistance.configured && <span>Usa la petición y hasta dos intercambios recientes; puede enviar contexto al proveedor y generar coste. No concede permisos.</span>}
      </div>}
      {catalogError && <div role="status" style={{ fontSize: '0.72rem', color: 'var(--amber)' }}>Catálogo temporalmente no disponible. La selección guardada sigue visible. <button onClick={() => void retryCatalog()} style={buttonStyle}>Reintentar catálogo</button></div>}
      {testOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {selection !== (state?.mode === 'model' ? `model:${state.model}` : state?.mode) && <div style={{ padding: 8, borderRadius: 6, background: 'color-mix(in srgb, var(--amber) 12%, transparent)', color: 'var(--amber)', fontSize: '0.72rem' }}>La prueba usa el modelo guardado; hay cambios sin guardar.</div>}
          <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Modalidad
            <select value={testType} onChange={(event) => setTestType(event.target.value as typeof testType)} style={{ ...buttonStyle, marginLeft: 8 }}><option value="choice">Clasificación</option><option value="score">Puntuación</option><option value="boolean">Sí / no</option></select>
          </label>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{testType === 'choice' ? 'Calendario, Correo o Tareas' : testType === 'score' ? 'No prioritario → Prioridad media → Urgente' : 'Requiere actuación o no'}</span>
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} style={{ resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 7, padding: 9 }} />
          <button disabled={testing || !text.trim()} onClick={() => void runTest()} style={{ ...buttonStyle, alignSelf: 'flex-start' }}>{testing ? <Loader2 size={14} className="animate-spin" /> : 'Evaluar'}</button>
          {result && <DecisionResult result={result} />}
        </div>
      )}
    </section>
  );
}

function DecisionResult({ result }: { result: Record<string, unknown> }) {
  const envelope = result.result && typeof result.result === 'object' ? result.result as Record<string, unknown> : result;
  const nested = envelope.result && typeof envelope.result === 'object' ? envelope.result as Record<string, unknown> : envelope;
  const answers = nested.answers && typeof nested.answers === 'object' ? nested.answers as Record<string, unknown> : {};
  const answer = answers.result && typeof answers.result === 'object' ? answers.result as Record<string, unknown> : {};
  const provenance = envelope.provenance && typeof envelope.provenance === 'object' ? envelope.provenance as Record<string, unknown> : {};
  const model = String(nested.model ?? provenance.provider_id ?? result.model ?? 'Modelo efectivo del agente');
  const duration = Number(result.duration_ms ?? nested.latency_ms ?? 0);
  const selected = answer.choice ?? answer.score;
  const probabilities = answer.probabilities && typeof answer.probabilities === 'object'
    ? Object.entries(answer.probabilities as Record<string, unknown>)
    : [];
  return <div style={{ display: 'grid', gap: 7, padding: 10, borderRadius: 7, background: 'var(--bg)', color: 'var(--text-dim)', fontSize: '0.72rem' }}>
    <strong style={{ color: 'var(--text)' }}>Resultado: {selected === undefined ? 'Respuesta recibida' : String(selected)}</strong>
    <span>Modelo: {model} · Duración: {duration ? `${duration} ms` : 'no informada'}</span>
    {probabilities.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{probabilities.map(([key, value]) => <span key={key} style={{ padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 5 }}>{key}: {typeof value === 'number' ? `${Math.round(value * 100)} %` : String(value)}</span>)}</div>}
    {typeof answer.probability_true === 'number' && <span>Probabilidad de “sí”: {Math.round(answer.probability_true * 100)} %</span>}
    <span>Las probabilidades son estimaciones: no garantizan acierto ni conceden permisos.</span>
    <details><summary style={{ cursor: 'pointer' }}>Respuesta técnica</summary><pre style={{ margin: '8px 0 0', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre></details>
  </div>;
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 7, padding: '8px 11px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
};
