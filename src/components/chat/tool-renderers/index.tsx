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

import type { ToolCallRecord } from '@/types/chat';
import { ProgressiveToolBlock } from './ProgressiveToolBlock';
import { SpawnToolBlock } from './SpawnToolBlock';
import { classify } from '@/config/tool-rendering';
export { ToolActivityGroup } from './ToolActivityGroup';

interface Props { tool: ToolCallRecord; onOpenTechnicalCanvas?: (value: { title: string; content: string }) => void }

/** Entity references are rendered by ChatMessage, outside the tool bubble, so
 * they remain visible independently of Settings → Tool display. */
export function ToolRenderer({ tool, onOpenTechnicalCanvas }: Props) {
  // La delegación tiene contexto propio (agente destino, encargo y acceso al
  // mirror de la sesión hija). No puede degradarse al renderer genérico.
  if (classify(tool.tool).renderer === 'spawn' && (!tool.presentation?.origin || tool.presentation.origin === 'openclaw_native')) return <SpawnToolBlock tool={tool} />;
  return <ProgressiveToolBlock tool={tool} onOpenTechnicalCanvas={onOpenTechnicalCanvas} />;
}
