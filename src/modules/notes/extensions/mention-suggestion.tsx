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

// Configuración `suggestion` del nodo mention: al teclear `@texto` busca en
// GET /search (todos los dominios mencionables, modo fulltext — rápido y
// disponible en Free) y pinta MentionDropdown anclado al caret. Sin tippy:
// posicionamiento manual con el clientRect que provee el suggestion plugin.

import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { api } from '@/services/api';
import { MENTION_DOMAINS } from '@/config/entity-refs';
import { MentionDropdown, type MentionDropdownHandle, type MentionItem } from '../MentionDropdown';

interface SearchResult {
  domain: string;
  record_id: string;
  snippet: string;
  record: Record<string, unknown> | null;
}

/** Título legible por dominio (cada tabla nombra distinto su campo principal). */
function resultLabel(domain: string, record: Record<string, unknown> | null, snippet: string): string {
  const r = record ?? {};
  const pick = (...fields: string[]) => {
    for (const f of fields) {
      const v = r[f];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };
  switch (domain) {
    case 'contact': return pick('display_name', 'first_name');
    case 'email': return pick('subject', 'from_name');
    case 'inventory': return pick('name');
    case 'diary': return pick('title', 'entry_date') || snippet.slice(0, 60);
    default: return pick('title', 'name') || snippet.slice(0, 60);
  }
}

/**
 * Id que persiste la chip. Para `kanban_card` codificamos "<boardId>/<cardId>"
 * (el board lo aporta el record del search) para que ENTITY_REF_MAP pueda abrir
 * la card en su panel de detalle (BoardView vive en /projects/:boardId). El
 * resto de dominios usan el record_id a secas.
 */
function mentionId(r: SearchResult): string {
  if (r.domain === 'kanban_card') {
    const boardId = r.record?.board_id;
    if (typeof boardId === 'string' && boardId) return `${boardId}/${r.record_id}`;
  }
  return r.record_id;
}

async function searchMentions(query: string): Promise<MentionItem[]> {
  if (query.trim().length < 2) return [];
  try {
    const res = await api.get<{ data: SearchResult[] }>('/search', {
      q: query.trim(),
      limit: 8,
      mode: 'fulltext',
      domains: MENTION_DOMAINS.join(','),
    });
    const items = (res.data ?? [])
      .map((r) => ({
        domain: r.domain,
        id: mentionId(r),
        label: resultLabel(r.domain, r.record, r.snippet ?? ''),
        snippet: r.snippet,
      }))
      .filter((i) => i.label);
    // Agrupar por dominio preservando el orden de score dentro de cada grupo.
    const byDomain = new Map<string, MentionItem[]>();
    for (const it of items) {
      const list = byDomain.get(it.domain) ?? [];
      list.push(it);
      byDomain.set(it.domain, list);
    }
    return [...byDomain.values()].flat();
  } catch {
    return [];
  }
}

export function buildMentionSuggestion(): Omit<SuggestionOptions, 'editor'> {
  return {
    char: '@',
    allowSpaces: false,
    items: ({ query }) => searchMentions(query),

    render: () => {
      let component: ReactRenderer<MentionDropdownHandle> | null = null;
      let popup: HTMLDivElement | null = null;

      const position = (props: SuggestionProps) => {
        if (!popup) return;
        const rect = props.clientRect?.();
        if (!rect) return;
        const margin = 6;
        popup.style.left = `${Math.min(rect.left, window.innerWidth - 380)}px`;
        // Debajo del caret; si no cabe, encima.
        const below = rect.bottom + margin;
        const panelH = Math.min(popup.offsetHeight || 280, 280);
        popup.style.top = below + panelH > window.innerHeight
          ? `${Math.max(8, rect.top - margin - panelH)}px`
          : `${below}px`;
      };

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(MentionDropdown, { props, editor: props.editor });
          popup = document.createElement('div');
          popup.style.position = 'fixed';
          popup.style.zIndex = '90';
          popup.appendChild(component.element);
          document.body.appendChild(popup);
          position(props);
        },
        onUpdate: (props: SuggestionProps) => {
          component?.updateProps(props);
          position(props);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === 'Escape') return false; // el plugin cierra
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          popup?.remove();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },

    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: 'mention', attrs: props as Record<string, unknown> },
          { type: 'text', text: ' ' },
        ])
        .run();
    },
  };
}
