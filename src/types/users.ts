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
