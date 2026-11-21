import {api} from './api';
import type {InstalledApp} from '@/types/apps';

export interface RegistryPackage {
  name:string;version:string;description?:string;level?:string;claw_file?:string;manifest?:Record<string,unknown>;
}
export interface PublicRegistryPackage {
  name:string;version:string;display_name:string;description:string;app_level:1|2|3;license:string;keywords:string[];
  repository:{url:string;revision:string};
  package:{url:string;sha256:string;bytes:number};source:{url:string;sha256:string;bytes:number};
  author?:string;origin?:'Micelclaw'|'OpenClaw'|'Tuya'|'Community';
  tier_required?:'free'|'pro'|'plus';icon?:string;icon_kind?:'emoji'|'lucide';color?:string;tags?:string[];
}
export interface RegistryDownloadProgress {
  name:string;version:string;phase:'downloading'|'checking'|'ready'|'failed';
  received_bytes:number;total_bytes:number;error_code?:string;
}
export async function listLocalRegistry(){return (await api.get<{data:RegistryPackage[]}>('/apps/registry')).data;}
export async function listPublicRegistry(refresh=false){return (await api.get<{data:{schema_version:1;packages:PublicRegistryPackage[]}}>('/apps/registry/public',{refresh:refresh?'1':undefined})).data.packages;}
export async function downloadRegistryPackage(app:PublicRegistryPackage){return (await api.post<{data:RegistryPackage}>('/apps/registry/download',{name:app.name,version:app.version},{timeout:240_000})).data;}
export async function getRegistryDownloadProgress(app:Pick<PublicRegistryPackage,'name'|'version'>){
  return (await api.get<{data:RegistryDownloadProgress|null}>('/apps/registry/download-progress',{name:app.name,version:app.version})).data;
}
export async function importRegistryPackage(file:File){
  const form=new FormData();form.append('file',file);
  return api.upload('/apps/registry/import',form,'POST',{timeout:120_000});
}

export type RegistryDisplayState='public'|'downloaded'|'installed'|'update_available'|'inactive';
export function registryDisplayState(app:RegistryPackage,installed:InstalledApp[]):RegistryDisplayState{
  const actual=installed.find(row=>row.app_name===app.name&&row.status!=='archived');
  if(actual?.status==='active')return actual.version===app.version?'installed':'update_available';
  if(actual&&actual.version===app.version)return 'inactive';
  return app.claw_file?'downloaded':'public';
}
