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

// Helpers compartidos por la lista de resultados (SearchResultsList) y el
// empty-state (SearchDiscover): resolver el título legible de un SearchResult
// con los casos especiales por dominio (fotos con descripción IA, mensajes
// "Plataforma #canal: …", ficheros VFS con la ruta de la carpeta padre).

import type { SearchResult } from '@/types/search';

export function getTitle(r: SearchResult): string {
  const rec = r.record as Record<string, unknown> | null;
  if (!rec) return r.snippet.slice(0, 60);

  // Photo results: prefer AI description over filename
  if (r.domain === 'photo') {
    const meta = rec.metadata as Record<string, unknown> | undefined;
    const desc = meta?.ai_description as string;
    return desc ? desc.slice(0, 80) : (rec.filename as string) || r.snippet.slice(0, 60);
  }

  // Message results: "Platform #channel: content_preview"
  if (r.domain === 'message') {
    const platform = (rec.platform as string) ?? '';
    const channel = (rec.channel_name as string) ?? '';
    const content = (rec.content as string) ?? r.snippet;
    const prefix = [platform, channel ? `#${channel}` : ''].filter(Boolean).join(' ');
    const preview = content.slice(0, 60);
    return prefix ? `${prefix}: ${preview}` : preview;
  }

  const title = (
    (rec.title as string) ||
    (rec.subject as string) ||
    (rec.display_name as string) ||
    (rec.filename as string) ||
    r.snippet.slice(0, 60)
  );

  // For VFS files, show parent folder path for context
  if (rec.source === 'vfs' && rec.parent_folder) {
    const folder = (rec.parent_folder as string).replace(/^\/vfs/, '');
    return `${title}  ·  ${folder}`;
  }

  return title;
}
