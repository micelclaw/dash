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

// ─── InstantPreview — template starter × design-system tokens ───────
//
// The zero-LLM "see something now" preview: the chosen Layout's curated
// starter.html themed by the chosen Style's tokens.css, in a sandboxed
// iframe. With only a style picked it falls back to the style's own
// sample (DesignPreview). Self-contained (fetches on prop change) so the
// merged create screen and any other surface can drop it in.

import { useEffect, useState } from 'react';
import { useStudioStore } from '@/stores/studio.store';
import { fetchDesignTemplate } from './design.service';
import { DesignPreview } from '../components/DesignPreview';

interface Props {
  templateSlug: string | null;
  designSystemSlug: string | null;
  /** Preview height (px number or any CSS length, default 340). */
  height?: number | string;
}

export function InstantPreview({ templateSlug, designSystemSlug, height = 340 }: Props) {
  const fetchDesignSystemTokens = useStudioStore((s) => s.fetchDesignSystemTokens);
  const [starterHtml, setStarterHtml] = useState<string | null>(null);
  const [tokens, setTokens] = useState<string | null>(null);

  useEffect(() => {
    if (!templateSlug) { setStarterHtml(null); return; }
    let cancelled = false;
    fetchDesignTemplate(templateSlug)
      .then((t) => { if (!cancelled) setStarterHtml(t.starter_html); })
      .catch(() => { if (!cancelled) setStarterHtml(null); });
    return () => { cancelled = true; };
  }, [templateSlug]);

  useEffect(() => {
    if (!designSystemSlug) { setTokens(null); return; }
    let cancelled = false;
    fetchDesignSystemTokens(designSystemSlug)
      .then((css) => { if (!cancelled) setTokens(css); })
      .catch(() => { if (!cancelled) setTokens(null); });
    return () => { cancelled = true; };
  }, [designSystemSlug, fetchDesignSystemTokens]);

  const themed = starterHtml
    ? (tokens
      ? (/<head[^>]*>/i.test(starterHtml)
        ? starterHtml.replace(/<head([^>]*)>/i, `<head$1><style>${tokens}</style>`)
        : `<style>${tokens}</style>${starterHtml}`)
      : starterHtml)
    : null;

  if (!themed && !designSystemSlug) return null;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#fff' }}>
      {themed ? (
        <iframe title="Template preview" sandbox="" srcDoc={themed} style={{ width: '100%', height, border: 'none', display: 'block' }} />
      ) : (
        <DesignPreview slug={designSystemSlug!} />
      )}
    </div>
  );
}
