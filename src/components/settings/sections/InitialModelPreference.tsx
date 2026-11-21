import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
type Policy = 'agent-default' | 'last-used';
export function InitialModelPreference() {
  const owner = useAuthStore(state => state.user?.id);
  const [policy, setPolicy] = useState<Policy>('agent-default'), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let active = true; setLoading(true); setPolicy('agent-default'); setError('');
    void api.get<{ data: { initial_model_policy: Policy } }>('/chat/personal-preferences').then(result => { if (active) setPolicy(result.data.initial_model_policy); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo leer tu preferencia.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [owner]);
  const save = async (value: Policy) => { const initialOwner = owner; setBusy(true); try { await api.put('/chat/personal-preferences', { initial_model_policy: value }); if (useAuthStore.getState().user?.id !== initialOwner) return; setPolicy(value); setError(''); toast.success('Preferencia personal guardada'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); } finally { setBusy(false); } };
  return <section className="rounded-lg border border-[var(--border)] p-3" aria-label="Modelo inicial de mis conversaciones"><h4 className="text-sm font-medium">Modelo inicial de mis conversaciones</h4><p className="mt-1 text-xs text-[var(--text-muted)]">Solo se aplica al abrir una conversación nueva. Las conversaciones existentes conservan su modelo. El último utilizado debe seguir disponible para tu agente.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant={policy === 'agent-default' ? 'secondary' : 'outline'} disabled={loading || busy} onClick={() => void save('agent-default')}>Configurado en el agente</Button><Button variant={policy === 'last-used' ? 'secondary' : 'outline'} disabled={loading || busy} onClick={() => void save('last-used')}>Último utilizado por mí</Button></div>{error && <p role="alert" className="mt-2 text-xs text-[var(--error)]">{error}</p>}</section>;
}
