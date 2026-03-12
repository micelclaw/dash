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

import { create } from 'zustand';
import type { AdminUser, CreateUserPayload, UpdateUserPayload } from '@/types/users';
import * as usersService from '@/services/users.service';

interface UsersStore {
  users: AdminUser[];
  loading: boolean;
  error: string | null;

  fetchUsers: () => Promise<void>;
  createUser: (payload: CreateUserPayload) => Promise<AdminUser>;
  updateUser: (id: string, payload: UpdateUserPayload) => Promise<AdminUser>;
  setPassword: (id: string, newPassword: string) => Promise<void>;
  generateResetLink: (id: string) => Promise<{ reset_url: string; email: string }>;
  suspendUser: (id: string) => Promise<void>;
  reactivateUser: (id: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export const useUsersStore = create<UsersStore>()((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const users = await usersService.listUsers();
      set({ users, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load users',
        loading: false,
      });
    }
  },

  createUser: async (payload) => {
    const user = await usersService.createUser(payload);
    set({ users: [user, ...get().users] });
    return user;
  },

  updateUser: async (id, payload) => {
    const updated = await usersService.updateUser(id, payload);
    set({ users: get().users.map((u) => (u.id === id ? updated : u)) });
    return updated;
  },

  setPassword: async (id, newPassword) => {
    await usersService.setUserPassword(id, newPassword);
  },

  generateResetLink: async (id) => {
    return usersService.generateResetLink(id);
  },

  suspendUser: async (id) => {
    const updated = await usersService.suspendUser(id);
    set({ users: get().users.map((u) => (u.id === id ? updated : u)) });
  },

  reactivateUser: async (id) => {
    const updated = await usersService.reactivateUser(id);
    set({ users: get().users.map((u) => (u.id === id ? updated : u)) });
  },

  deleteUser: async (id) => {
    await usersService.deleteUser(id);
    set({ users: get().users.filter((u) => u.id !== id) });
  },
}));
