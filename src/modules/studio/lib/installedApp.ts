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

// ─── Resolve a project's installed app / ui-module (SSOT) ───────────
// The "which installed app IS this Studio project?" logic was duplicated
// (and fragile) in LivingAppCard and TestingPhase: both kebab-cased the
// project NAME and hoped it matched the installed app_name. That breaks
// because the packager derives the app_name from the workspace manifest
// name (not the project name), and `project.slug` can be the verbose raw
// scoping text.
//
// The RELIABLE signal is `project.package_path`: the packager writes the
// `.claw` as `<manifest.name>-<version>.claw`, and manifest.name IS the
// installed app_name. We parse that first, then fall back to slug / kebab /
// label so older projects without a package still resolve.

import type { StudioProject } from '@/stores/studio.store';

/** The installed app_name encoded in the project's package filename, or null. */
export function installedAppNameFromPackage(project: Pick<StudioProject, 'package_path'>): string | null {
  const pp = project.package_path;
  if (!pp) return null;
  const base = pp.split('/').pop() ?? '';
  // `<name>-<major>.<minor>.<patch>.claw`
  const m = /^(.+)-\d+\.\d+\.\d+\.claw$/.exec(base);
  return m?.[1] ?? null;
}

function kebab(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

interface UiModuleLike { app_name: string; label?: string | null }

/** Find the installed ui-module that corresponds to a Studio project. */
export function resolveInstalledModule<M extends UiModuleLike>(
  project: Pick<StudioProject, 'name' | 'slug' | 'package_path'>,
  modules: M[],
): M | undefined {
  const fromPkg = installedAppNameFromPackage(project);
  const nameKebab = kebab(project.name || '');
  const nameLc = (project.name || '').toLowerCase();
  return modules.find((m) =>
    (fromPkg != null && m.app_name === fromPkg) ||
    (!!project.slug && m.app_name === project.slug) ||
    m.app_name === nameKebab ||
    (m.label ?? '').toLowerCase() === nameLc,
  );
}
