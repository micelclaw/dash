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

export function ConceptPhase({ project, viewMode }: Props) {
  const generateConcept = useStudioStore((s) => s.generateConcept);
  const approvePhase = useStudioStore((s) => s.approvePhase);

  return (
    <DocPhaseLayout
      project={project}
      phase="concept"
      docKey="doc_concept"
      title="Documento de concepto"
      emptyHint="Listo para generar tu documento de concepto"
      approveLabel="Aprobar concepto →"
      viewMode={viewMode}
      initialContextLabel="Cuéntame de qué va tu proyecto"
      initialContextPlaceholder="Por ejemplo: clínica con 3 fisioterapeutas, ~200 pacientes/mes, facturación a Salud Madrid y particulares, queremos que el agente IA pueda decirnos cuántas sesiones se cierran esta semana…"
      onGenerate={async (answers) => { await generateConcept(project.id, answers); }}
      onApprove={async (comment) => { await approvePhase(project.id, 'concept', comment); }}
    />
  );
}
