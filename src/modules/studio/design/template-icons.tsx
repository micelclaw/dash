/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see repo LICENSE.
 */

// Minimalist Lucide icons for the "Start with a template…" row (replaces
// the emoji in template.json — the dash owns the visual). Unknown slugs
// fall back to a generic template glyph.
import {
  Blocks, Smartphone, Newspaper, LayoutDashboard, ShoppingBag, Rocket,
  GalleryVerticalEnd, LayoutTemplate, type LucideIcon,
} from 'lucide-react';

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  'micelclaw-module': Blocks,
  'app-ui': Smartphone,
  blog: Newspaper,
  dashboard: LayoutDashboard,
  ecommerce: ShoppingBag,
  landing: Rocket,
  portfolio: GalleryVerticalEnd,
};

export function templateIcon(slug: string): LucideIcon {
  return TEMPLATE_ICONS[slug] ?? LayoutTemplate;
}
