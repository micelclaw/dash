import { useState } from 'react';
import type { InventoryItem, InventoryLocation, InventoryMove, InventoryMaintenancePlan, InventoryAlerts, InventoryValuation, InventoryProposal } from '@/modules/inventory/types';
import type { ProductivityContext, ProductivityTransport } from './types';
import { useProductivityQuery } from './use-productivity-query';
import { Fields, More, QueryState, SaveForm, Search, SelectedDetail } from './shared';

const sections = [ ['list', 'Objetos'], ['locations_list', 'Ubicaciones'], ['moves_list', 'Movimientos'], ['loans', 'Préstamos'], ['maintenance_plans_list', 'Mantenimiento'], ['alerts', 'Alertas'], ['value_report', 'Valoración'], ['proposals_list', 'Propuestas pendientes'] ] as const;
type InventoryData = InventoryItem[] | InventoryLocation[] | InventoryMove[] | InventoryMaintenancePlan[] | InventoryProposal[] | InventoryAlerts | InventoryValuation;
function ItemEdit({ item, transport, done, cancel }: { item: InventoryItem; transport: ProductivityTransport; done(): void; cancel(): void }) {
 const [name, setName] = useState(item.name); const [description, setDescription] = useState(item.description || ''); const [category, setCategory] = useState(item.category || '');
 return <SaveForm onCancel={cancel} onSave={async () => { await transport.call('inventory', 'update', { id: item.id, name, description, category }); done(); }}><label>Nombre<input required value={name} onChange={e => setName(e.target.value)} /></label><label>Categoría<input value={category} onChange={e => setCategory(e.target.value)} /></label><label>Descripción<textarea value={description} onChange={e => setDescription(e.target.value)} /></label></SaveForm>;
}
export default function InventoryView({ context, transport }: { context: ProductivityContext; transport: ProductivityTransport }) {
 const [section, setSection] = useState<string>(sections.some(([action]) => action === context.selection.action) ? context.selection.action : 'list');
 const [search, setSearch] = useState(String(context.selection.params.search || '')); const [offset, setOffset] = useState(0);
 const [id, setId] = useState(['get', 'maintenance_plans_list'].includes(context.selection.action) ? String(context.selection.params.id) : ''); const [editing, setEditing] = useState(false);
 const query = useProductivityQuery(`inventory:${section}:${search}:${offset}:${section === 'maintenance_plans_list' ? id : ''}`, async signal => {
  if (section === 'maintenance_plans_list' && !id) return [];
  const filters = context.selection.action === section ? context.selection.params : {};
  const params = { ...filters, ...(section === 'list' ? { search, limit: 25, offset } : section === 'moves_list' ? { limit: 25, offset } : section === 'proposals_list' ? { status: 'pending', limit: 25, offset } : section === 'maintenance_plans_list' ? { id } : {}) };
  return (await transport.call<InventoryData>('inventory', section, params, signal)).data;
 });
 const detail = useProductivityQuery(`inventory-item:${id}`, async signal => id ? (await transport.call<InventoryItem>('inventory', 'get', { id }, signal)).data : null);
 const data = query.data; const item = detail.data;
 return <><nav className="productivity-toolbar" aria-label="Vistas de inventario">{sections.map(([action, label]) => <button key={action} disabled={editing} aria-pressed={section === action} onClick={() => { setSection(action); setOffset(0); }}>{label}</button>)}</nav>
  {section === 'list' && <Search initial={search} onSearch={value => { setSearch(value); setOffset(0); }} />}
  {id && <SelectedDetail id={id} label="Ficha del objeto"><QueryState {...detail} retry={detail.refresh}>{item && <><h2>{item.name}</h2>{editing ? <ItemEdit key={item.id} item={item} transport={transport} cancel={() => setEditing(false)} done={() => { setEditing(false); detail.refresh(); query.refresh(); }} /> : <><Fields values={[["Descripción", item.description], ["Ubicación", item.location_id], ["Existencias", `${item.quantity} ${item.uom}`], ["Marca y modelo", `${item.brand || ''} ${item.model || ''}`], ["Número de serie", item.serial_number], ["Estado", item.status], ["Precio de compra", `${item.purchase_price || 'Sin datos'} ${item.currency}`], ["Garantía", item.warranty_until]]} /><button onClick={() => setEditing(true)}>Editar objeto</button></>}</>}</QueryState></SelectedDetail>}
  <QueryState {...query} empty={Array.isArray(data) && !data.length} retry={query.refresh}>
   {Array.isArray(data) && <section aria-label={sections.find(([action]) => action === section)?.[1]}>{data.map((entry, index) => {
    if (section === 'list' || section === 'loans') { const row = entry as InventoryItem; return <button className="productivity-list-row" key={row.id} disabled={editing} onClick={() => setId(row.id)}><strong>{row.name}</strong><span>Existencias: {row.quantity} {row.uom}</span>{section === 'loans' && <span>Prestado hasta {row.lent_until || 'sin fecha'}</span>}</button>; }
    if (section === 'locations_list') { const row = entry as InventoryLocation; return <Fields key={row.id} values={[[row.name, `${row.item_count} objetos · ${row.total_value}`], ['Notas', row.notes]]} />; }
    if (section === 'moves_list') { const row = entry as InventoryMove; return <Fields key={row.id} values={[[row.type, `${row.qty_delta} ${row.uom}`], ['Fecha', row.occurred_at], ['Saldo', row.running_balance], ['Notas', row.notes]]} />; }
    if (section === 'maintenance_plans_list') { const row = entry as InventoryMaintenancePlan; return <Fields key={row.id} values={[[row.name, row.notes], ['Próxima fecha', row.next_due_date], ['Próxima lectura', row.next_due_meter]]} />; }
    if (section === 'proposals_list') { const row = entry as InventoryProposal; return <Fields key={row.id || index} values={[[row.payload?.name || 'Propuesta', row.payload?.description], ['Estado', row.status], ['Origen', row.source]]} />; }
    return null;
   })}</section>}
   {section === 'alerts' && data && !Array.isArray(data) && 'warranties_expiring' in data && <>
    {([['warranties_expiring', 'Garantías próximas a vencer'], ['low_stock', 'Existencias bajas'], ['active_loans', 'Préstamos activos'], ['upcoming_maintenance', 'Próximos mantenimientos']] as const).map(([key, label]) => <section key={key}><h3>{label}</h3>{data[key]?.length ? data[key].map(row => <p key={row.id}>{'name' in row ? row.name : `${row.date} · ${row.notes || 'Mantenimiento'}`}</p>) : <p>Sin alertas.</p>}</section>)}<p>Propuestas pendientes: {data.pending_proposals}</p>
   </>}
   {section === 'value_report' && data && !Array.isArray(data) && 'groups' in data && <><h2>Valoración: {data.total}</h2><p>A fecha {data.at}</p>{data.groups.map(group => <Fields key={group.key} values={[[group.key || 'Sin grupo', group.value], ['Objetos', group.item_count]]} />)}{data.lines.map(line => <Fields key={line.item_id} values={[[line.name, line.value], ['Cantidad', line.qty], ['Valor por unidad', line.unit_value]]} />)}</>}
   {Array.isArray(data) && ['list', 'moves_list', 'proposals_list'].includes(section) && <More offset={offset} hasMore={data.length === 25} onChange={setOffset} />}
  </QueryState>

 </>;
}
