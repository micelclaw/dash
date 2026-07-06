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

// ─── Servicio de perfiles ERP (multi-perfil) ────────────────────────────────
// CRUD de perfiles ERP: cada perfil es un LIBRO aislado (Inventario + Facturación
// + Contabilidad + Personal). El backend valida la pertenencia por usuario.

import { api } from '@/services/api';

export type ProfileKind = 'business' | 'personal';

export interface ErpProfile {
  id: string;
  name: string;
  kind: ProfileKind;
  is_default: boolean;
  base_currency: string;
  color: string | null;
  icon: string | null;
  created_at: string;
}

export interface CreateProfileInput {
  name: string;
  kind?: ProfileKind;
  base_currency?: string;
  color?: string | null;
  icon?: string | null;
}

export type UpdateProfileInput = Partial<CreateProfileInput>;

export async function listProfiles(): Promise<ErpProfile[]> {
  const res = await api.get<{ data: ErpProfile[] }>('/profiles');
  return res.data;
}

export async function createProfile(input: CreateProfileInput): Promise<ErpProfile> {
  const res = await api.post<{ data: ErpProfile }>('/profiles', input);
  return res.data;
}

export async function updateProfile(id: string, patch: UpdateProfileInput): Promise<ErpProfile> {
  const res = await api.patch<{ data: ErpProfile }>(`/profiles/${id}`, patch);
  return res.data;
}

export async function setDefaultProfile(id: string): Promise<ErpProfile> {
  const res = await api.post<{ data: ErpProfile }>(`/profiles/${id}/default`);
  return res.data;
}

export async function deleteProfile(id: string): Promise<void> {
  await api.delete(`/profiles/${id}`);
}

/** Persiste la selección de perfil activo del usuario (users.settings.active_profile). */
export async function setActiveProfile(id: string): Promise<void> {
  await api.post('/profiles/active', { profile_id: id });
}
