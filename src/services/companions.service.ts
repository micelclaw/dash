/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// Apps acompañantes (CrawlMicel / MiniMicel / móvil) — emparejamiento por device
// token contra Core (`/api/v1/devices/*`, ADR-14). DISTINTO de gateway.service
// (`/gateway/devices/*`), que gestiona los NODOS del Gateway de OpenClaw.
import { api } from './api';

export type CompanionPlatform = 'extension' | 'desktop' | 'android' | 'ios';

export interface CompanionDevice {
  id: string;
  device_name: string;
  platform: CompanionPlatform | string;
  app_version?: string | null;
  os_version?: string | null;
  last_seen_at?: string | null;
  created_at: string;
}

/** Destino de conexión que el SERVIDOR sabe que le alcanza (ordenados por preferencia). */
export interface PairTarget {
  url: string;
  /** lan_ip = https://<ip> (fiable en la WiFi) · host_mdns = <host>.local · secure_domain = .claw */
  kind: 'lan_ip' | 'host_mdns' | 'secure_domain';
}

export interface PairCodeResult {
  code: string;
  expires_in: number; // segundos
  /** Los dicta el box, NO el origen del navegador (que suele ser un .claw irresoluble en el móvil). */
  targets?: PairTarget[];
  /** Huella sha256 del cert de la CA (hex) → la app verifica la CA que descarga. */
  ca_sha256?: string | null;
}

/** El usuario (dash) genera un código de 6 dígitos que la app reclama. */
export async function generatePairingCode(platform?: CompanionPlatform): Promise<PairCodeResult> {
  const res = await api.post<{ data: PairCodeResult }>('/devices/pair/code', platform ? { platform } : {});
  return res.data;
}

/** Lista los dispositivos acompañantes emparejados del usuario. */
export async function listCompanionDevices(): Promise<CompanionDevice[]> {
  const res = await api.get<{ data: CompanionDevice[] }>('/devices');
  return res.data;
}

/** Desempareja un dispositivo (revoca su device token + soft-delete). */
export async function revokeCompanionDevice(id: string): Promise<void> {
  await api.delete(`/devices/${id}`);
}
