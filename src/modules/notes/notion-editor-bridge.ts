import {oneNoteEditorHtml, type OneNoteEditorUnit} from './onenote-editor-bridge';

type Annotations = {bold?: boolean; italic?: boolean; strikethrough?: boolean; underline?: boolean; code?: boolean; color?: string};
interface RichText {type: 'text'; text: {content: string; link?: {url: string} | null}; annotations?: Annotations;}
export interface NotionEditorUnit {
  index: number; id: string; kind: string;
  has_children?: boolean;
  value: {rich_text: RichText[]; color?: string; checked?: boolean; caption?: RichText[]; language?: string; [key: string]: unknown};
}
export interface NotionEditorAuthority {enabled: boolean; insert_enabled?: boolean; delete_enabled?: boolean; local_revision: string; units: NotionEditorUnit[];}
type NotionOperation={op:'set_unit';unit_id:string;value:NotionEditorUnit['value']}|{op:'delete_unit';unit_id:string}|
  {op:'insert_unit';unit_id:string;anchor_id:string|null;position:'before'|'after';value:{kind:string;value:NotionEditorUnit['value']}};

/** Adapts native block identity to the existing editor; no block-by-block editor. */
export function notionEditorHtml(content: string, authority: NotionEditorAuthority, images: Record<string,string>) {
  const document = new DOMParser().parseFromString(content, 'text/html');
  for (const unit of authority.units.filter(unit => unit.kind === 'to_do')) {
    const paragraph = document.querySelector(`[data-note-unit-index="${unit.index}"]`);
    if (!paragraph) continue;
    // The read projection's glyph is presentation, not note text.
    const first = paragraph.firstChild;
    if (first?.nodeType === Node.TEXT_NODE) first.textContent = (first.textContent || '').replace(/^[☑☐] /, '');
    const list = document.createElement('ul'); list.dataset.type = 'taskList';
    const item = document.createElement('li'); item.dataset.type = 'taskItem'; item.dataset.checked = String(Boolean(unit.value.checked));
    item.setAttribute('data-note-unit-index', String(unit.index)); paragraph.removeAttribute('data-note-unit-index');
    paragraph.replaceWith(list); list.append(item); item.append(paragraph);
  }
  const units: OneNoteEditorUnit[] = authority.units.map(unit => ({index: unit.index, id: unit.id,
    value: {tag: 'p', html: '', attributes: {}}}));
  return oneNoteEditorHtml(document.body.innerHTML, units, images);
}

function parse(html: string) { return new DOMParser().parseFromString(html, 'text/html').body; }
function kindOf(element:Element):string{
  if(element.tagName==='LI')return element.getAttribute('data-type')==='taskItem'?'to_do':element.parentElement?.tagName==='OL'?'numbered_list_item':'bulleted_list_item';
  return ({P:'paragraph',H1:'heading_1',H2:'heading_2',H3:'heading_3',PRE:'code',BLOCKQUOTE:'quote'} as Record<string,string>)[element.tagName]||'';
}
const textElement=(kind:string,element:Element)=>kind==='to_do'?element.querySelector('div')||element:kind==='code'?element.querySelector('code')||element:element;
const nativeElements=(body:HTMLElement)=>[...body.querySelectorAll('[data-note-unit-index],[data-note-draft-id],[data-note-protected-key]')]
  .filter(element=>!element.parentElement?.closest('[data-note-unit-index],[data-note-draft-id],[data-note-protected-key]'));
function richText(element: Element): RichText[] {
  const result: RichText[] = [];
  const visit = (node: Node, annotations: Annotations, link: {url: string} | null) => {
    if (node.nodeType === Node.TEXT_NODE || (node as Element).tagName === 'BR') {
      const content = node.nodeType === Node.TEXT_NODE ? node.textContent || '' : '\n';
      if (!content) return;
      // Notion's API limits each text fragment to 2,000 UTF-16 code units.
      for (let offset = 0; offset < content.length;) {
        let end = Math.min(offset + 2000, content.length);
        if (end < content.length && /[\uD800-\uDBFF]/.test(content[end - 1]!)) end--;
        result.push({type: 'text', text: {content: content.slice(offset,end), link}, annotations: {...annotations}}); offset = end;
      }
      return;
    }
    if (!(node instanceof Element)) return;
    const next = {...annotations};
    const marks: Record<string,keyof Annotations> = {STRONG:'bold', B:'bold', EM:'italic', I:'italic', S:'strikethrough', STRIKE:'strikethrough', U:'underline', CODE:'code'};
    const flag = marks[node.tagName]; if (flag) Object.assign(next, {[flag]: true});
    let nextLink = link;
    if (node.tagName === 'A') {
      const url = node.getAttribute('href') || '';
      const parsed = new URL(url, window.location.origin);
      if (!['https:','http:','mailto:'].includes(parsed.protocol) || parsed.username || parsed.password)
        throw new Error('El enlace no es compatible con Notion. Tu borrador se conserva.');
      nextLink = {url: parsed.href};
    }
    if (!['P','DIV','SPAN','STRONG','B','EM','I','S','STRIKE','U','CODE','A','LI','BLOCKQUOTE','H1','H2','H3'].includes(node.tagName))
      throw new Error('Este formato no se puede conservar en Notion. Tu borrador se conserva.');
    if (node.matches('[style],[data-type]') && node !== element && !node.matches('div,p'))
      throw new Error('Este formato aún no es compatible con Notion. Tu borrador se conserva.');
    for (const child of node.childNodes) visit(child,next,nextLink);
  };
  const defaults = {bold:false, italic:false, strikethrough:false, underline:false, code:false, color:'default'};
  for (const child of element.childNodes) visit(child,defaults,null);
  if (result.length > 100) throw new Error('Este bloque supera el límite de texto de Notion. Tu borrador se conserva.');
  return result;
}

