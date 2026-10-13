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

// Image con auth para los ficheros internos de Drive: el contenido de la nota
// guarda la URL LIMPIA (/api/v1/files/<id>/preview) — sin token, que expira y
// no debe persistirse en la DB — y este node view añade `?token=` SOLO en el
// DOM de display (mismo mecanismo query-token que usa el módulo de fotos,
// lib/file-utils.getPreviewUrl). Las URLs externas pasan tal cual.
// renderHTML/serialización (getHTML / markdown) no se tocan → la URL limpia
// es lo que viaja a la DB y lo que ven los agentes.

import Image from '@tiptap/extension-image';
import type { Editor } from '@tiptap/react';
import { useAuthStore } from '@/stores/auth.store';

const INTERNAL_PREFIX = '/api/v1/files/';
const noteImages = new WeakMap<Editor, ReadonlyMap<string, string>>();

function withDisplayToken(src: string): string {
  if (!src.startsWith(INTERNAL_PREFIX)) return src;
  const token = useAuthStore.getState().tokens?.accessToken;
  if (!token) return src;
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}token=${encodeURIComponent(token)}`;
}

function displaySource(editor: Editor, nativeSource: string): string {
  const images = noteImages.get(editor);
  let decoded = nativeSource;
  try { decoded = decodeURIComponent(nativeSource); } catch { /* Keep the native link. */ }
  return withDisplayToken(images?.get(decoded) ?? nativeSource);
}

/** Display-only mapping: ProseMirror attributes and serialized Markdown keep provider paths. */
export function setNoteImageDisplayResources(editor: Editor, images: ReadonlyMap<string, string>): void {
  noteImages.set(editor, images);
  editor.view.dom.querySelectorAll<HTMLImageElement>('img[data-note-native-src]').forEach(img => {
    img.src = displaySource(editor, img.dataset.noteNativeSrc ?? '');
  });
}

export const AuthImage = Image.extend({
  addNodeView() {
    return ({ node, editor }) => {
      const img = document.createElement('img');
      const apply = (attrs: Record<string, unknown>) => {
        const nativeSource = String(attrs.src ?? '');
        img.dataset.noteNativeSrc = nativeSource;
        img.src = displaySource(editor, nativeSource);
        if (attrs.alt) img.alt = String(attrs.alt);
        if (attrs.title) img.title = String(attrs.title);
      };
      apply(node.attrs);
      return {
        dom: img,
        update: (updated) => {
          if (updated.type.name !== this.name) return false;
          apply(updated.attrs);
          return true;
        },
      };
    };
  },
});
