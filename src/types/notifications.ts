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
  type: 'sync' | 'agent_action' | 'system' | 'email' | 'digest' | 'approval' | 'change' | 'calendar' | 'contacts';
  title: string;
  body?: string;
  read: boolean;
  timestamp: string;
  action?: {
    label: string;
    route?: string;
    callback?: string;
  };
  icon?: string;
  color?: string;
}
