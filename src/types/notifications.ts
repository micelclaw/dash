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

export interface Notification {
  id: string;
  type: 'sync' | 'agent_action' | 'system' | 'security' | 'email' | 'digest' | 'approval' | 'change' | 'calendar' | 'contacts' | 'messages';
  title: string;
  body?: string;
  read: boolean;
  timestamp: string;
  action?: {
    label: string;
    route?: string;
    callback?: string;
  };
  /**
   * A qué registro se refiere (lo pone el SERVIDOR). Permite que la notificación
   * desaparezca cuando el hecho deja de ser cierto (`notification.dismiss`) y que se
   * pueda actuar sobre ella. `actionable` lo decide el servidor, que es el dueño de la
   * política (una aprobación L3 pide PIN → no se resuelve de un clic): aquí NO se deduce.
   */
  ref?: {
    kind: string;
    id: string;
    actionable?: boolean;
  };
  icon?: string;
  color?: string;
}
