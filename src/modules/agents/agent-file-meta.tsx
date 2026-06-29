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

import {
  Fingerprint, Heart, User, Wrench, Network, HeartPulse, Brain, Server, Rocket,
  type LucideIcon,
} from 'lucide-react';

export interface AgentFileMeta {
  icon: LucideIcon;
  color: string;
  /** Etiqueta legible del propósito del fichero. */
  label: string;
}

/**
 * Icono + color + etiqueta por fichero ESPECIAL del workspace de un agente
 * (los gestionados por el provisioning: SOUL/IDENTITY/USER/…). Da identidad
 * visual y los distingue de los ficheros custom (que usan el FileIcon genérico).
 * Compartido por AgentIdentity (Overview) y AgentWorkspaces (file browser).
 */
export const AGENT_FILE_META: Record<string, AgentFileMeta> = {
  'IDENTITY.md': { icon: Fingerprint, color: '#a855f7', label: 'Identidad' },
  'SOUL.md': { icon: Heart, color: '#ec4899', label: 'Personalidad' },
  'USER.md': { icon: User, color: '#3b82f6', label: 'Perfil del usuario' },
  'TOOLS.md': { icon: Wrench, color: '#14b8a6', label: 'Herramientas' },
  'AGENTS.md': { icon: Network, color: '#f97316', label: 'Jerarquía' },
  'HEARTBEAT.md': { icon: HeartPulse, color: '#22c55e', label: 'Latido' },
  'MEMORY.md': { icon: Brain, color: '#d4a017', label: 'Memoria' },
  'INFRASTRUCTURE.md': { icon: Server, color: '#64748b', label: 'Infraestructura' },
  'BOOTSTRAP.md': { icon: Rocket, color: '#8b5cf6', label: 'Bootstrap' },
};

/** Devuelve la meta del fichero especial, o null si es un fichero custom. */
export function getAgentFileMeta(filename: string): AgentFileMeta | null {
  return AGENT_FILE_META[filename] ?? null;
}