function preserveTextRuns(original: RichText[], before: string, after: string): RichText[] | null {
  if (original.map(item=>item.text.content).join('') !== before) return null;
  let start = 0; while(start < before.length && start < after.length && before[start] === after[start]) start++;
  let suffix = 0; while(suffix < before.length-start && suffix < after.length-start && before[before.length-1-suffix] === after[after.length-1-suffix]) suffix++;
  const end = before.length-suffix, replacement = after.slice(start,after.length-suffix);
  let offset = 0, inserted = false; const result: RichText[]=[];
  for(const item of original){const next=offset+item.text.content.length;
    let content=item.text.content;
    if(next>=start && offset<=end){content=content.slice(0,Math.max(0,start-offset))+(!inserted?replacement:'')+content.slice(Math.min(content.length,Math.max(0,end-offset)));inserted=true;}
    if(content)result.push({...structuredClone(item),text:{...item.text,content}});offset=next;
  }
  if(!inserted&&replacement)result.push({type:'text',text:{content:replacement,link:null}});
  if(result.some(item=>item.text.content.length>2000)||result.length>100)return null;
  return result;
}

/** Only send changed native blocks. Unknown objects/hierarchy cannot disappear. */
export function notionEditorChanges(beforeHtml: string, nextHtml: string, authority: NotionEditorAuthority) {
  const before = parse(beforeHtml), next = parse(nextHtml);
  const deleted=authority.units.filter(unit=>before.querySelector(`[data-note-unit-index="${unit.index}"]`)&&!next.querySelector(`[data-note-unit-index="${unit.index}"]`));
  if(deleted.length&&(!authority.delete_enabled||deleted.some(unit=>unit.has_children)))
    throw new Error('No se puede eliminar este bloque de Notion. Tu borrador se conserva.');
  const order = (body: HTMLElement) => [...body.querySelectorAll('[data-note-unit-index],[data-note-protected-key]')]
    .filter(element=>!deleted.some(unit=>String(unit.index)===element.getAttribute('data-note-unit-index')))
    .map(element=>[element.tagName,element.getAttribute('data-note-unit-index'),element.getAttribute('data-note-protected-key')]);
  if(JSON.stringify(order(before))!==JSON.stringify(order(next)))
    throw new Error('Este cambio de estructura aún no está habilitado en Notion. Tu borrador se conserva.');
  const untracked = (body: HTMLElement) => {const copy=body.cloneNode(true) as HTMLElement;
    for(const element of copy.querySelectorAll('[data-note-unit-index],[data-note-protected-key],[data-note-draft-id]'))element.remove();
    for(const element of [...copy.querySelectorAll('p,ol,ul')].reverse())if(!element.textContent?.trim())element.remove();
    return copy.textContent?.trim() || '';};
  if(untracked(next)!==untracked(before)) throw new Error('Añadir bloques nuevos aún está pendiente de habilitar en Notion. Tu borrador se conserva.');
  const sequence=nativeElements(next).filter(element=>element.hasAttribute('data-note-unit-index')||element.hasAttribute('data-note-protected-key')||Boolean(element.textContent?.trim()));
  const insertions:NotionOperation[]=sequence.flatMap((element,index)=>{
    if(!element.hasAttribute('data-note-draft-id')||element.hasAttribute('data-note-unit-index')||element.hasAttribute('data-note-protected-key'))return [];
    if(!authority.insert_enabled)throw new Error('Añadir bloques aún no está habilitado en Notion. Tu borrador se conserva.');
    const kind=kindOf(element),draftId=element.getAttribute('data-note-draft-id')!;
    if(!kind||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(draftId))throw new Error('El bloque nuevo no es compatible con Notion. Tu borrador se conserva.');
    let previous:Element|undefined,following:Element|undefined;
    for(let i=index-1;i>=0;i--){if(sequence[i]!.hasAttribute('data-note-protected-key'))break;if(sequence[i]!.hasAttribute('data-note-unit-index')){previous=sequence[i];break;}}
    for(let i=index+1;i<sequence.length;i++){if(sequence[i]!.hasAttribute('data-note-protected-key'))break;if(sequence[i]!.hasAttribute('data-note-unit-index')){following=sequence[i];break;}}
    const anchor=previous||following;
    if(previous&&authority.units.find(unit=>String(unit.index)===previous.getAttribute('data-note-unit-index'))?.has_children)
      throw new Error('Este bloque tiene contenido anidado. Añade texto después de sus hijos; tu borrador se conserva.');
    if(!anchor&&sequence.slice(0,index).some(node=>!node.hasAttribute('data-note-draft-id'))&&sequence.slice(index+1).some(node=>!node.hasAttribute('data-note-draft-id')))
      throw new Error('No se puede insertar entre estos objetos especiales. Tu borrador se conserva.');
    const position=previous?'after':following?'before':sequence.slice(0,index).every(node=>node.hasAttribute('data-note-draft-id'))?'before':'after';
    const value:NotionEditorUnit['value']={rich_text:richText(textElement(kind,element)),...(kind==='code'?{language:'plain text',caption:[]}:{}),
      ...(kind==='to_do'?{checked:element.getAttribute('data-checked')==='true'}:{})};
    return [{op:'insert_unit',unit_id:draftId,anchor_id:anchor?authority.units.find(unit=>String(unit.index)===anchor.getAttribute('data-note-unit-index'))!.id:null,position,value:{kind,value}}];
  });
  const updates:NotionOperation[]=authority.units.filter(unit=>!deleted.includes(unit)).flatMap(unit=>{
    const selector=`[data-note-unit-index="${unit.index}"]`;
    const old=before.querySelector(selector), fresh=next.querySelector(selector);
    if(!old||!fresh)throw new Error('Falta un bloque de Notion. Tu borrador se conserva.');
    if(old.outerHTML===fresh.outerHTML)return [];
    const oldText=textElement(unit.kind,old),newText=textElement(unit.kind,fresh);
    if(insertions.length&&(newText.textContent?.length||0)<(oldText.textContent?.length||0)&&
      unit.value.rich_text.some(item=>item.annotations?.color&&item.annotations.color!=='default'))
      throw new Error('Separar este texto perdería su color nativo. Tu borrador se conserva; edita el texto sin dividir este bloque.');
    if(oldText.textContent!==unit.value.rich_text.map(item=>item.text.content).join(''))
      throw new Error('Este bloque recibió otro cambio en Notion. Tu borrador se conserva; revisa la versión nueva antes de guardarlo.');
    const stripText=(element: Element)=>{const copy=element.cloneNode(true) as Element;const walker=document.createTreeWalker(copy,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))node.textContent='';return copy.innerHTML;};
    const textOnly=stripText(oldText)===stripText(newText);
    const preserved=textOnly?preserveTextRuns(unit.value.rich_text,oldText.textContent||'',newText.textContent||''):null;
    if(!textOnly && unit.value.rich_text.some(item=>item.annotations?.color&&item.annotations.color!=='default'))
      throw new Error('El formato de color nativo se conserva, pero este cambio de formato aún no está habilitado. Tu borrador se conserva.');
    const value={...unit.value,rich_text:preserved || (unit.kind==='code'?[{type:'text' as const,text:{content:newText.textContent||'',link:null}}]:richText(newText))};
    if(unit.kind==='to_do')value.checked=fresh.getAttribute('data-checked')==='true';
    return [{op:'set_unit' as const,unit_id:unit.id,value}];
  });
  return [...updates,...insertions,...deleted.map(unit=>({op:'delete_unit' as const,unit_id:unit.id}))];
}

