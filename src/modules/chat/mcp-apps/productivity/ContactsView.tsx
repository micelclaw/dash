import { useState } from 'react';
import type { Contact } from '@/modules/contacts/types';
import type { ProductivityContext, ProductivityTransport } from './types';
import { pageOf } from './types';
import { useProductivityQuery } from './use-productivity-query';
import { Fields, More, Origin, QueryState, SaveForm, Search } from './shared';
import { pageOffset, pageSize } from './selection-adapters';

function ContactEdit({ contact, transport, done, cancel }: { contact: Contact; transport: ProductivityTransport; done(): void; cancel(): void }) {
 const [name, setName] = useState(contact.display_name); const [company, setCompany] = useState(contact.company || '');
 const [job, setJob] = useState(contact.job_title || ''); const [notes, setNotes] = useState(contact.notes || '');
 const [emails, setEmails] = useState(contact.emails); const [phones, setPhones] = useState(contact.phones);
 return <SaveForm onCancel={cancel} onSave={async () => { await transport.call('contacts', 'update', { id: contact.id, display_name: name, company, job_title: job, notes, emails, phones }); done(); }}>
  <label>Nombre<input required value={name} onChange={e => setName(e.target.value)} /></label><label>Empresa<input value={company} onChange={e => setCompany(e.target.value)} /></label>
  <label>Cargo<input value={job} onChange={e => setJob(e.target.value)} /></label>
  {emails.map((email, index) => <label key={index}>Correo {index + 1}<input type="email" value={email.address} onChange={e => setEmails(previous => previous.map((item, i) => i === index ? { ...item, address: e.target.value } : item))} /></label>)}
  <button type="button" onClick={() => setEmails(previous => [...previous, { address: '', label: 'work', primary: previous.length === 0 }])}>Añadir correo</button>
  {phones.map((phone, index) => <label key={index}>Teléfono {index + 1}<input value={phone.number} onChange={e => setPhones(previous => previous.map((item, i) => i === index ? { ...item, number: e.target.value } : item))} /></label>)}
  <button type="button" onClick={() => setPhones(previous => [...previous, { number: '', label: 'work', primary: previous.length === 0 }])}>Añadir teléfono</button>
  <label>Notas<textarea value={notes} onChange={e => setNotes(e.target.value)} /></label>
 </SaveForm>;
}
export default function ContactsView({ context, transport }: { context: ProductivityContext; transport: ProductivityTransport }) {
 const [search, setSearch] = useState(String(context.selection.params.search || '')); const [offset, setOffset] = useState(() => pageOffset(context));
 const [id, setId] = useState(context.selection.action === 'get' ? String(context.selection.params.id) : ''); const [editing, setEditing] = useState(false);
 const limit = pageSize(context); const filters = context.selection.action === 'list' ? context.selection.params : {};
 const list = useProductivityQuery(`contacts:${search}:${offset}`, async signal => pageOf(await transport.call<Contact[]>('contacts', 'list', { ...filters, search, limit, offset }, signal), limit));
 const detail = useProductivityQuery(`contact:${id}`, async signal => id ? (await transport.call<Contact>('contacts', 'get', { id }, signal)).data : null);
 const contact = detail.data;
 return <><Search initial={search} onSearch={value => { setSearch(value); setOffset(0); }} /><div className="productivity-split"><section aria-label="Lista de contactos"><QueryState {...list} empty={!list.data?.items.length} retry={list.refresh}>
  {list.data?.items.map(item => <button className="productivity-list-row" key={item.id} aria-pressed={id === item.id} disabled={editing} onClick={() => setId(item.id)}><strong>{item.display_name}</strong><span>{item.company}</span><Origin entity={item} /></button>)}
  <More offset={offset} limit={limit} hasMore={list.data?.hasMore ?? false} onChange={setOffset} />
 </QueryState></section><article aria-label="Ficha del contacto"><QueryState {...detail} retry={detail.refresh}>
  {contact ? <><h2>{contact.display_name}</h2><Origin entity={contact} />{editing ? <ContactEdit key={contact.id} contact={contact} transport={transport} cancel={() => setEditing(false)} done={() => { setEditing(false); detail.refresh(); list.refresh(); }} /> : <>
   <Fields values={[["Empresa", contact.company], ["Cargo", contact.job_title], ["Correos", contact.emails?.map(e => e.address).join(', ')], ["Teléfonos", contact.phones?.map(p => p.number).join(', ')], ["Direcciones", contact.addresses?.map(a => [a.street, a.city, a.postal_code, a.country].filter(Boolean).join(', ')).join(' · ')], ["Notas", contact.notes]]} /><button onClick={() => setEditing(true)}>Editar contacto</button></>}</> : <p>Selecciona una persona o empresa.</p>}
 </QueryState></article></div></>;
}
