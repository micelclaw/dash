import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useChatWorkspaceStore, type WorkspaceResource } from '@/stores/chat-workspace.store';
import { useAuthStore } from '@/stores/auth.store';
import { useProfileStore } from '@/stores/profile.store';
import { mcpAppsService } from '@/services/mcp-apps.service';
import { MCPAppFrame } from '../MCPAppFrame';
import { parseProductivityContext } from './reference';
import { isProductivityLaunchCurrent } from '@/lib/productivity-publication';

type Resource = Extract<WorkspaceResource, { kind: 'productivity' }>;
export default function ProductivityResult({ chat, resource }: { chat: string; resource: Resource }) {
 const [failure, setFailure] = useState<{ ref: string; epoch: number; message: string } | null>(null); const [retry, setRetry] = useState(0);
 const profile = useProfileStore(state => state.activeProfileId); const generation = useAuthStore(state => state.sessionGeneration);
 const profileName = useProfileStore(state => state.profiles.find(item => item.id === resource.reference.erp_profile_id)?.name);
 const mismatch = !!resource.reference.erp_profile_id && resource.reference.erp_profile_id !== profile;
 const latest = useRef(resource); useLayoutEffect(() => { latest.current = resource; });
 const viewEpoch = resource.viewEpoch ?? 0;
 const referenceId = resource.reference.id; const error = failure?.ref === referenceId && failure.epoch === viewEpoch ? failure.message : '';
 useEffect(() => {
  const item = latest.current; if (item.view || mismatch) return;
  const epoch = useChatWorkspaceStore.getState().byConversation[chat]?.epoch;
  if (epoch === undefined || !isProductivityLaunchCurrent(chat, item.reference, epoch, viewEpoch)) return;
  const controller = new AbortController();
  void mcpAppsService.launchProductivity(chat, item.reference, controller.signal).then(view => {
   const context = parseProductivityContext(view.host_context['micelclaw/productivity'], item.reference.area);
   if (controller.signal.aborted || useAuthStore.getState().sessionGeneration !== generation || !isProductivityLaunchCurrent(chat, item.reference, epoch, viewEpoch) || latest.current.reference.id !== referenceId || item.reference.erp_profile_id && useProfileStore.getState().activeProfileId !== item.reference.erp_profile_id) { void mcpAppsService.close(chat, view).catch(() => {}); return; }
   if (!context || context.id !== referenceId || context.conversation_id !== chat || context.erp_profile_id !== item.reference.erp_profile_id) { void mcpAppsService.close(chat, view).catch(() => {}); throw new Error('La referencia de la vista no coincide.'); }
   useChatWorkspaceStore.getState().upsert(chat, { ...latest.current, view, context });
  }).catch(() => { if (!controller.signal.aborted && isProductivityLaunchCurrent(chat, item.reference, epoch, viewEpoch)) setFailure({ ref: referenceId, epoch: viewEpoch, message: 'No se pudo abrir la vista. Comprueba el acceso o los permisos pendientes en el chat.' }); });
  return () => controller.abort();
 }, [chat, referenceId, mismatch, generation, retry, viewEpoch]);
 if (mismatch) return <p role="status" className="p-4">Esta vista pertenece al perfil anterior. Pide el resultado con el perfil actual para volver a abrirla.</p>;
 if (!resource.view) return <div className="p-4"><p role={error ? 'alert' : 'status'}>{error || 'Abriendo la vista; si hace falta permiso, aparecerá en el chat.'}</p>{error && <button onClick={() => { setFailure(null); setRetry(value => value + 1); }}>Volver a abrir</button>}</div>;
 const view = resource.context ? { ...resource.view, host_context: { ...resource.view.host_context, 'micelclaw/productivity': resource.context } } : resource.view;
 const frame = <MCPAppFrame conversationId={chat} view={view} onMessage={text => window.dispatchEvent(new CustomEvent('micelclaw:mcp-app-draft', { detail: { conversation_id: chat, text } }))} onOpenFile={async () => { throw new Error('Esta vista muestra archivos dentro del propio panel.'); }} onContext={() => {}} onRevoked={() => { useChatWorkspaceStore.getState().upsert(chat, { ...latest.current, view: null }); setFailure({ ref: latest.current.reference.id, epoch: latest.current.viewEpoch ?? 0, message: 'El acceso a esta vista ha caducado. Vuelve a abrirla para comprobar los permisos.' }); }} />;
 return resource.reference.erp_profile_id ? <div className="flex h-full min-h-0 flex-col"><p className="shrink-0 border-b border-(--border) px-4 py-2 text-xs text-(--text-dim)">Perfil: {profileName || 'Perfil ERP seleccionado'}</p><div className="min-h-0 flex-1">{frame}</div></div> : frame;
}
