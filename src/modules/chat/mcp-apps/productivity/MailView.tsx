import { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import type { Email } from '@/modules/mail/types';
import { prepararCuerpoSeguro, PIXEL_VACIO } from '@/modules/mail/lib/mail-body';
import type { ProductivityContext, ProductivityTransport } from './types';
import { pageOf } from './types';
import { useProductivityQuery } from './use-productivity-query';
import { More, Origin, QueryState, SaveForm, Search } from './shared';
import { pageOffset, pageSize } from './selection-adapters';

type Message = Email & { thread_id?: string | null };
const hasAttachments = (email: Message) => email.has_attachments || !!email.attachments?.length;
const recipients = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);
function MailBody({ email }: { email: Message }) {
 const prepared = useMemo(() => {
  if (!email.body_html) return null;
  return prepararCuerpoSeguro(email.body_html, { emailId: email.id, bloquearRemotas: true, adjuntos: [] }, { remote: () => PIXEL_VACIO, attachment: () => PIXEL_VACIO, origin: 'data:' });
 }, [email]);
 if (!prepared) return <div style={{ whiteSpace: 'pre-wrap' }}>{email.body_plain || 'Mensaje sin cuerpo.'}</div>;
 const safe = DOMPurify.sanitize(prepared.cuerpoHtml, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'iframe', 'object', 'embed', 'video', 'audio', 'link', 'meta', 'base'], FORBID_ATTR: ['href', 'action', 'formaction'] });
 return <>{prepared.remotas > 0 && <p role="status">Contenido remoto bloqueado: {prepared.remotas} imágenes. No se ha avisado al remitente.</p>}<div className="productivity-mail-body" dangerouslySetInnerHTML={{ __html: safe }} /></>;
}
function DraftEdit({ email, transport, done, cancel }: { email: Message; transport: ProductivityTransport; done(): void; cancel(): void }) {
 const [to, setTo] = useState((email.to_addresses || []).map(a => a.address).join(', ')); const [subject, setSubject] = useState(email.subject || '');
 const [cc, setCc] = useState((email.cc_addresses || []).map(a => a.address).join(', '));
 const [bcc, setBcc] = useState((email.bcc_addresses || []).map(a => a.address).join(', '));
 const [body, setBody] = useState(email.body_html || email.body_plain || '');
 return <SaveForm onCancel={cancel} onSave={async () => {
  if (hasAttachments(email)) throw new Error('Este borrador tiene adjuntos. Edítalo en Correo para conservarlos.');
  await transport.call('emails', 'save_draft', { to: recipients(to), cc: recipients(cc), bcc: recipients(bcc), subject, ...(email.body_html ? { html_body: body } : { body }), ...(email.account_id ? { account_id: email.account_id } : {}), ...(email.in_reply_to ? { in_reply_to: email.in_reply_to } : {}) }); done();
 }}><p>Se guardará una copia del borrador, como en el módulo Correo. No se enviará ningún mensaje.</p>
  <label>Para<input value={to} onChange={e => setTo(e.target.value)} /></label><label>Asunto<input value={subject} onChange={e => setSubject(e.target.value)} /></label>
  <label>CC<input value={cc} onChange={e => setCc(e.target.value)} /></label><label>CCO<input value={bcc} onChange={e => setBcc(e.target.value)} /></label>
  <label>{email.body_html ? 'Contenido HTML del borrador' : 'Mensaje'}<textarea rows={12} value={body} onChange={e => setBody(e.target.value)} /></label>
 </SaveForm>;
}
export default function MailView({ context, transport }: { context: ProductivityContext; transport: ProductivityTransport }) {
 const [search, setSearch] = useState(String(context.selection.params.search || '')); const [offset, setOffset] = useState(() => pageOffset(context));
 const [thread, setThread] = useState(String(context.selection.params.thread_id || '')); const [folder, setFolder] = useState(String(context.selection.params.folder || 'INBOX'));
 const [id, setId] = useState(context.selection.action === 'get' ? String(context.selection.params.id) : ''); const [editing, setEditing] = useState(false); const [notice, setNotice] = useState('');
 const limit = pageSize(context); const filters = context.selection.action === 'list' ? context.selection.params : {}; const { thread_id: _thread, ...remaining } = filters;
 const list = useProductivityQuery(`mail:${folder}:${thread}:${search}:${offset}`, async signal => pageOf(await transport.call<Message[]>('emails', 'list', { ...remaining, search, ...(thread ? { thread_id: thread } : { folder }), limit, offset }, signal), limit));
 const detail = useProductivityQuery(`mail-message:${id}`, async signal => id ? (await transport.call<Message>('emails', 'get', { id }, signal)).data : null);
 const email = detail.data;
 return <><Search initial={search} onSearch={value => { setSearch(value); setOffset(0); }} /><div className="productivity-toolbar">
  {['INBOX', 'DRAFTS', 'SENT'].map((value, i) => <button key={value} disabled={editing} aria-pressed={folder === value && !thread} onClick={() => { setFolder(value); setThread(''); setOffset(0); }}>{['Entrada', 'Borradores', 'Enviados'][i]}</button>)}
  {thread && <button onClick={() => { setThread(''); setOffset(0); }}>Volver a la carpeta</button>}</div>{notice && <p role="status">{notice}</p>}
  <div className="productivity-split"><section aria-label={thread ? 'Conversación de correo' : 'Lista de mensajes'}><QueryState {...list} empty={!list.data?.items.length} retry={list.refresh}>
   {list.data?.items.map(item => <button className="productivity-list-row" key={item.id} disabled={editing} onClick={() => setId(item.id)}><strong>{item.subject || 'Sin asunto'}</strong><span>{item.from_name || item.from_address}</span><Origin entity={item} /></button>)}<More offset={offset} limit={limit} hasMore={list.data?.hasMore ?? false} onChange={setOffset} />
  </QueryState></section><article aria-label="Mensaje seleccionado"><QueryState {...detail} retry={detail.refresh}>{email ? <><h2>{email.subject || 'Sin asunto'}</h2><Origin entity={email} /><p>De: {email.from_name} {email.from_address}</p><p>Para: {(email.to_addresses || []).map(a => a.address).join(', ')}</p>
   {!!email.cc_addresses?.length && <p>CC: {email.cc_addresses.map(item => item.address).join(', ')}</p>}{!!email.bcc_addresses?.length && <p>CCO: {email.bcc_addresses.map(item => item.address).join(', ')}</p>}
   {editing ? <DraftEdit key={email.id} email={email} transport={transport} cancel={() => setEditing(false)} done={() => { setEditing(false); setNotice('Borrador guardado. No se ha enviado.'); list.refresh(); }} /> : <><MailBody email={email} />{hasAttachments(email) && <p>Adjuntos: {email.attachments?.length ? email.attachments.map(item => item.filename).join(', ') : 'El mensaje contiene adjuntos; sus detalles no están disponibles.'}</p>}{email.thread_id && <button onClick={() => { setThread(email.thread_id!); setOffset(0); }}>Ver conversación</button>}{email.status === 'draft' && <><button disabled={hasAttachments(email)} onClick={() => setEditing(true)}>Editar borrador</button>{hasAttachments(email) && <p role="status">Este borrador tiene adjuntos. Edítalo en Correo para conservarlos.</p>}</>}</>}
  </> : <p>Selecciona un mensaje para leerlo aquí.</p>}</QueryState></article></div>
 </>;
}
