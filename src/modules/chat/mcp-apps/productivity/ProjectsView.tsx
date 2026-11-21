import { useState } from 'react';
import type { Board, Card, Column } from '@/modules/projects/types';
import type { ProductivityContext, ProductivityTransport } from './types';
import { pageOf } from './types';
import { useProductivityQuery } from './use-productivity-query';
import { Fields, More, Origin, QueryState, SaveForm, Search, SelectedDetail } from './shared';
import { pageOffset, pageSize } from './selection-adapters';

type FullBoard = Board & { columns: Array<Column & { cards: Card[] }> };
type Comment = { id: string; content: string; author_name?: string; created_at: string };
type Checklist = { id: string; title: string; items: Array<{ id: string; text: string; checked: boolean; assignee_id?: string | null; due_date?: string | null }> };
type Dependencies = { blocking?: Array<{ card: Pick<Card, 'id' | 'title'> }>; blocked_by?: Array<{ card: Pick<Card, 'id' | 'title'> }> };
function TaskEdit({ card, transport, done, cancel }: { card: Card; transport: ProductivityTransport; done(): void; cancel(): void }) {
 const [title, setTitle] = useState(card.title); const [description, setDescription] = useState(card.description || '');
 return <SaveForm onCancel={cancel} onSave={async () => { await transport.call('projects', 'task_update', { id: card.id, title, description }); done(); }}><label>Título<input required value={title} onChange={e => setTitle(e.target.value)} /></label><label>Descripción<textarea rows={6} value={description} onChange={e => setDescription(e.target.value)} /></label></SaveForm>;
}
function ChecklistEdit({ checklist, card, transport, done }: { checklist: Checklist; card: Card; transport: ProductivityTransport; done(): void }) {
 const [items, setItems] = useState(checklist.items); const [editing, setEditing] = useState(false);
 if (!editing) return <section><h4>{checklist.title}</h4>{checklist.items.map(item => <p key={item.id}>{item.checked ? '✓' : '○'} {item.text}</p>)}<button onClick={() => setEditing(true)}>Editar checklist</button></section>;
 return <SaveForm onCancel={() => setEditing(false)} onSave={async () => { await transport.call('projects', 'checklist_update', { board_id: card.board_id, card_id: card.id, checklist_id: checklist.id,
  items: items.map(item => ({ id: item.id, text: item.text, checked: item.checked, ...(typeof item.assignee_id === 'string' ? { assignee_id: item.assignee_id } : {}), ...(typeof item.due_date === 'string' ? { due_date: item.due_date } : {}) })),
 }); setEditing(false); done(); }}>
  <h4>{checklist.title}</h4>{items.map(item => <label key={item.id}><input type="checkbox" checked={item.checked} onChange={e => setItems(previous => previous.map(row => row.id === item.id ? { ...row, checked: e.target.checked } : row))} />{item.text}</label>)}
 </SaveForm>;
}
function CardExtras({ card, transport }: { card: Card; transport: ProductivityTransport }) {
 const [comment, setComment] = useState('');
 const query = useProductivityQuery(`card-extras:${card.id}`, async signal => {
  const params = { board_id: card.board_id, card_id: card.id };
  const [comments, checklists, dependencies] = await Promise.allSettled([
   transport.call<Comment[]>('projects', 'comment_list', params, signal), transport.call<Checklist[]>('projects', 'checklist_list', params, signal),
   transport.call<Dependencies>('projects', 'dependency_list', params, signal),
  ]);
  return { comments, checklists, dependencies };
 });
 return <QueryState {...query} retry={query.refresh}>{query.data && <>
  <section><h3>Comentarios</h3>{query.data.comments.status === 'fulfilled' ? query.data.comments.value.data.map(row => <blockquote key={row.id}><p>{row.content}</p><small>{row.author_name} · {row.created_at}</small></blockquote>) : <p>No se pudieron consultar los comentarios con este acceso.</p>}
   <SaveForm onCancel={() => setComment('')} onSave={async () => { if (!comment.trim()) return; await transport.call('projects', 'comment_create', { board_id: card.board_id, card_id: card.id, content: comment }); setComment(''); query.refresh(); }}><label>Añadir comentario<textarea value={comment} onChange={e => setComment(e.target.value)} /></label></SaveForm>
  </section><section><h3>Checklists</h3>{query.data.checklists.status === 'fulfilled' ? query.data.checklists.value.data.map(row => <ChecklistEdit key={row.id} checklist={row} card={card} transport={transport} done={query.refresh} />) : <p>Las checklists no están disponibles con este acceso.</p>}</section>
  <section><h3>Dependencias</h3>{query.data.dependencies.status === 'fulfilled' ? <><h4>Bloquea</h4>{query.data.dependencies.value.data.blocking?.map(row => <p key={row.card.id}>{row.card.title}</p>)}<h4>Bloqueada por</h4>{query.data.dependencies.value.data.blocked_by?.map(row => <p key={row.card.id}>{row.card.title}</p>)}</> : <p>No se pudieron consultar las dependencias.</p>}</section>
 </>}</QueryState>;
}
export default function ProjectsView({ context, transport }: { context: ProductivityContext; transport: ProductivityTransport }) {
 const [search, setSearch] = useState(String(context.selection.params.search || '')); const [offset, setOffset] = useState(() => pageOffset(context)); const [mode, setMode] = useState(['board_get', 'cards_list'].includes(context.selection.action) ? 'board' : 'tasks');
 const [boardId, setBoardId] = useState(context.selection.action === 'board_get' ? String(context.selection.params.id) : String(context.selection.params.board_id || ''));
 const [id, setId] = useState(['task_get', 'card_get'].includes(context.selection.action) ? String(context.selection.params.id) : typeof context.selection.params.card_id === 'string' ? context.selection.params.card_id : ''); const [editing, setEditing] = useState(false);
 const limit = pageSize(context); const filters = context.selection.action === 'tasks_query' ? context.selection.params : {};
 const tasks = useProductivityQuery(`tasks:${mode}:${search}:${offset}`, async signal => mode === 'tasks' ? pageOf(await transport.call<Card[]>('projects', 'tasks_query', { ...filters, search, limit, offset }, signal), limit) : { items: [], hasMore: false });
 const boards = useProductivityQuery(`boards:${mode}`, async signal => mode === 'board' ? (await transport.call<Board[]>('projects', 'boards_list', { limit: 25 }, signal)).data : []);
 const board = useProductivityQuery(`board:${mode}:${boardId}`, async signal => mode === 'board' && boardId ? (await transport.call<FullBoard>('projects', 'board_get', { id: boardId }, signal)).data : null);
 const detail = useProductivityQuery(`task:${id}`, async signal => id ? (await transport.call<Card>('projects', 'task_get', { id }, signal)).data : null);
 const card = detail.data;
 return <><nav className="productivity-toolbar" aria-label="Vista de proyectos"><button aria-pressed={mode === 'tasks'} onClick={() => setMode('tasks')}>Lista de tareas</button><button aria-pressed={mode === 'board'} onClick={() => setMode('board')}>Tablero Kanban</button></nav>
  {id && <SelectedDetail id={id} label="Ficha de tarea"><QueryState {...detail} retry={detail.refresh}>{card && <><h2>{card.title}</h2><Origin entity={card} />{editing ? <TaskEdit key={card.id} card={card} transport={transport} cancel={() => setEditing(false)} done={() => { setEditing(false); tasks.refresh(); board.refresh(); detail.refresh(); }} /> : <><Fields values={[["Descripción", card.description], ["Prioridad", card.priority], ["Vencimiento", card.due_date]]} /><button onClick={() => setEditing(true)}>Editar tarea</button></>}<CardExtras key={card.id} card={card} transport={transport} /></>}</QueryState></SelectedDetail>}
  {mode === 'tasks' ? <><Search initial={search} onSearch={value => { setSearch(value); setOffset(0); }} /><QueryState {...tasks} empty={!tasks.data?.items.length} retry={tasks.refresh}>
   {tasks.data?.items.map(row => <button className="productivity-list-row" key={row.id} disabled={editing} onClick={() => setId(row.id)}><strong>{row.title}</strong><span>{row.due_date}</span><Origin entity={row} /></button>)}<More offset={offset} limit={limit} hasMore={tasks.data?.hasMore ?? false} onChange={setOffset} />
  </QueryState></> : <><QueryState {...boards} retry={boards.refresh}><div className="productivity-toolbar">{boards.data?.map(row => <button key={row.id} onClick={() => setBoardId(row.id)}>{row.title}</button>)}</div></QueryState>
   <QueryState {...board} retry={board.refresh}>{board.data ? <><h2>{board.data.title}</h2><Origin entity={board.data} /><div className="productivity-kanban">{board.data.columns.map(column => <section key={column.id}><h3>{column.title}</h3>{column.cards.filter(row => !row.archived).map(row => <button className="productivity-list-row" disabled={editing} key={row.id} onClick={() => setId(row.id)}>{row.title}</button>)}</section>)}</div></> : <p>Selecciona un tablero.</p>}</QueryState></>}

 </>;
}
