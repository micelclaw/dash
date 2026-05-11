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
  'Tech decisions or constraints already made: database, auth approach, integrations, hosting…';

export function FoundationPhase({ project, viewMode, onSelectPhase }: Props) {
  const generateFoundation = useStudioStore((s) => s.generateFoundation);
  const approvePhase = useStudioStore((s) => s.approvePhase);
  const ensureTemplatesLoaded = useStudioStore((s) => s.ensureTemplatesLoaded);
  const getTemplateBySlug = useStudioStore((s) => s.getTemplateBySlug);

  useEffect(() => {
    if (project.template_slug) ensureTemplatesLoaded().catch(() => {});
  }, [project.template_slug, ensureTemplatesLoaded]);

  const template = getTemplateBySlug(project.template_slug);
  const placeholder = template?.placeholders?.foundation ?? DEFAULT_PLACEHOLDER;

  return (
    <DocPhaseLayout
      project={project}
      phase="foundation"
      docKey="doc_foundation"
      title="Foundation document"
      emptyHint="Ready to write the implementation blueprint"
      approveLabel="Approved, start building →"
      withApprovalComment
      viewMode={viewMode}
      onSelectPhase={onSelectPhase}
      initialContextLabel="Technical constraints or decisions already made"
      initialContextPlaceholder={placeholder}
      onGenerate={async (answers) => { await generateFoundation(project.id, answers); }}
      onApprove={async (comment) => { await approvePhase(project.id, 'foundation', comment); }}
    />
  );
}
