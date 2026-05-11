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
  'Add any context about your project: target users, scale, key constraints, decisions already made…';

export function ConceptPhase({ project, viewMode, onSelectPhase }: Props) {
  const generateConcept = useStudioStore((s) => s.generateConcept);
  const approvePhase = useStudioStore((s) => s.approvePhase);
  const ensureTemplatesLoaded = useStudioStore((s) => s.ensureTemplatesLoaded);
  const getTemplateBySlug = useStudioStore((s) => s.getTemplateBySlug);

  useEffect(() => {
    if (project.template_slug) ensureTemplatesLoaded().catch(() => {});
  }, [project.template_slug, ensureTemplatesLoaded]);

  const template = getTemplateBySlug(project.template_slug);
  const placeholder = template?.placeholders?.concept ?? DEFAULT_PLACEHOLDER;

  return (
    <DocPhaseLayout
      project={project}
      phase="concept"
      docKey="doc_concept"
      title="Concept document"
      emptyHint="Ready to generate your concept document"
      approveLabel="Approve concept →"
      viewMode={viewMode}
      onSelectPhase={onSelectPhase}
      initialContextLabel="Tell me about your project"
      initialContextPlaceholder={placeholder}
      onGenerate={async (answers) => { await generateConcept(project.id, answers); }}
      onApprove={async (comment) => { await approvePhase(project.id, 'concept', comment); }}
    />
  );
}
