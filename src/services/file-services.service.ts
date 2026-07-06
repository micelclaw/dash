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

import { api } from './api';

export interface FileServicesShare {
  name: string; slug: string; hidden: boolean; network_path: string;
  smb_served: boolean;
  not_served_reason: string | null;
}

export type ProtocolKey = 'smb' | 'webdav' | 'sftp' | 'rsync' | 'nfs';
export interface NetworkProtocolInfo {
  key: ProtocolKey;
  label: string;
  available: boolean;
  running: boolean;
  scope: 'global' | 'per_folder';
  enabled: boolean;
  windows_native: boolean;
  respects_acl: boolean;
  detail: string;
  connect_hint: string;
  can_start: boolean;
}

export interface FileServicesStatus {
  enabled: boolean;
  ready: boolean;
  prereqs: { samba_installed: boolean; helper_installed: boolean; nsswitch_ok: boolean; smbd_running: boolean };
  host: string;
  smb_port: number;
  setup_command: string;
  shares: FileServicesShare[];
  last_reconcile: { ok: boolean; at: string; detail: string } | null;
  protocols: NetworkProtocolInfo[];
  webdav_url: string;
  can_start_smbd: boolean;
}

export async function getFileServices(): Promise<FileServicesStatus> {
  const res = await api.get<{ data: FileServicesStatus }>('/network/file-services');
  return res.data;
}

export async function setFileServices(enabled: boolean): Promise<FileServicesStatus> {
  const res = await api.patch<{ data: FileServicesStatus }>('/network/file-services', { enabled });
  return res.data;
}

/** Arranca el daemon smbd (botón "Iniciar smbd" cuando quedó parado pese a SMB activo). */
export async function startSmbd(): Promise<FileServicesStatus> {
  const res = await api.post<{ data: FileServicesStatus }>('/network/file-services/start', {});
  return res.data;
}
