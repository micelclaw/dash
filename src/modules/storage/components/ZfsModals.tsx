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

// ─── ZFS — wizards/forms de escritura (read-write UI) ──────────────
// Superficie pública de los modales ZFS. La implementación vive particionada
// en ./zfs/* (un modal por fichero; chrome compartido sobre el Dialog canónico
// en ./zfs/ZfsModal.tsx). Este barrel se mantiene para no romper los imports
// existentes desde ZfsSection/ZfsPoolCard/DataUsageChart ('./ZfsModals').
//
// En modo demo mutan estado local (UX completa visible sin bare-metal). En modo
// real llaman al backend gated (plan→token→apply). Las acciones por-ítem
// (scrub/destroy/snapshot) viven en ZfsSection; aquí los formularios de
// creación + el wizard de pool.

export { AddCacheForm } from './zfs/AddCacheForm';
export { AddSpareForm } from './zfs/AddSpareForm';
export { CreateSnapshotForm } from './zfs/CreateSnapshotForm';
export { RemoveAuxVdevConfirm } from './zfs/RemoveAuxVdevConfirm';
export { DiskMaintenanceModal } from './zfs/DiskMaintenanceModal';
export { PoolPropsModal } from './zfs/PoolPropsModal';
export { ExportPoolConfirm } from './zfs/ExportPoolConfirm';
export { ImportPoolModal } from './zfs/ImportPoolModal';
export { ZfsManageBar } from './zfs/ZfsManageBar';
