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

// ─── Settings → AI & Agents → GPU & VRAM ────────────────────────────
// Sección de Settings que expone el árbitro de VRAM: barra de VRAM segmentada por
// rol + "otros", catálogo de modelos CONFIGURADOS (chat/embed/multimodal/visión) con
// pills navegables a su config + estado en VRAM/libre + pin, tareas aplazadas en
// cola, prioridad global (chat/multimodal), y los controles ⏸ Pausar / ⟲ Liberar
// VRAM. La lógica vive en `GpuVramDashboard`.

import { SectionShell } from '../shared/SectionShell';
import { GpuVramDashboard } from './GpuVramDashboard';

export function GpuVramSection() {
  return (
    <SectionShell
      title="GPU & VRAM"
      description="Memoria de la GPU en vivo: qué modelos están cargados (chat, embeddings, extracción, visión) y cuánta VRAM ocupan, con prioridad por modelo. Las tareas de fondo se aplazan mientras chateas. Pausa la GPU o libera toda la VRAM para uso externo (p. ej. jugar)."
      maxWidth={860}
    >
      <GpuVramDashboard />
    </SectionShell>
  );
}
