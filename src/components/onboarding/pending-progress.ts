import { progressKey, normalizeProgress, type SetupProgress } from './progress';
export interface PendingProgress {
 version: 1; id: string; progress: SetupProgress; base: SetupProgress | null; base_known: boolean; attempted?:SetupProgress|null;
}
const key = (origin: string, userId: string) => progressKey(origin, userId) + ':pending';
export function sameProgress(a: SetupProgress | null, b: SetupProgress | null): boolean {
 if (!a || !b) return a === b;
 const normalize = (p: SetupProgress) => { const n=normalizeProgress(p); return JSON.stringify([n.version,n.step,[...n.skipped].sort(),n.paused,[...n.selections].sort(),n.welcome_note_id??null]); };
 return normalize(a) === normalize(b);
}
export function readPending(origin: string, userId: string): PendingProgress | null {
 try {
  const p = JSON.parse(localStorage.getItem(key(origin,userId)) ?? 'null');
  const valid = (v: unknown) => !!v && typeof v==='object' && (v as SetupProgress).version===1 && typeof (v as SetupProgress).step==='string' && Array.isArray((v as SetupProgress).skipped) && Array.isArray((v as SetupProgress).selections) && typeof (v as SetupProgress).paused==='boolean';
  if(p?.version!==1 || typeof p.id!=='string' || typeof p.base_known!=='boolean' || !valid(p.progress) || (p.base!==null&&!valid(p.base)) || (p.attempted!=null&&!valid(p.attempted))) return null;
  return {...p,progress:normalizeProgress(p.progress),base:p.base?normalizeProgress(p.base):null};
 } catch {return null;}
}
export function persistPending(origin: string,userId: string,p:PendingProgress):boolean {
 try {localStorage.setItem(key(origin,userId),JSON.stringify(p));return true;} catch{return false;}
}
export function confirmPending(origin:string,userId:string,id:string):boolean {
 try {if(readPending(origin,userId)?.id!==id)return false;localStorage.removeItem(key(origin,userId));return true;} catch{return false;}
}
