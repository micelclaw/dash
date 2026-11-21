import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { useChatWorkspaceStore } from '@/stores/chat-workspace.store';
import { browserViewService, type BrowserControls } from '@/services/browser-view.service';

type Connection = { close(): void; leaseId: string | null };
export default function WorkspaceBrowserLive({ chat, resourceId }: { chat: string; resourceId: string }) {
  const workspace = useChatWorkspaceStore(s => s.byConversation[chat]);
  const activeChat = useChatStore(s => s.activeConversationId);
  const generation = useAuthStore(s => s.sessionGeneration);
  const visible = !!workspace?.panelOpen && workspace.activeId === resourceId && activeChat === chat && !workspace.revoked;
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [notice, setNotice] = useState('Conecta para comprobar si la sesión del agente permite seguimiento privado.');
  const [image, setImage] = useState(''); const [url, setUrl] = useState(''); const [address, setAddress] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [controls, setControls] = useState<BrowserControls | null>(null); const [busy, setBusy] = useState(false);
  const pageUrlRef = useRef('');
  const connection = useRef<Connection | null>(null); const objectUrl = useRef(''); const frame = useRef(0); const host = useRef<HTMLDivElement>(null);
  const disconnect = useCallback(() => {
    connection.current?.close(); connection.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = ''; frame.current = 0;
    setImage(''); setUrl(''); pageUrlRef.current = ''; setCapabilities([]); setControls(null); setBusy(false); setStatus('idle'); setNotice('Seguimiento desconectado. Puedes volver a comprobar el acceso.');
  }, []);
  useEffect(() => { if (!visible) disconnect(); return disconnect; }, [visible, generation, workspace?.epoch, disconnect]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const observer = new IntersectionObserver(entries => { if (!entries[0]?.isIntersecting) disconnect(); });
    observer.observe(element); const hidden = () => { if (document.hidden) disconnect(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', hidden); };
  }, [disconnect]);
  const connect = async () => {
    disconnect(); setStatus('connecting'); setNotice('Comprobando el acceso a la sesión del agente…');
    const epoch = useChatWorkspaceStore.getState().byConversation[chat]?.epoch;
    const requestGeneration = useAuthStore.getState().sessionGeneration;
    const abort = new AbortController(); let socket: WebSocket | null = null; let leaseId: string | null = null;
    let active = true; let renew: ReturnType<typeof setInterval> | undefined; let receiving = false;
    const current = () => active && useAuthStore.getState().sessionGeneration === requestGeneration
      && useChatStore.getState().activeConversationId === chat && useChatWorkspaceStore.getState().byConversation[chat]?.epoch === epoch
      && !useChatWorkspaceStore.getState().byConversation[chat]?.revoked;
    const handle: Connection = { leaseId: null, close() {
      if (!active) return; active = false; abort.abort(); clearInterval(renew); socket?.close();
      if (leaseId && useAuthStore.getState().sessionGeneration === requestGeneration) void browserViewService.close(chat, leaseId).catch(() => {});
    } };
    connection.current = handle;
    const fail = (message: string) => { if (!current()) return; disconnect(); setNotice(message); };
    try {
      const value = await browserViewService.open(chat, abort.signal); leaseId = value.view_id; handle.leaseId = leaseId;
      if (!current()) { handle.close(); if (useAuthStore.getState().sessionGeneration === requestGeneration) void browserViewService.close(chat, value.view_id).catch(() => {}); return; }
      setCapabilities(value.capabilities);
      socket = new WebSocket(browserViewService.streamUrl(chat, leaseId), ['micelclaw.browser.v1', value.stream_nonce]); socket.binaryType = 'arraybuffer';
      socket.onopen = () => { if (current()) { setStatus('connected'); setNotice('Siguiendo la misma página del agente.'); } else handle.close(); };
      socket.onerror = () => fail('No se pudo conectar. Comprueba el acceso y vuelve a intentarlo.');
      socket.onclose = () => fail('El seguimiento terminó o se retiró el acceso. Puedes volver a comprobarlo.');
      socket.onmessage = event => {
        if (!current() || receiving || !(event.data instanceof ArrayBuffer) || event.data.byteLength < 12 || event.data.byteLength > 2100000) return;
        receiving = true;
        try {
          const size = new DataView(event.data).getUint32(0); if (size < 2 || size > 16384 || size + 7 > event.data.byteLength) throw new Error();
          const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(event.data, 4, size)));
          const pageUrl = new URL(meta.url);
          const bytes = new Uint8Array(event.data, size + 4);
          if (!Number.isInteger(meta.frame_id) || meta.frame_id <= frame.current || !['http:', 'https:'].includes(pageUrl.protocol) || pageUrl.username || pageUrl.password || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error();
          if (!current()) return;
          frame.current = meta.frame_id;
          const nextUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
          const previous = objectUrl.current; objectUrl.current = nextUrl; setImage(nextUrl);
          if (pageUrlRef.current !== pageUrl.href) setControls(null);
          pageUrlRef.current = pageUrl.href; setUrl(pageUrl.href);
          if (previous) URL.revokeObjectURL(previous);
        } catch { fail('La imagen recibida no es válida. Vuelve a conectar.'); }
        finally { receiving = false; }
      };
      renew = setInterval(() => { if (current() && leaseId) void browserViewService.renew(chat, leaseId).catch(() => fail('El permiso temporal terminó. Vuelve a conectar.')); }, 30000);
    } catch (error) { fail(error instanceof Error ? error.message : 'Esta sesión aún no permite seguimiento privado.'); }
  };
  const perform = async (action?: Record<string, unknown>) => {
    const id = connection.current?.leaseId; if (!id) return;
    const epoch = useChatWorkspaceStore.getState().byConversation[chat]?.epoch;
    const same = () => generation === useAuthStore.getState().sessionGeneration && epoch === useChatWorkspaceStore.getState().byConversation[chat]?.epoch && connection.current?.leaseId === id;
    setBusy(true);
    try { if (action) { await browserViewService.action(chat, id, action); if (same()) setControls(null); } else { const value = await browserViewService.controls(chat, id, frame.current); if (same()) setControls(value); } }
    catch (error) { if (same()) { setControls(null); setNotice(error instanceof Error ? error.message : 'La página cambió. Actualiza sus controles.'); } }
    finally { if (same()) setBusy(false); }
  };
  return <div ref={host} className="flex min-h-0 flex-1 flex-col overflow-auto">
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-3"><p role="status" className="m-0 flex-1 text-xs text-[var(--text-muted)]">{notice}</p><Button size="sm" disabled={status === 'connecting' || !visible} onClick={() => status === 'connected' ? disconnect() : void connect()}>{status === 'connected' ? 'Desconectar' : status === 'connecting' ? 'Conectando…' : 'Conectar'}</Button></div>
    {image ? <div className="min-h-40 flex-1 bg-black"><p className="m-0 truncate px-3 py-2 text-xs text-white" title={url}>{url}</p><img src={image} alt="Página del agente en directo" className="max-h-[60dvh] w-full object-contain" /></div> : <div className="grid min-h-40 flex-1 place-content-center p-6 text-center text-sm text-[var(--text-muted)]">El directo aparecerá cuando se acredite el acceso a esta sesión.</div>}
    {status === 'connected' && <div className="space-y-3 border-t border-[var(--border)] p-3">
      <div className="flex flex-wrap gap-2">{capabilities.includes('snapshot') && <Button size="sm" disabled={busy || !image} onClick={() => void perform()}>Ver controles de la página</Button>}{capabilities.includes('press') && <><Button size="sm" disabled={busy || !image} onClick={() => void perform({ kind: 'press', key: 'ArrowUp' })}>Subir</Button><Button size="sm" disabled={busy || !image} onClick={() => void perform({ kind: 'press', key: 'ArrowDown' })}>Bajar</Button></>}</div>
      {controls?.controls.filter(control => capabilities.includes(control.kind)).map(control => <BrowserControl key={control.id} label={control.label} type={control.kind} disabled={busy} onAction={text => void perform({ kind: control.kind, snapshot_id: controls.snapshot_id, control_id: control.id, ...(control.kind === 'type' ? { text } : {}) })} />)}
      {controls && !controls.controls.length && <p className="text-xs text-[var(--text-muted)]">No se encontraron controles disponibles en esta página.</p>}
      {capabilities.includes('navigate') && <form className="flex min-w-0 gap-2" onSubmit={event => { event.preventDefault(); void perform({ kind: 'navigate', url: address }); }}><input aria-label="Dirección web" type="url" value={address} onChange={event => setAddress(event.target.value)} placeholder="https://…" className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 text-sm" required /><Button size="sm" disabled={busy}>Ir</Button></form>}
    </div>}
  </div>;
}
function BrowserControl({ label, type, disabled, onAction }: { label: string; type: 'click' | 'type'; disabled: boolean; onAction(text?: string): void }) {
  const [text, setText] = useState('');
  return <form className="flex min-w-0 flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); onAction(text); }}><span className="max-w-64 truncate text-xs" title={label}>{label}</span>{type === 'type' && <input aria-label={label} maxLength={2000} value={text} onChange={event => setText(event.target.value)} className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 text-sm" />}<Button size="sm" variant="outline" disabled={disabled}>{type === 'type' ? 'Escribir' : 'Pulsar'}</Button></form>;
}
