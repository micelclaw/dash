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

export function FoundationPhase({ project, viewMode }: Props) {
  const generateFoundation = useStudioStore((s) => s.generateFoundation);
  const approvePhase = useStudioStore((s) => s.approvePhase);

  return (
    <DocPhaseLayout
      project={project}
      phase="foundation"
      docKey="doc_foundation"
      title="Documento de foundation"
      emptyHint="Listo para escribir el blueprint de implementación"
      approveLabel="Aprobado, empezar a construir →"
      withApprovalComment
      viewMode={viewMode}
      initialContextLabel="Restricciones técnicas o decisiones ya tomadas"
      initialContextPlaceholder="Por ejemplo: queremos PostgreSQL, sesiones simples sin OAuth, granularidad de 15 minutos, single-tenant, auditoría en todas las tablas críticas, sin notificaciones automáticas por ahora…"
      onGenerate={async (answers) => { await generateFoundation(project.id, answers); }}
      onApprove={async (comment) => { await approvePhase(project.id, 'foundation', comment); }}
    />
  );
}
