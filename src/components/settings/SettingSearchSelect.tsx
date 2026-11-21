import {useId,useState} from 'react';
import {Check,ChevronsUpDown} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
interface Props {label:string;description?:string;value:string;options:Array<{value:string;label:string}>;onChange:(value:string)=>void;disabled?:boolean}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/europa/g,'europe');
export function SettingSearchSelect({label,description,value,options,onChange,disabled}:Props){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);const id=useId();
 const found=options.filter(o=>normalize(o.label+' '+o.value).includes(normalize(query)));
 const choose=(v:string)=>{onChange(v);setOpen(false);setQuery('');setActive(0);};
 return <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] py-3"><div><div className="text-sm font-medium">{label}</div>{description&&<p className="text-xs text-[var(--text-muted)]">{description}</p>}</div>
 <Popover open={open} onOpenChange={v=>{setOpen(v);setQuery('');setActive(0);}}><PopoverTrigger asChild><Button variant="outline" disabled={disabled} role="combobox" aria-label={label} aria-expanded={open} aria-controls={id} className="max-w-full justify-between gap-4">{options.find(o=>o.value===value)?.label??value}<ChevronsUpDown size={14}/></Button></PopoverTrigger>
 <PopoverContent align="end" className="space-y-2" style={{maxWidth:'calc(100vw - 2rem)'}}><Input autoFocus placeholder="Buscar ciudad o región…" aria-label="Buscar zona horaria" aria-controls={id} aria-activedescendant={found[active]?id+'-'+active:undefined} role="combobox" aria-expanded={open} value={query} onChange={e=>{setQuery(e.target.value);setActive(0);}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setActive(n=>Math.min(n+1,found.length-1));}else if(e.key==='ArrowUp'){e.preventDefault();setActive(n=>Math.max(0,n-1));}else if(e.key==='Enter'&&found[active]){e.preventDefault();choose(found[active]!.value);}}}/>
 <div id={id} role="listbox" aria-label="Zonas horarias" className="max-h-64 overflow-y-auto">{found.map((o,i)=><button type="button" role="option" aria-selected={o.value===value} id={id+'-'+i} key={o.value} className={'flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm '+(i===active?'bg-[var(--surface-hover)]':'')} onMouseEnter={()=>setActive(i)} onClick={()=>choose(o.value)}>{o.label}{o.value===value&&<Check size={14}/>}</button>)}{!found.length&&<p className="p-2 text-sm">No encontramos esa zona.</p>}</div></PopoverContent></Popover></div>;
}
