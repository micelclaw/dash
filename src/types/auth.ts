export type UserRole = 'owner' | 'admin' | 'user';
export type Tier = 'free' | 'pro';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  tier: Tier;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
}
