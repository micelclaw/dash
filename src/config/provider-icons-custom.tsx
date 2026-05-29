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

// ─── Custom provider icons (no lobehub coverage) ────────────────────
//
// Generic, concept-inspired glyphs for providers that `@lobehub/icons`
// doesn't ship. Each component shares the lobehub Mono signature
// (`size` + `style` + `className`, fill via `currentColor`) so they
// slot into `PROVIDER_ICONS` with no special casing.
//
// These are NOT brand logos — they are abstract symbols that hint at
// the provider's category (e.g. a flame for the crawl/index sense of
// Firecrawl, a magnifying glass for SearXNG search, a waveform for
// Deepgram's STT). When a provider eventually ships an official mark
// via lobehub or another source, swap the import in `provider-icons.tsx`.

import type { CSSProperties, FC } from 'react';

interface CustomIconProps {
  size: number;
  style?: CSSProperties;
  className?: string;
}

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  xmlns: 'http://www.w3.org/2000/svg',
}) as const;

// chute = parachute (chutes.ai → serverless compute "drops")
export const Chutes: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12h2.5L8 8l2 4h4l2-4 3.5 4H22c0-5.52-4.48-10-10-10zm0 20l-3.5-9h7L12 22z" />
  </svg>
);

// audio waveform — Deepgram is STT/TTS
export const Deepgram: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M2 11h2v2H2zM6 8h2v8H6zM10 5h2v14h-2zM14 8h2v8h-2zM18 10h2v4h-2zM22 11h-0.01v2H22z" />
  </svg>
);

// flame — Firecrawl
export const Firecrawl: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M12 2c0 4-3 5-3 9a3 3 0 0 0 6 0c0-2-1-3-1-5 3 2 4 5 4 8a6 6 0 0 1-12 0c0-6 6-7 6-12z" />
  </svg>
);

// sound wave (TTS — Gradium is voice synthesis)
export const Gradium: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0v0c-2 4-4 4-6 0s-4-4-6 0-4 4-6 0z" />
  </svg>
);

// globe with grid lines — Inworld (AI characters in worlds)
export const Inworld: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2c1.5 0 3.5 2 4.5 6h-9C8.5 6 10.5 4 12 4zM4.5 10h3a14 14 0 0 0 0 4h-3a8 8 0 0 1 0-4zm5 0h5a12 12 0 0 1 0 4h-5a12 12 0 0 1 0-4zm7 0h3a8 8 0 0 1 0 4h-3a14 14 0 0 0 0-4zM7.5 16h9c-1 4-3 6-4.5 6S8.5 20 7.5 16z" />
  </svg>
);

// Greek capital lambda Λ — LiteLLM (LLM gateway, lambda is universal LLM glyph)
export const LiteLLM: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M9 4h6l6 16h-3l-3-8-1-3h-1l-1 3-3 8H3z" />
  </svg>
);

// magnifying glass — SearXNG meta-search
export const Searxng: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm5.5 11l5 5-1.5 1.5-5-5z" />
  </svg>
);

// square brackets with dot — SGLang (structured generation, code-like)
export const Sglang: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M4 4h6v2H6v12h4v2H4zM14 4h6v16h-6v-2h4V6h-4zM11 11h2v2h-2z" />
  </svg>
);

// atom / orbital — Synthetic (synthetic.new, open-source LLMs)
export const Synthetic: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM3 12a9 4 0 0 1 18 0 9 4 0 0 1-18 0zm9-4l1.7 1L21 13.5l-1.7 1L12 16l-7.3-1.5L3 13.5l7.3-4.5z" />
  </svg>
);

// droplet — TokenJuice (token compaction, juice metaphor 🧃)
export const TokenJuice: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M12 2c-1 0-2 1-3 3-2 4-4 7-4 11a7 7 0 0 0 14 0c0-4-2-7-4-11-1-2-2-3-3-3zm-3 12a3 3 0 0 0 3 3v-2a1 1 0 0 1-1-1z" />
  </svg>
);

// stylized V with downward stroke — Vydra (image/video generation aggregator)
export const Vydra: FC<CustomIconProps> = ({ size, style, className }) => (
  <svg {...baseProps(size)} style={style} className={className}>
    <path d="M3 4h4l5 12 5-12h4l-7 16h-4z" />
  </svg>
);
