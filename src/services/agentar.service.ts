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

// Wraps `/api/v1/agentar/*` — Agentar package export, validate, install.
// Validate and install both accept a multipart upload; the dash holds the
// File client-side and uploads it once for validate (preview), then again
// for install when the user confirms. Server-side state isn't shared
// between the two calls, so re-uploading is the simplest contract.

import { useAuthStore } from '@/stores/auth.store';
import { api, ApiError } from './api';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const API_PREFIX = '/api/v1';

export interface AgentarValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

export interface AgentarManifestPreview {
  spec_version: number;
  name: string;
  display_name: string;
  version: string;
  description?: string;
  model?: string;
  color?: string;
  avatar?: string;
  scopes: string[];
  skills: string[];
  is_chief: boolean;
  role?: string;
}

export interface AgentarValidationResult {
  manifest: AgentarManifestPreview;
  embedded_skills: string[];
  file_count: number;
  valid: boolean;
  issues: AgentarValidationIssue[];
  missing_skills: string[];
}

export interface AgentarInstallResult {
  agent_id: string;
  per_user_agent_id: string;
  workspace_path: string;
  token: string;
  warnings: AgentarValidationIssue[];
  missing_skills: string[];
  readme_path: string;
}

/** Stream the .tar.gz of an existing managed agent. */
export async function downloadAgentarExport(
  agentId: string,
  embedSkills: boolean,
): Promise<Blob> {
  const token = useAuthStore.getState().tokens?.accessToken ?? null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${API_PREFIX}/agentar/export/${agentId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ embed_skills: embedSkills }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError('EXPORT_FAILED', text || `Export failed: ${res.status}`, undefined, res.status);
  }
  return res.blob();
}

/** Upload a .claw-agent or .tar.gz file and return the validation report. */
export async function validateAgentarPackage(file: File): Promise<AgentarValidationResult> {
  const fd = new FormData();
  fd.append('package', file);
  const res = await api.upload<{ data: AgentarValidationResult }>('/agentar/validate', fd);
  return res.data;
}

/** Re-upload the same file and commit the install. */
export async function installAgentarPackage(file: File): Promise<AgentarInstallResult> {
  const fd = new FormData();
  fd.append('package', file);
  const res = await api.upload<{ data: AgentarInstallResult }>('/agentar/install', fd);
  return res.data;
}
