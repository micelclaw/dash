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

// ─── Database credentials service ───────────────────────────────────
//
// Wraps `POST /api/v1/settings/database-credentials` — the
// password-confirmed reveal of PostgreSQL + MariaDB connection
// details used by DatabaseSection. Owner-only.

import { api } from './api';

export interface PgCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface MariaDBCredentials {
  host: string;
  port: number;
  root_password: string | null;
  databases: Record<string, { user: string; password: string }>;
}

export interface DatabaseCredentialsResponse {
  postgresql: PgCredentials | null;
  mariadb: MariaDBCredentials | null;
}

export async function revealCredentials(password: string): Promise<DatabaseCredentialsResponse> {
  const res = await api.post<{ data: DatabaseCredentialsResponse }>(
    '/settings/database-credentials',
    { password },
  );
  return res.data;
}
