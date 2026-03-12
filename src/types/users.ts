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

export interface CreateUserPayload {
  email: string;
  display_name: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  display_name?: string;
  email?: string;
  role?: string;
}
