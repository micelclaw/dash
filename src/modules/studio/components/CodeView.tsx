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

// ─── Shared CodeMirror viewer (read-only) ───────────────────────────
//
// Used by both Studio v1 ImplementationPhase and Studio v2 BuildPhase.
// Lighter-than-Monaco syntax highlighting for the languages Studio
// generates — js/ts/jsx/tsx/mjs/cjs, json, yaml, sql, markdown. Everything
// else falls back to a plain monospace block.

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json as cmJson } from '@codemirror/lang-json';
import { markdown as cmMarkdown } from '@codemirror/lang-markdown';
import { sql as cmSql } from '@codemirror/lang-sql';
import { yaml as cmYaml } from '@codemirror/lang-yaml';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

interface Selected {
  path: string;
  content: string | null | undefined;
}

interface Props {
  selected: Selected | null | undefined;
  /** Override empty-state text for callers that want a custom hint. */
  emptyHint?: string;
}

export function getLangExtension(filename: string): Extension[] {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'md': return [cmMarkdown()];
    case 'json': return [cmJson()];
    case 'yaml':
    case 'yml': return [cmYaml()];
    case 'ts':
    case 'tsx': return [javascript({ typescript: true, jsx: ext === 'tsx' })];
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs': return [javascript({ jsx: ext === 'jsx' })];
    case 'sql': return [cmSql()];
    default: return [];
  }
}

export function CodeView({ selected, emptyHint }: Props) {
  const extensions = useMemo(
    () => selected ? [...getLangExtension(selected.path), EditorView.lineWrapping] : [EditorView.lineWrapping],
    [selected?.path],
  );
  if (!selected) {
    return (
      <div style={{ padding: 32, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
        {emptyHint ?? 'Pick a file from the tree to view it.'}
      </div>
    );
  }
  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--surface)' }}>
      <CodeMirror
        value={selected.content ?? ''}
        extensions={extensions}
        theme={oneDark}
        editable={false}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: false,
          foldGutter: true,
          dropCursor: false,
          allowMultipleSelections: false,
          highlightSelectionMatches: false,
        }}
        style={{ fontSize: '0.75rem' }}
      />
    </div>
  );
}
