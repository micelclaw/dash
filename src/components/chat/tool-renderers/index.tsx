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

import type { ComponentType } from 'react';
import type { ToolCallRecord } from '@/types/chat';
import { classify } from '@/config/tool-rendering';
import type { RendererKind } from '@/config/tool-rendering';
import { SpawnToolBlock } from './SpawnToolBlock';
import { BashToolBlock } from './BashToolBlock';
import { ReadToolBlock } from './ReadToolBlock';
import { EditToolBlock } from './EditToolBlock';
import { BrowseToolBlock } from './BrowseToolBlock';
import { SearchToolBlock } from './SearchToolBlock';
import { MemoryToolBlock } from './MemoryToolBlock';
import { PluginStatusToolBlock } from './PluginStatusToolBlock';
import { GenericToolBlock } from './GenericToolBlock';
import { EntityRefChips } from './EntityRefChips';

interface Props { tool: ToolCallRecord }

/**
 * Registry renderer-kind → component. Adding a new renderer only needs the
 * component plus its entry here (and the `RendererKind` member in
 * `config/tool-rendering.ts`) — no dispatcher edits.
 */
const RENDERERS: Record<RendererKind, ComponentType<Props>> = {
  spawn:   SpawnToolBlock,
  bash:    BashToolBlock,
  read:    ReadToolBlock,
  edit:    EditToolBlock,
  browse:  BrowseToolBlock,
  search:  SearchToolBlock,
  memory:  MemoryToolBlock,
  generic: GenericToolBlock,
};

/**
 * Pick a renderer by classifying the tool name. Falls back to
 * `GenericToolBlock` for unknown tools.
 *
 * Tools whose name starts with `plugin:` (emitted by chat-bridge from
 * `session.pluginDebugEntries`) are short-circuited to `PluginStatusToolBlock`
 * BEFORE classify so future plugins work without any TOOL_DEFS entry — the
 * featured ones (active-memory, memory-core) just get nicer icon/label.
 */
function renderToolBlock(tool: ToolCallRecord) {
  if (typeof tool.tool === 'string' && tool.tool.toLowerCase().startsWith('plugin:')) {
    return <PluginStatusToolBlock tool={tool} />;
  }
  const def = classify(tool.tool);
  const Renderer = RENDERERS[def.renderer] ?? GenericToolBlock;
  return <Renderer tool={tool} />;
}

/**
 * Renders the tool block and, ADDITIVELY, any entity-reference chips the
 * backend attached (`entity_refs`, pilot: notes). The chips appear just below
 * the normal block — the block is never replaced. No `entity_refs` → only the
 * block (zero regression).
 */
export function ToolRenderer({ tool }: Props) {
  const block = renderToolBlock(tool);
  if (tool.entity_refs && tool.entity_refs.length > 0) {
    return (
      <>
        {block}
        <EntityRefChips refs={tool.entity_refs} />
      </>
    );
  }
  return block;
}
