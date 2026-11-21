import { useEffect, useState } from 'react';
import { mcpAppsService, type McpAppApproval } from '@/services/mcp-apps.service';

/** Render in the conversation, never inside an untrusted App or its panel. */
export function MCPAppApprovalList({ conversationId }: { conversationId: string | null }) {
 const [items, setItems] = useState<McpAppApproval[]>([]); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState('');
 useEffect(() => {
  setItems([]); setError(''); if (!conversationId) return;
  const controller = new AbortController(); let running = false;
  const refresh = async () => { if (running) return; running = true; try { const result = await mcpAppsService.approvals(conversationId, controller.signal); if (!controller.signal.aborted) setItems(result); } catch { if (!controller.signal.aborted) setItems([]); } finally { running = false; } };
  void refresh(); const timer = setInterval(() => void refresh(), 800);
  return () => { controller.abort(); clearInterval(timer); };
 }, [conversationId]);
 async function decide(item: McpAppApproval, decision: 'once' | 'open' | 'deny') {
  if (!conversationId || busy) return; setBusy(item.id); setError('');
  try { await mcpAppsService.approve(conversationId, item.id, decision); setItems(old => old.filter(i => i.id !== item.id)); }
  catch (e) { setError(e instanceof Error ? e.message : 'Could not resolve the App request'); }
  finally { setBusy(null); }
 }
 if (!items.length && !error) return null;
 return <section data-mcp-app-approvals aria-label="App requests in this conversation" style={{ display: 'grid', gap: 8, padding: '10px 16px' }}>
  {items.map(item => <article key={item.id} style={{ border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)', padding: 12 }}>
   <strong style={{ fontSize: 13 }}>App requests permission</strong><p style={{ fontSize: 12, margin: '5px 0' }}><code>{item.tool}</code> · this conversation only</p>
   <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Temporary permission expires when the App closes or after ten minutes. It does not authorize the model or change saved permissions.</p>
   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{(['once', 'open', 'deny'] as const).filter(decision => decision !== 'open' || item.allow_while_open === true).map(decision => <button key={decision} disabled={!!busy || item.expires_at <= Date.now()} onClick={() => void decide(item, decision)} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: decision === 'deny' ? 'transparent' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>{decision === 'once' ? 'Allow once' : decision === 'open' ? 'While this App is open' : 'Deny'}</button>)}</div>
  </article>)}
  {error && <p role="alert" style={{ color: 'var(--error)', fontSize: 12 }}>{error}</p>}
 </section>;
}