/** Surviving native IDs, never old positional indices, identify confirmed blocks. */
export function notionEditorIdentityMap(submittedHtml:string,before:NotionEditorAuthority,after:NotionEditorAuthority,structural:boolean){
  const source=nativeElements(parse(submittedHtml)).filter(element=>element.hasAttribute('data-note-unit-index')||
    element.hasAttribute('data-note-draft-id')&&Boolean(element.textContent?.trim()));
  if(structural&&source.length!==after.units.length)throw new Error('Notion devolvió otra estructura. Tu borrador se conserva.');
  const oldIds=new Set(before.units.map(unit=>unit.id));const result=new Map<string,string>();
  for(const [position,element] of source.entries()){
    const old=element.hasAttribute('data-note-unit-index')?before.units.find(unit=>String(unit.index)===element.getAttribute('data-note-unit-index')):null;
    const target=old?after.units.find(unit=>unit.id===old.id):after.units[position];
    if(!target||structural&&target!==after.units[position]||!old&&oldIds.has(target.id)||kindOf(element)!==target.kind)
      throw new Error('No se pudo confirmar la identidad del bloque. Tu borrador se conserva.');
    if(!old&&(textElement(target.kind,element).textContent!==target.value.rich_text.map(item=>item.text.content).join('')||
      target.kind==='to_do'&&(element.getAttribute('data-checked')==='true')!==target.value.checked))
      throw new Error('Notion devolvió otro contenido. Tu borrador se conserva.');
    result.set(old?`unit:${old.index}`:`draft:${element.getAttribute('data-note-draft-id')}`,String(target.index));
  }
  return result;
}
