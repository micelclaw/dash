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

import { useEffect } from 'react';
import { useStudioStore, type StudioProject, type StudioProjectStatus } from '@/stores/studio.store';
import { DocPhaseLayout } from './DocPhaseLayout';

interface Props {
  project: StudioProject;
  viewMode?: 'edit' | 'past';
  onSelectPhase?: (phase: StudioProjectStatus) => void;
}

const DEFAULT_PLACEHOLDER =
  'Describe the UI you have in mind: layout, density, references to existing apps, must-have screens…';

export function FrontendPhase({ project, viewMode, onSelectPhase }: Props) {
  const generateFrontend = useStudioStore((s) => s.generateFrontend);
  const approvePhase = useStudioStore((s) => s.approvePhase);
  const ensureTemplatesLoaded = useStudioStore((s) => s.ensureTemplatesLoaded);
  const getTemplateBySlug = useStudioStore((s) => s.getTemplateBySlug);

  useEffect(() => {
    if (project.template_slug) ensureTemplatesLoaded().catch(() => {});
  }, [project.template_slug, ensureTemplatesLoaded]);

  const template = getTemplateBySlug(project.template_slug);
  const placeholder = template?.placeholders?.frontend ?? DEFAULT_PLACEHOLDER;

  return (
    <DocPhaseLayout
      project={project}
      phase="frontend"
      docKey="doc_frontend"
      title="Frontend exploration"
      emptyHint="Ready to explore your app's UI"
      approveLabel="Approve frontend →"
      viewMode={viewMode}
      onSelectPhase={onSelectPhase}
      initialContextLabel="How do you imagine the UI?"
      initialContextPlaceholder={placeholder}
      onGenerate={async (answers) => { await generateFrontend(project.id, answers); }}
      onApprove={async (comment) => { await approvePhase(project.id, 'frontend', comment); }}
    />
  );
}
