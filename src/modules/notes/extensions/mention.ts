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

// Mención universal: nodo atómico inline { domain, id, label } que referencia
// un registro de cualquier dominio (nota, evento, contacto, email, diario,
// inventario, tablero/tarjeta kanban). Se inserta desde el dropdown `@` y se
// renderiza como chip coloreada por dominio (CSS sobre a[data-mention]),
// clicable (NoteEditor intercepta el click y navega vía ENTITY_REF_MAP).
//
// Persistencia — la mención es SIEMPRE un link con esquema interno claw://:
//   - HTML:     <a data-mention data-domain="contact" href="claw://contact/<id>">@Label</a>
//   - Markdown: [@Label](claw://contact/<id>)  ← legible también por agentes
// El parseMarkdown se registra sobre el token `link` con prioridad sobre la
// extensión Link y DECLINA (return null) si el href no es claw:// — el handler
// de Link sigue funcionando para enlaces normales (la cadena de handlers del
// MarkdownManager prueba hasta que uno responde).

import { Mention, type MentionNodeAttrs } from '@tiptap/extension-mention';
import { mergeAttributes, type MarkdownToken, type MarkdownParseHelpers, type MarkdownTokenizer } from '@tiptap/core';

export const CLAW_SCHEME = 'claw://';

export interface UniversalMentionAttrs extends MentionNodeAttrs {
  domain: string;
}

export function parseClawHref(href: string | null | undefined): { domain: string; id: string } | null {
  if (!href || !href.startsWith(CLAW_SCHEME)) return null;
  const [domain, ...rest] = href.slice(CLAW_SCHEME.length).split('/');
  const id = rest.join('/');
  if (!domain || !id) return null;
  return { domain, id };
}

export const UniversalMention = Mention.extend({
  name: 'mention',
  // Por encima de Link (100) para ganar tanto en parseHTML como en el token
  // markdown `link` cuando el href es claw://.
  priority: 1100,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => parseClawHref(el.getAttribute('href'))?.id ?? el.getAttribute('data-id'),
      },
      label: {
        default: null,
        parseHTML: (el: HTMLElement) => (el.textContent || '').replace(/^@/, '') || el.getAttribute('data-label'),
      },
      domain: {
        default: null,
        parseHTML: (el: HTMLElement) => parseClawHref(el.getAttribute('href'))?.domain ?? el.getAttribute('data-domain'),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[href]',
        priority: 60, // > regla del mark Link (51) para capturar los claw://
        getAttrs: (el) => (parseClawHref((el as HTMLElement).getAttribute('href')) ? {} : false),
      },
    ];
  },

  renderHTML({ node }) {
    const attrs = node.attrs as UniversalMentionAttrs;
    return [
      'a',
      mergeAttributes({
        'data-mention': '',
        'data-domain': attrs.domain ?? '',
        href: `${CLAW_SCHEME}${attrs.domain}/${attrs.id}`,
      }),
      `@${attrs.label ?? attrs.id}`,
    ];
  },

  renderText({ node }) {
    return `@${(node.attrs as UniversalMentionAttrs).label ?? node.attrs.id}`;
  },

  // ─── Markdown (@tiptap/markdown lee estos campos del config) ───────
  // OJO: el camino INLINE del MarkdownManager usa getHandlerForToken (SINGULAR)
  // — coge solo el handler de mayor prioridad SIN fallthrough. Devolver null
  // aquí se TRAGA el token (los links https desaparecerían). Por eso este
  // handler cubre AMBOS casos: claw:// → nodo mention; resto → replica el
  // applyMark del handler de Link (mismo comportamiento que Link.parseMarkdown).
  markdownTokenName: 'link',
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    const href = token.href as string | undefined;
    const ref = parseClawHref(href);
    if (!ref) {
      return helpers.applyMark('link', helpers.parseInline(token.tokens ?? []), {
        href: href ?? '',
        title: (token.title as string | undefined) || null,
      });
    }
    const label = (token.text ?? '').replace(/^@/, '') || ref.id;
    return helpers.createNode('mention', { id: ref.id, label, domain: ref.domain });
  },
  // El label se serializa SIN '@' — el Mention base registra un tokenizer de
  // marked para `@texto` que partiría `[@Label](...)` antes de tokenizar el
  // link. El '@' visual lo añade renderHTML/renderText; parseMarkdown tolera
  // labels antiguos con '@' (strip).
  renderMarkdown: (node: { attrs?: { id?: string; label?: string; domain?: string } }) => {
    const { id = '', label = '', domain = '' } = node.attrs ?? {};
    return `[${label || id}](${CLAW_SCHEME}${domain}/${id})`;
  },
  // Anular el tokenizer @texto que aportaba la cadena del Mention base: en
  // notas, un @ suelto en el markdown NO debe convertirse en mención (solo los
  // links claw://). Tiene que ser null EXPLÍCITO en runtime — undefined haría
  // que getExtensionField cayera al padre y el tokenizer volviera (verificado:
  // con él activo, `[@Label](claw://…)` se parte antes de tokenizar el link).
  markdownTokenizer: null as unknown as MarkdownTokenizer,
});
