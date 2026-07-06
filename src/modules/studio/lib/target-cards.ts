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

// ─── Target cards — the "what are we making?" choice (ADR-17) ───────
//
// One source of truth for the five project targets, shared by the
// Guided onboarding and the Pro create modal so both surfaces show the
// same face: icon + title + a real description + a concrete example
// (the user asked for big self-explanatory cards, not tiny chips).

import { Hammer, Palette, Globe, AppWindow, Smartphone, type LucideIcon } from 'lucide-react';
import type { StudioTarget } from '@/stores/studio.store';

export interface TargetCard {
  id: StudioTarget;
  icon: LucideIcon;
  title: string;
  desc: string;
  /** Concrete example rendered in italics — what a real user would type. */
  example: string;
}

export const TARGET_CARDS: TargetCard[] = [
  {
    id: 'micelclaw_app',
    icon: Hammer,
    title: 'App for my OS',
    desc: 'A real app inside Micelclaw — its own screens and data, installed next to your other modules.',
    example: 'My clients book their own appointments',
  },
  {
    id: 'design',
    icon: Palette,
    title: 'Just a design',
    desc: 'Explore visual directions on a canvas, no code involved. Build or export it whenever you want.',
    example: 'Three looks for my studio’s landing page',
  },
  {
    id: 'website',
    icon: Globe,
    title: 'Website',
    desc: 'A public site served from your own domain, published in one click when you like it.',
    example: 'My bakery: products, prices, where to find us',
  },
  {
    id: 'webapp',
    icon: AppWindow,
    title: 'Web app',
    desc: 'A standalone app that runs in the browser, independent from Micelclaw.',
    example: 'A workout tracker to share with friends',
  },
  {
    id: 'mobile',
    icon: Smartphone,
    title: 'Mobile app (PWA)',
    desc: 'Phone-first and installable from the browser, straight onto the home screen.',
    example: 'A shopping list always on my phone',
  },
];
