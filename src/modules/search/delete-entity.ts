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

import { api } from '@/services/api';

const DOMAIN_DELETE_PATHS: Record<string, (id: string) => string> = {
  note:         (id) => `/notes/${id}`,
  event:        (id) => `/events/${id}`,
  contact:      (id) => `/contacts/${id}`,
  email:        (id) => `/emails/${id}`,
  diary:        (id) => `/diary/${id}`,
  file:         (id) => `/files/${id}`,
  photo:        (id) => `/files/${id}`,
  conversation: (id) => `/conversations/threads/${id}`,
  bookmark:     (id) => `/bookmarks/${id}`,
};

export function canDelete(domain: string): boolean {
  return domain in DOMAIN_DELETE_PATHS;
}

export async function deleteEntity(domain: string, recordId: string): Promise<void> {
  const pathFn = DOMAIN_DELETE_PATHS[domain];
  if (!pathFn) throw new Error(`Delete not supported for domain: ${domain}`);
  await api.delete(pathFn(recordId));
}
