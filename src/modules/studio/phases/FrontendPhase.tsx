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

import { useStudioStore, type StudioProject } from '@/stores/studio.store';
import { DocPhaseLayout } from './DocPhaseLayout';

interface Props {
  project: StudioProject;
  viewMode?: 'edit' | 'past';
}

export function FrontendPhase({ project, viewMode }: Props) {
  const generateFrontend = useStudioStore((s) => s.generateFrontend);
  const approvePhase = useStudioStore((s) => s.approvePhase);

  return (
    <DocPhaseLayout
      project={project}
      phase="frontend"
      docKey="doc_frontend"
      title="Exploración de frontend"
      emptyHint="Listo para explorar la UI de tu app"
      approveLabel="Aprobar frontend →"
      viewMode={viewMode}
      initialContextLabel="¿Cómo te imaginas la UI?"
      initialContextPlaceholder="Por ejemplo: estilo Notion minimalista, sidebar a la izquierda, vista diaria por defecto, calendario semanal para los horarios, tabla de pacientes con columnas personalizables, colores suaves verdes y azules sanitarios…"
      onGenerate={async (answers) => { await generateFrontend(project.id, answers); }}
      onApprove={async (comment) => { await approvePhase(project.id, 'frontend', comment); }}
    />
  );
}
