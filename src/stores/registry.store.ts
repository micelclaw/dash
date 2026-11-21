import {create} from 'zustand';
import {listLocalRegistry,listPublicRegistry,downloadRegistryPackage,getRegistryDownloadProgress,type RegistryPackage,type PublicRegistryPackage,type RegistryDownloadProgress} from '@/services/public-registry.service';
import {getInstalledApps,installApp,updateAppStatus} from '@/services/apps.service';
import {useAuthStore} from './auth.store';
import {useAppsStore} from './apps.store';
import {useUiModulesStore} from './ui-modules.store';
import type {InstalledApp} from '@/types/apps';

const owner=()=>`${useAuthStore.getState().user?.id??''}:${useAuthStore.getState().sessionGeneration}:${useAuthStore.getState().user?.role??''}`;
const canManage=()=>['admin','owner'].includes(useAuthStore.getState().user?.role??'');
const message=(error:unknown)=>error instanceof Error?error.message:String(error);
interface RegistryStore {
  owner:string;local:RegistryPackage[];catalog:PublicRegistryPackage[];installed:InstalledApp[];
  loading:boolean;local_error:string|null;public_error:string|null;installed_error:string|null;busy:Record<string,'downloading'|'installing'|'removing'>;
  progress:Record<string,RegistryDownloadProgress>;errors:Record<string,string>;
  refresh:(force?:boolean)=>Promise<void>;download:(app:PublicRegistryPackage)=>Promise<RegistryPackage|undefined>;install:(app:RegistryPackage)=>Promise<void>;
  activate:(app:InstalledApp)=>Promise<void>;deactivate:(app:InstalledApp,removeFiles?:boolean)=>Promise<void>;
}
let generation=0;
export const useRegistryStore=create<RegistryStore>((set,get)=>({
  owner:'',local:[],catalog:[],installed:[],loading:false,local_error:null,public_error:null,installed_error:null,busy:{},progress:{},errors:{},
  refresh:async(force=false)=>{
    const principal=owner(),ticket=++generation;
    if(get().owner!==principal)set({owner:principal,local:[],catalog:[],installed:[],busy:{},progress:{},errors:{}});
    set({loading:true});
    // Local inventory and installation retain the existing administrative API
    // boundary. Normal users can browse the new public metadata endpoint.
    const [local,remote,installed]=await Promise.allSettled([canManage()?listLocalRegistry():Promise.resolve([]),listPublicRegistry(force),canManage()?getInstalledApps():Promise.resolve({data:[]})]);
    if(owner()!==principal||ticket!==generation)return;
    set({loading:false,
      ...(local.status==='fulfilled'?{local:local.value,local_error:null}:{local_error:message(local.reason)}),
      ...(remote.status==='fulfilled'?{catalog:remote.value,public_error:null}:{public_error:message(remote.reason)}),
      ...(installed.status==='fulfilled'?{installed:installed.value.data.filter(app=>app.status!=='archived'),installed_error:null}:{installed_error:message(installed.reason)}),
    });
  },
  download:async app=>{
    if(!canManage())throw new Error('Registry changes require administrator access.');
    const principal=owner();if(get().busy[app.name])return;
    let active=true;
    set(s=>{const progress={...s.progress};delete progress[app.name];return {busy:{...s.busy,[app.name]:'downloading'},progress,errors:{...s.errors,[app.name]:''}};});
    // Polls only report presentation. The successful POST and local inventory
    // remain the completion signal, so stale ready states cannot navigate.
    const poll=async()=>{
      while(active&&owner()===principal){
        try{const progress=await getRegistryDownloadProgress(app);
          if(active&&owner()===principal&&progress?.version===app.version&&!['ready','failed'].includes(progress.phase))set(s=>({progress:{...s.progress,[app.name]:progress}}));
        }catch{/* Older Core: keep the activity indicator without inventing %. */}
        if(active&&owner()===principal)await new Promise(resolve=>setTimeout(resolve,450));
      }
    };
    try{
      const request=downloadRegistryPackage(app);void poll();const result=await request;
      if(owner()!==principal)return;
      await get().refresh();if(owner()!==principal)return;
      const local=get().local.find(row=>row.name===app.name&&row.version===app.version&&row.claw_file);
      if(get().local_error||!local||result.name!==app.name||result.version!==app.version)throw new Error('The downloaded package could not be confirmed in Available.');
      return local;
    }catch(error){if(owner()===principal)set(s=>({errors:{...s.errors,[app.name]:message(error)}}));throw error;}
    finally{active=false;if(owner()===principal)set(s=>{const busy={...s.busy},progress={...s.progress};delete busy[app.name];delete progress[app.name];return {busy,progress};});}
  },
  install:async app=>{
    if(!canManage())throw new Error('Registry changes require administrator access.');
    if(!app.claw_file)throw new Error('Package is not in the local registry.');
    const principal=owner();if(get().busy[app.name])return;
    set(s=>({busy:{...s.busy,[app.name]:'installing'}}));
    try{
      const result=await installApp({source:'registry',name:app.name,package_path:app.claw_file,activate:true},{timeout:240_000});
      if(owner()!==principal)return;
      const rows=(await getInstalledApps()).data;
      if(owner()!==principal)return;
      if(!rows.some(row=>row.app_name===app.name&&row.version===app.version&&row.status==='active'))throw new Error('Installation could not be confirmed.');
      if(result.requires_core_restart)useAppsStore.getState().setRestartRequired('core',app.name);
      if(result.requires_openclaw_restart)useAppsStore.getState().setRestartRequired('openclaw',app.name);
      await Promise.all([get().refresh(),useAppsStore.getState().fetchInstalledApps(),useUiModulesStore.getState().refresh()]);
    }finally{if(owner()===principal)set(s=>{const busy={...s.busy};delete busy[app.name];return{busy};});}
  },
  activate:async app=>{
    if(!canManage())throw new Error('Registry changes require administrator access.');
    const name=app.app_name;
    const principal=owner();if(get().busy[name])return;
    set(s=>({busy:{...s.busy,[name]:'installing'}}));
    try{
      await updateAppStatus(name,'active');if(owner()!==principal)return;
      if(app.app_level===1)useAppsStore.getState().setRestartRequired('openclaw',name);
      await Promise.all([get().refresh(),useAppsStore.getState().fetchInstalledApps(),useUiModulesStore.getState().refresh()]);
    }finally{if(owner()===principal)set(s=>{const busy={...s.busy};delete busy[name];return{busy};});}
  },
  deactivate:async(app,removeFiles=false)=>{
    if(!canManage())throw new Error('Registry changes require administrator access.');
    const name=app.app_name,principal=owner();if(get().busy[name])return;
    set(s=>({busy:{...s.busy,[name]:'removing'}}));
    try{
      const result=await updateAppStatus(name,'available',removeFiles);if(owner()!==principal)return;
      if(result.requires_core_restart)useAppsStore.getState().setRestartRequired('core',name);
      if(result.requires_openclaw_restart||app.app_level===1)useAppsStore.getState().setRestartRequired('openclaw',name);
      await Promise.all([get().refresh(),useAppsStore.getState().fetchInstalledApps(),useUiModulesStore.getState().refresh()]);
    }finally{if(owner()===principal)set(s=>{const busy={...s.busy};delete busy[name];return{busy};});}
  },
}));
