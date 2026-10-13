import { useEffect, useMemo, useState } from 'react';
import { Cpu, Loader2, Server, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import type { DecisionModelEntry } from '@/services/agents-admin.service';
import { useAuthStore } from '@/stores/auth.store';

interface DecisionCatalog {
  models: DecisionModelEntry[];
  default_model: string | null;
  providers: Array<{ id: string; model_count: number; active: boolean; configured: boolean | null }>;
  typesafe_mode: 'jev-hosted' | 'kev-local';
  kev_status: { state: 'stopped' | 'starting' | 'running' | 'draining' | 'failed'; installed: boolean; error?: string | null } | null;
}

export function DecisionModelsView() {
  const role = useAuthStore((state) => state.user?.role ?? 'user');
  const canManageGlobal = role === 'owner' || role === 'admin';
  const [data, setData] = useState<DecisionCatalog | null>(null);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ data: DecisionCatalog }>('/gateway/decision-models');
      setData(response.data);
      setValue(response.data.default_model ?? '');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cargar el catálogo de decisión'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, DecisionModelEntry[]>();
    for (const model of data?.models ?? []) map.set(model.provider, [...(map.get(model.provider) ?? []), model]);
    return [...map];
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await api.patch<{ data: { default_model: string; affected_agents: string[] } }>('/gateway/decision-models/default', { model: value }, { timeout: 240_000 });
      setData((current) => current ? { ...current, default_model: response.data.default_model } : current);
      toast.success(response.data.affected_agents.length ? `Guardado; revisa ${response.data.affected_agents.length} agentes TypeSafe` : 'Modelo de decisión predeterminado guardado');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const setTypesafeMode = async (mode: DecisionCatalog['typesafe_mode']) => {
    if (mode === data?.typesafe_mode) return;
    setModeBusy(true);
    try {
      const response = await api.patch<{ data: { mode: DecisionCatalog['typesafe_mode']; affected_agents: string[] } }>('/gateway/decision-models/typesafe-mode', { mode }, { timeout: 240_000 });
      toast.success(response.data.affected_agents.length ? `Modo cambiado; revisa ${response.data.affected_agents.length} agentes TypeSafe` : 'Modo TypeSafe actualizado');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el modo TypeSafe'); }
    finally { setModeBusy(false); }
  };

  const manageKev = async (action: 'start' | 'stop') => {
    setServiceBusy(true);
    try {
      await api.post(`/gateway/decision-models/kev/${action}`, {}, { timeout: action === 'start' ? 200_000 : 30_000 });
      toast.success(action === 'start' ? 'Servidor Kev iniciado' : 'Servidor Kev detenido');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : `No se pudo ${action === 'start' ? 'iniciar' : 'detener'} Kev`); }
    finally { setServiceBusy(false); }
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-dim)' }}>Cargando modelos de decisión…</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={panelStyle}>
        <div><strong style={{ color: 'var(--text)' }}>Modelo de decisión predeterminado</strong><p style={helpStyle}>Los agentes pueden heredarlo, desactivarlo o elegir otro modelo. Guardarlo no inicia evaluaciones.</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={value} disabled={!canManageGlobal} onChange={(event) => setValue(event.target.value)} style={selectStyle}>
            <option value="">Desactivado</option>
            {(data?.models ?? []).map((model) => <option key={`${model.provider}/${model.id}`} value={`${model.provider}/${model.id}`} disabled={model.availability === false}>{model.label ?? model.name ?? `${model.provider}/${model.id}`}{model.availability === false ? ' · No disponible con la conexión actual' : ''}</option>)}
          </select>
          <button onClick={() => void save()} disabled={saving || !canManageGlobal} style={buttonStyle}>{saving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}</button>
        </div>
        {!canManageGlobal && <span style={helpStyle}>Solo owner o admin pueden modificar la configuración global.</span>}
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
        {grouped.map(([provider, models]) => {
          const isOnnx = provider === 'onnx';
          const isTypesafe = provider === 'typesafe';
          return <section key={provider} style={panelStyle}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>{isOnnx ? <Cpu size={18} /> : isTypesafe ? <ShieldCheck size={18} /> : <Server size={18} />}<strong style={{ color: 'var(--text)' }}>{provider}</strong></div>
            <span style={helpStyle}>{models.length} modelos publicados por OpenClaw</span>
            {isOnnx && <span style={statusStyle}>Plugin activo · preparación de cada artefacto se valida al probarlo</span>}
            {isTypesafe && <>
              <label style={helpStyle}>Conexión TypeSafe
                <select value={data?.typesafe_mode ?? 'jev-hosted'} disabled={modeBusy || !canManageGlobal} onChange={(event) => void setTypesafeMode(event.target.value as DecisionCatalog['typesafe_mode'])} style={{ ...selectStyle, marginTop: 5 }}>
                  <option value="jev-hosted">Jev alojado</option>
                  <option value="kev-local">Kev local</option>
                </select>
              </label>
              <span style={statusStyle}>Modo activo: {data?.typesafe_mode === 'kev-local' ? 'Kev local' : 'Jev alojado'} · {data?.providers.find((item) => item.id === provider)?.configured ? 'configurado' : 'pendiente de configurar'}</span>
              {data?.typesafe_mode === 'kev-local' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={helpStyle}>Servidor: {data.kev_status?.state ?? 'no registrado'}{data.kev_status?.installed === false ? ' · no instalado' : ''}</span>
                {data.kev_status?.state === 'running'
                  ? <button onClick={() => void manageKev('stop')} disabled={serviceBusy || !canManageGlobal} style={buttonStyle}>Detener</button>
                  : <button onClick={() => void manageKev('start')} disabled={serviceBusy || !canManageGlobal || data.kev_status?.installed === false} style={buttonStyle}>Iniciar</button>}
              </div>}
            </>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{models.map((model) => <code key={model.id} style={{ fontSize: '0.68rem', color: model.availability === false ? 'var(--error)' : 'var(--text-dim)' }}>{model.id}{model.availability === false ? ' · no disponible' : ''}</code>)}</div>
          </section>;
        })}
      </div>
      {!grouped.length && <section style={panelStyle}><span style={helpStyle}>OpenClaw no publica todavía modelos de decisión. Instala o activa un proveedor compatible y recarga el Gateway.</span></section>}
    </div>
  );
}

const panelStyle = { display: 'flex', flexDirection: 'column', gap: 10, padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' } as const;
const helpStyle = { margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.45 } as const;
const statusStyle = { fontSize: '0.72rem', color: 'var(--text-dim)', padding: '6px 8px', borderRadius: 6, background: 'var(--surface-hover)' } as const;
const selectStyle = { flex: '1 1 340px', minWidth: 0, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' } as const;
const buttonStyle = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-hover)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 } as const;
