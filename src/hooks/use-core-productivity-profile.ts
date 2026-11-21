import { useEffect } from 'react';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useProfileStore } from '@/stores/profile.store';
import { useChatStore } from '@/stores/chat.store';
import { useChatWorkspaceStore } from '@/stores/chat-workspace.store';
import { bindProductivityProfiles } from '@/lib/productivity-profile-binding';

/** Central Core mount. Canvas rendering and draft ownership remain in S06's consumers. */
export function useCoreProductivityProfile() {
 const userId = useAuthStore(state => state.user?.id ?? null);
 const sessionGeneration = useAuthStore(state => state.sessionGeneration);
 const profileId = useProfileStore(state => state.activeProfileId);
 const conversation = useChatStore(state => state.activeConversationId);
 useEffect(() => {
  if (!userId) return;
  const controller = new AbortController();
  const conversations = [...Object.keys(useChatWorkspaceStore.getState().byConversation), ...(conversation ? [conversation] : [])];
  void bindProductivityProfiles({ snapshot: { userId, sessionGeneration, profileId }, signal: controller.signal, conversations,
   current: () => ({ userId: useAuthStore.getState().user?.id ?? null, sessionGeneration: useAuthStore.getState().sessionGeneration, profileId: useProfileStore.getState().activeProfileId }),
   status: async () => {
    const { data } = await api.get<{ data: { profile_binding_supported?: boolean; enabled?: boolean; runtime_ready?: boolean } }>('/mcp-apps/status', undefined, { signal: controller.signal });
    return { profile_binding_supported: data.profile_binding_supported === true && data.enabled === true && data.runtime_ready === true };
   },
   // api.ts supplies the current human session and X-Claw-Profile-Id. Core revalidates membership.
   select: id => api.post(`/conversations/${encodeURIComponent(id)}/mcp-app-profile`, undefined, { signal: controller.signal }),
  });
  return () => controller.abort();
 }, [userId, sessionGeneration, profileId, conversation]);
}
