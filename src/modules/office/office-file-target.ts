/** Formats handled by the stable Office dispatcher. Plain text/HTML keep their
 * Drive preview; importing them is an explicit action inside Documents. */
export function officeFileKind(file:{filename:string;mime_type?:string|null;is_directory?:boolean}):'document'|'pdf'|null {
 if(file.is_directory)return null;
 if(/[.]pdf$/i.test(file.filename)||file.mime_type==='application/pdf')return 'pdf';
 if(/[.](docx?|xlsx?|pptx?|odt|ods|odp|rtf|csv|tsv)$/i.test(file.filename)||/wordprocessing|spreadsheet|presentation|msword|ms-excel|ms-powerpoint|opendocument|rtf/i.test(file.mime_type||'')||['text/csv','text/tab-separated-values'].includes(file.mime_type||''))return 'document';
 return null;
}
export function officeFileTarget(file:{id:string;filename:string;mime_type?:string|null;is_directory?:boolean}):string|null {
 if(!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(file.id))return null;
 const kind=officeFileKind(file);return kind?`/office/${kind==='pdf'?'pdf':'edit'}/${encodeURIComponent(file.id)}`:null;
}
