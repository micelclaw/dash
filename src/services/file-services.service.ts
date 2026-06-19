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

export interface FileServicesShare { name: string; slug: string; hidden: boolean; network_path: string; }
export interface FileServicesStatus {
  enabled: boolean;
  ready: boolean;
  prereqs: { samba_installed: boolean; helper_installed: boolean; nsswitch_ok: boolean; smbd_running: boolean };
  host: string;
  smb_port: number;
  setup_command: string;
  shares: FileServicesShare[];
}

export async function getFileServices(): Promise<FileServicesStatus> {
  const res = await api.get<{ data: FileServicesStatus }>('/network/file-services');
  return res.data;
}

export async function setFileServices(enabled: boolean): Promise<FileServicesStatus> {
  const res = await api.patch<{ data: FileServicesStatus }>('/network/file-services', { enabled });
  return res.data;
}
