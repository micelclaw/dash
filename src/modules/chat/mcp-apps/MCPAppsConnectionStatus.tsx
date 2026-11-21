import { useEffect, useState } from 'react';
import { mcpAppsService } from '@/services/mcp-apps.service';
export function MCPAppsConnectionStatus() {
 const [state, setState] = useState<Awaited<ReturnType<typeof mcpAppsService.status>> | null>(null); const [error, setError] = useState('');
 useEffect(() => { let active = true; void mcpAppsService.status().then(data => { if (active) setState(data); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not check Apps'); }); return () => { active = false; }; }, []);
 return <section aria-label="MCP Apps connection" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}><strong>MCP Apps</strong>{error ? <p role="alert">{error}</p> : !state ? <p>Checking secure App support…</p> : <><p>{state.enabled && state.runtime_ready && state.origin_configured ? 'App support is configured. Open an advertised App from your conversation to check the connection.' : !state.enabled ? 'Apps are not enabled on this installation.' : !state.origin_configured ? 'The secure App host still needs configuration.' : 'The installation needs its compatible runtime.'}</p><span style={{ color: 'var(--text-muted)' }}>Available interfaces, file viewers and server settings appear only when the server advertises them and your access permits them.</span></>}</section>;
}
