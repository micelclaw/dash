import type { OfficeSlot } from './office-providers.service';
const extension: Record<OfficeSlot, string> = { documents: 'docx', spreadsheets: 'xlsx', presentations: 'pptx', pdf: 'pdf' };
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
/** The host permits only actions belonging to this authenticated editor. */
export function officeHostNavigation(path: unknown, slot: OfficeSlot | undefined, fileId: string | null): string | null {
  if (path === '/office' || path === '/drive') return path;
  if (slot && path === `/office/new?type=${extension[slot]}`) return path;
  if (fileId && uuid.test(fileId) && path === `/office/edit/${fileId}`) return path;
  return null;
}
export function officeHostFileId(value: string | null): value is string { return !!value && uuid.test(value); }
/** A request to open another file is never trusted as a navigation target.
 * The host must first resolve it through Core for the authenticated provider. */
export function officeHostRequestedFile(path:unknown):string|null {
  if(typeof path!=='string')return null;
  const match=/^\/office\/(?:edit|pdf)\/([a-f\d-]+)$/i.exec(path);
  const id=match?.[1];
  return id&&uuid.test(id)?id:null;
}
/** A created file is opened only after Core confirms this provider and slot. */
export function officeCopiedFileRoute(session: {file_id:string;provider:string;document_type:string}, fileId:string, provider:string, slot:OfficeSlot):string|null {
  const type={documents:'word',spreadsheets:'cell',presentations:'slide',pdf:'pdf'}[slot];
  return uuid.test(fileId)&&session.file_id===fileId&&session.provider===provider&&session.document_type===type?`/office/${slot==='pdf'?'pdf':'edit'}/${fileId}`:null;
}
export function officeOpenedFileRoute(session:{file_id:string;provider:string;document_type:string;source_file_id?:string;converted?:boolean},requestedId:string,provider:string,slot:OfficeSlot):string|null {
  if(!uuid.test(requestedId)||session.file_id!==requestedId&&!(session.converted===true&&session.source_file_id===requestedId))return null;
  return officeCopiedFileRoute(session,session.file_id,provider,slot);
}
