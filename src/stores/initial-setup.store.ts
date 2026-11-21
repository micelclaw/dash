import { readInitialProgress, saveInitialProgress } from '@/services/initial-setup.service';
import { create } from 'zustand';
import { useAuthStore } from './auth.store';
import { provisionAgents, syncUserProfile } from '@/services/gateway.service';
import { normalizeProgress, emptyProgress, readProgress, writeProgress, type SetupProgress } from '@/components/onboarding/progress';
import { readPending, persistPending, confirmPending, sameProgress, type PendingProgress } from '@/components/onboarding/pending-progress';
interface InitialSetupState {
 userId: string | null; loadedGeneration:number|null; progress: SetupProgress;
 confirmed:SetupProgress|null; confirmedKnown:boolean; pending:PendingProgress|null;
 storageError:boolean; savingProgress:boolean; progressConflict:boolean;
 retryProgress:()=>Promise<void>; resolveProgressConflict:(choice:'local'|'server')=>Promise<void>;
 agents:'pending'|'preparing'|'prepared'|'error'; agentsError:string|null;
 load:(userId:string)=>Promise<void>; save:(patch:Partial<SetupProgress>)=>void; prepareAgents:()=>Promise<void>;
}
let progressWrites:Promise<void>=Promise.resolve();
let flight:{id:string;generation:number;promise:Promise<void>}|null=null;
export const useInitialSetupStore = create<InitialSetupState>()((set,get)=>{
 const current=(id:string,generation:number,origin:string)=>window.location.origin===origin && get().userId===id && get().loadedGeneration===generation && useAuthStore.getState().user?.id===id && useAuthStore.getState().user?.role==='owner' && useAuthStore.getState().sessionGeneration===generation;
 const persist=(id:string,origin:string,p:PendingProgress)=>{
  // One atomic durable intent precedes both the legacy local view and the PUT.
  const ok=persistPending(origin,id,p);if(ok)writeProgress(origin,id,p.progress);return ok;
 };
 const accept=(id:string,origin:string,server:SetupProgress|null,p:PendingProgress|null)=>{
  const ok=!p || confirmPending(origin,id,p.id);
  if(!ok){const latest=readPending(origin,id);set({progress:latest?.progress??get().progress,pending:latest??p,storageError:true,progressConflict:true});return;}
  const progress=server??emptyProgress();writeProgress(origin,id,progress);
  set({progress,confirmed:server,confirmedKnown:true,pending:ok?null:p,storageError:!ok,progressConflict:false});
 };
 const sync=async(id:string,generation:number,origin:string)=>{
  if(!current(id,generation,origin))return;
  const p=get().pending;if(!p)return;
  set({savingProgress:true});
  try{
   const response=await readInitialProgress();if(!current(id,generation,origin))return;
   const server=response?normalizeProgress(response):null;
   const latest=get().pending;if(!latest)return;
   if(sameProgress(server,latest.progress)){accept(id,origin,server,latest);return;}
   if(!((latest.base_known&&sameProgress(server,latest.base)) || (latest.attempted&&sameProgress(server,latest.attempted)))){
    set({storageError:true,progressConflict:true,confirmed:server,confirmedKnown:true});return;
   }
   // Persist the exact attempted body so a lost response is recognized on F5.
   const sent={...latest,base:server,base_known:true,attempted:latest.progress};
   if(!persist(id,origin,sent)){set({storageError:true});return;}
   set({pending:sent});await saveInitialProgress(sent.progress);
   if(!current(id,generation,origin))return;
   const newer=get().pending;
   if(newer?.id===sent.id)accept(id,origin,sent.progress,sent);
   else if(newer){
    const rebased={...newer,base:sent.progress,base_known:true,attempted:null};
    const ok=persist(id,origin,rebased);set({pending:rebased,confirmed:sent.progress,confirmedKnown:true,storageError:!ok});
   }
  }catch{if(current(id,generation,origin))set({storageError:true});}
  finally{if(current(id,generation,origin))set({savingProgress:false});}
 };
 const enqueue=(id:string,generation:number,origin:string)=>{
  progressWrites=progressWrites.catch(()=>{}).then(()=>sync(id,generation,origin));return progressWrites;
 };
 return {
  userId:null,loadedGeneration:null,progress:emptyProgress(),confirmed:null,confirmedKnown:false,pending:null,storageError:false,savingProgress:false,progressConflict:false,agents:'pending',agentsError:null,
  load:async id=>{
   const session=useAuthStore.getState(),origin=window.location.origin,generation=session.sessionGeneration;
   if(session.user?.id!==id||session.user.role!=='owner')return;
   if(get().userId===id&&get().loadedGeneration===generation)return;
   const pending=readPending(origin,id),local=pending?.progress??readProgress(origin,id)??emptyProgress();
   set({userId:id,loadedGeneration:generation,progress:local,pending,confirmed:null,confirmedKnown:false,agents:'pending',agentsError:null,storageError:!!pending,savingProgress:true,progressConflict:false});
   try{
    const response=await readInitialProgress();if(!current(id,generation,origin))return;
    const server=response?normalizeProgress(response):null;
    // A save while this GET was outstanding also wins over its stale result.
    const latest=get().pending;
    if(latest){
     if(sameProgress(server,latest.progress))accept(id,origin,server,latest);
     else set({confirmed:server,confirmedKnown:true,storageError:true,progressConflict:!((latest.base_known&&sameProgress(server,latest.base)) || (latest.attempted&&sameProgress(server,latest.attempted)))});
    }else if(server)accept(id,origin,server,null);
    else{set({confirmed:null,confirmedKnown:true});get().save({});}
   }catch{if(current(id,generation,origin))set({storageError:true});}
   finally{if(current(id,generation,origin))set({savingProgress:false});}
  },
  save:patch=>{
   const state=get(),session=useAuthStore.getState(),id=state.userId,origin=window.location.origin;
   if(!id||!current(id,session.sessionGeneration,origin))return;
   const next={...state.progress,...patch};
   const p:PendingProgress={version:1,id:crypto.randomUUID(),progress:next,base:state.pending?state.pending.base:state.confirmed,base_known:state.pending?.base_known??state.confirmedKnown,attempted:state.pending?.attempted??null};
   const durable=persist(id,origin,p);set({progress:next,pending:p,storageError:!durable||state.storageError,savingProgress:durable});
   if(durable&&!state.progressConflict)void enqueue(id,session.sessionGeneration,origin);
  },
  retryProgress:async()=>{
   const s=useAuthStore.getState();if(s.user?.role!=='owner')return;
   if(!get().userId||get().loadedGeneration!==s.sessionGeneration)await get().load(s.user.id);
   await enqueue(s.user.id,s.sessionGeneration,window.location.origin);
  },
  resolveProgressConflict:async choice=>{
   const s=useAuthStore.getState(),id=get().userId,origin=window.location.origin;
   if(!id||!current(id,s.sessionGeneration,origin))return;
   set({savingProgress:true});
   try{
    const response=await readInitialProgress();if(!current(id,s.sessionGeneration,origin))return;
    const server=response?normalizeProgress(response):null,p=get().pending;
    if(choice==='server'){accept(id,origin,server,p);return;}
    if(p){const rebased={...p,base:server,base_known:true,attempted:null};const ok=persist(id,origin,rebased);set({pending:rebased,progressConflict:false,storageError:!ok});if(ok)await enqueue(id,s.sessionGeneration,origin);}
   }catch{if(current(id,s.sessionGeneration,origin))set({storageError:true});}
   finally{if(current(id,s.sessionGeneration,origin))set({savingProgress:false});}
  },
  prepareAgents:async()=>{
   const {user,sessionGeneration}=useAuthStore.getState();if(!user||!['owner','admin'].includes(user.role))return;
   await get().load(user.id);if(flight?.id===user.id&&flight.generation===sessionGeneration)return flight.promise;
   const valid=()=>useAuthStore.getState().user?.id===user.id&&useAuthStore.getState().sessionGeneration===sessionGeneration;
   if(!valid())return;
   const task={id:user.id,generation:sessionGeneration,promise:(async()=>{
    set({agents:'preparing',agentsError:null});
    try{const result=await provisionAgents();if(!valid())return;if(result.skipped&&result.reason!=='agents_already_exist')throw new Error(result.reason??'Preparación de agentes omitida');if(!result.skipped&&result.provisioned<1)throw new Error('La preparación no confirmó agentes');await syncUserProfile();if(valid())set({agents:'prepared',agentsError:null});}
    catch(e){if(valid())set({agents:'error',agentsError:e instanceof Error?e.message:'Falló la preparación de agentes'});}
   })()};flight=task;try{await task.promise;}finally{if(flight===task)flight=null;}
  }
 };
});
