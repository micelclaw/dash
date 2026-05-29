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
import { classify } from '@/config/tool-rendering';
import { SpawnToolBlock } from './SpawnToolBlock';
import { BashToolBlock } from './BashToolBlock';
import { ReadToolBlock } from './ReadToolBlock';
import { EditToolBlock } from './EditToolBlock';
import { BrowseToolBlock } from './BrowseToolBlock';
import { SearchToolBlock } from './SearchToolBlock';
import { MemoryToolBlock } from './MemoryToolBlock';
import { PluginStatusToolBlock } from './PluginStatusToolBlock';
import { GenericToolBlock } from './GenericToolBlock';

interface Props { tool: ToolCallRecord }

/**
 * Pick a renderer by classifying the tool name. Falls back to
 * `GenericToolBlock` for unknown tools.
 *
 * Tools whose name starts with `plugin:` (emitted by chat-bridge from
 * `session.pluginDebugEntries`) are short-circuited to `PluginStatusToolBlock`
 * BEFORE classify so future plugins work without any TOOL_DEFS entry — the
 * featured ones (active-memory, memory-core) just get nicer icon/label.
 */
export function ToolRenderer({ tool }: Props) {
  if (typeof tool.tool === 'string' && tool.tool.toLowerCase().startsWith('plugin:')) {
    return <PluginStatusToolBlock tool={tool} />;
  }
  const def = classify(tool.tool);
  switch (def.renderer) {
    case 'spawn':   return <SpawnToolBlock tool={tool} />;
    case 'bash':    return <BashToolBlock tool={tool} />;
    case 'read':    return <ReadToolBlock tool={tool} />;
    case 'edit':    return <EditToolBlock tool={tool} />;
    case 'browse':  return <BrowseToolBlock tool={tool} />;
    case 'search':  return <SearchToolBlock tool={tool} />;
    case 'memory':  return <MemoryToolBlock tool={tool} />;
    case 'generic':
    default:        return <GenericToolBlock tool={tool} />;
  }
}
