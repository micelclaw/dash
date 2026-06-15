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

export type UserRole = 'owner' | 'admin' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  avatar_path: string | null;
  role: UserRole;
  status: UserStatus;
  language: string | null;
  timezone: string | null;
  last_login_at: string | null;
  storage_used_bytes: number;
  created_at: string;
  updated_at: string;
}

/** Media por servicio (checkboxes del wizard). Grupo A = cuenta en servicio
 *  compartido; grupo B = contenedor dedicado (privado). */
export interface CreateUserMedia {
  /** Servicios compartidos donde crear cuenta: jellyfin/audiobookshelf/calibreweb/jellyseerr. */
  shared_services: string[];
  /** Servicios dedicados (contenedor propio): navidrome. */
  dedicated_services: string[];
}

export interface CreateUserPayload {
  email: string;
  display_name: string;
  password: string;
  role: UserRole;
  media?: CreateUserMedia;
}

export interface UpdateUserPayload {
  display_name?: string;
  email?: string;
  role?: string;
}
