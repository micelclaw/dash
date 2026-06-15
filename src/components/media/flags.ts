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

/**
 * Feature flag for the transversal AI media phase. Fase 5 Slice A (búsqueda en
 * lenguaje natural sobre Música/Vídeo/Libros) está activa: el AiSearchToggle de
 * MediaToolbar conmuta la búsqueda a modo semántico. Los demás affordances
 * (AiItemMenuSection, ForYouRail, AiSettingsCard) siguen siendo stubs reservados
 * para slices posteriores (devuelven null aunque el flag esté on).
 */
export const AI_MEDIA_ENABLED = true;
