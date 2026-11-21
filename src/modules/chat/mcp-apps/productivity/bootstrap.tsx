import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createAppClient } from './app-client';
import { createProductivityTransport } from './transport';
import { DraftsContext } from './drafts';
import type { Params, ProductivityArea, ProductivityContext, ProductivityTransport } from './types';
import { titles } from './types';
import { parseProductivityContext } from './reference';
import { ProductivityErrorBoundary } from './ProductivityErrorBoundary';
import './productivity.css';

type View = ComponentType<{ context: ProductivityContext; transport: ProductivityTransport }>;
const record = (value: unknown): Params => value && typeof value === 'object' && !Array.isArray(value) ? value as Params : {};
function contextFrom(host: unknown, area: ProductivityArea): ProductivityContext | null {
 return parseProductivityContext(record(host)['micelclaw/productivity'], area);
}
export function mountProductivityApp(area: ProductivityArea, View: View) {
 const client = createAppClient(window, window.parent); const transport = createProductivityTransport(client.rpc);
 function App() {
  const [context, setContext] = useState<ProductivityContext | null>(null); const [pending, setPending] = useState<ProductivityContext | null>(null); const [error, setError] = useState('');
  const current = useRef<ProductivityContext | null>(null); const dirty = useRef(new Set<string>());
  const drafts = useMemo(() => ({ mark(id: string, value: boolean) { if (value) dirty.current.add(id); else dirty.current.delete(id); } }), []);
  useEffect(() => {
   let active = true; let retired = false;
   const receive = (host: unknown) => {
    if (retired) return;
    const next = contextFrom(host, area); if (!next) { setError('Esta vista necesita un resultado asociado a la conversación.'); return; }
    const old = current.current;
    if (old && (old.conversation_id !== next.conversation_id || old.erp_profile_id !== next.erp_profile_id)) {
     retired = true; dirty.current.clear(); current.current = null; setPending(null); setContext(null); setError('El contexto de acceso ha cambiado. Vuelve a abrir la vista desde la conversación.'); return;
    }
    if (old?.id === next.id) return;
    if (dirty.current.size && old) { setPending(next); return; }
    current.current = next; setPending(null); setContext(next); setError('');
   };
   const unsubscribe = client.subscribe((method, params) => { if (method === 'ui/notifications/host-context-changed' && 'micelclaw/productivity' in params) receive(params); });
   void client.rpc('ui/initialize', { protocolVersion: '2026-01-26', appInfo: { name: `Micelclaw ${titles[area]}`, version: '1' }, appCapabilities: {} }).then(result => {
    if (!active) return; receive(record(result).hostContext); client.notify('ui/notifications/initialized');
   }).catch(() => { if (active) setError('No se pudo conectar esta vista con el Canvas. Vuelve a abrirla.'); });
   return () => { active = false; unsubscribe(); };
  }, []);
  return <TooltipProvider><DraftsContext.Provider value={drafts}><main className="productivity-app" lang="es"><header><h1>{titles[area]}</h1></header>
   {error ? <p role="alert">{error}</p> : context ? <>
    {pending && <aside role="status">Hay otro resultado de Francis. Tu borrador sigue aquí. <button onClick={() => { const old = current.current; if (!old || old.conversation_id !== pending.conversation_id || old.erp_profile_id !== pending.erp_profile_id) { setPending(null); return; } dirty.current.clear(); current.current = pending; setContext(pending); setPending(null); }}>Descartar borrador y ver el nuevo resultado</button></aside>}
    <ProductivityErrorBoundary key={`${context.conversation_id}:${context.erp_profile_id}:${context.id}`}><View context={context} transport={transport} /></ProductivityErrorBoundary>
   </> : <p role="status">Conectando con la conversación…</p>}
  </main></DraftsContext.Provider></TooltipProvider>;
 }
 const element = document.getElementById('app'); if (!element) return;
 const root = createRoot(element); root.render(<App />);
 window.addEventListener('pagehide', () => { root.unmount(); client.close(); }, { once: true });
}
