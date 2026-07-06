/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// ─── Store de perfil ERP activo (multi-perfil) ──────────────────────────────
// El perfil activo scopea Finanzas + Inventario (NO el resto del SO). Su id viaja
// como header X-Claw-Profile-Id en TODAS las requests (services/api.ts lo lee de
// este store). Al cambiar de perfil, se emite `claw:profile-changed` para que
// Finanzas e Inventario recarguen. Persist solo el id activo (los perfiles se
// refrescan del backend).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as svc from '@/services/profiles.service';
import type { ErpProfile, CreateProfileInput, UpdateProfileInput } from '@/services/profiles.service';

/** Evento de ventana emitido al cambiar de perfil (lo escuchan Finanzas/Inventario). */
export const PROFILE_CHANGED_EVENT = 'claw:profile-changed';

function emitProfileChanged(profileId: string | null): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT, { detail: { profileId } }));
  }
}

/** Reconciliación del perfil activo: mantener si sigue vivo; si no, el por defecto; si no, el primero. */
function resolveActive(profiles: ErpProfile[], current: string | null): string | null {
  if (current && profiles.some((p) => p.id === current)) return current;
  return profiles.find((p) => p.is_default)?.id ?? profiles[0]?.id ?? null;
}

interface ProfileState {
  profiles: ErpProfile[];
  activeProfileId: string | null;
  loading: boolean;
  loaded: boolean;
  loadProfiles: () => Promise<void>;
  setActiveProfile: (id: string) => Promise<void>;
  createProfile: (input: CreateProfileInput) => Promise<ErpProfile>;
  updateProfile: (id: string, patch: UpdateProfileInput) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  getActiveProfile: () => ErpProfile | null;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      loading: false,
      loaded: false,

      loadProfiles: async () => {
        set({ loading: true });
        try {
          const profiles = await svc.listProfiles();
          set((s) => ({
            profiles,
            activeProfileId: resolveActive(profiles, s.activeProfileId),
            loading: false,
            loaded: true,
          }));
        } catch {
          set({ loading: false, loaded: true });
        }
      },

      setActiveProfile: async (id) => {
        if (id === get().activeProfileId) return;
        // Optimista: el header de api.ts recoge el nuevo id al instante.
        set({ activeProfileId: id });
        try {
          await svc.setActiveProfile(id);
        } catch {
          /* best-effort: la persistencia server-side no bloquea el cambio local */
        }
        emitProfileChanged(id);
      },

      createProfile: async (input) => {
        const created = await svc.createProfile(input);
        set((s) => ({ profiles: [...s.profiles, created] }));
        return created;
      },

      updateProfile: async (id, patch) => {
        const updated = await svc.updateProfile(id, patch);
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? updated : p)) }));
      },

      setDefault: async (id) => {
        await svc.setDefaultProfile(id);
        set((s) => ({ profiles: s.profiles.map((p) => ({ ...p, is_default: p.id === id })) }));
      },

      deleteProfile: async (id) => {
        await svc.deleteProfile(id);
        // Borrar un perfil puede promover otro a por-defecto server-side → refrescar.
        await get().loadProfiles();
        emitProfileChanged(get().activeProfileId);
      },

      getActiveProfile: () => {
        const s = get();
        return s.profiles.find((p) => p.id === s.activeProfileId) ?? null;
      },
    }),
    {
      name: 'claw-profile',
      partialize: (s) => ({ activeProfileId: s.activeProfileId }),
    },
  ),
);
