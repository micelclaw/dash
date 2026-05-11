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

// ─── useStudioStream — thin wrapper over the global streams store ───
//
// The actual reducer + WS subscription live in
// `modules/studio/streams/studio-generation-streams.ts`. The store is
// fed by a single global subscription mounted at Shell level so that
// `studio.generation.*` events keep accumulating even when the user
// navigates away from a doc-phase. This hook just re-exposes the
// existing API (`{state, reset, debug}`) so consumers don't change.

import {
  useStudioGenerationStream,
  useStudioStreamsStore,
} from '../streams/studio-generation-streams';

export type {
  StudioStreamStatus,
  StudioStreamState,
  StudioStreamDebugInfo,
} from '../streams/studio-generation-streams';

export function useStudioStream(projectId: string, phase: string) {
  const state = useStudioGenerationStream(projectId, phase);
  const resetStream = useStudioStreamsStore((s) => s.resetStream);
  const getDebug = useStudioStreamsStore((s) => s.getDebug);

  function reset() {
    resetStream(projectId, phase);
  }
  function debug() {
    return getDebug(projectId, phase);
  }

  return { state, reset, debug };
}
