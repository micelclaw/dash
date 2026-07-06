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

import { SharedFolderEditDialog } from './SharedFolderEditDialog';
import type { SharedFolder } from '@/services/shared-folders.service';

/**
 * Crear carpeta compartida = el MISMO diálogo rico (`SharedFolderEditDialog`) en
 * modo crear (`folder={null}`). Este wrapper existe solo por compatibilidad con los
 * llamadores (Settings + "+" del File Explorer): no hay dos modales distintos, hay uno.
 */
export function SharedFolderCreateDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: (folder: SharedFolder) => void;
}) {
  return (
    <SharedFolderEditDialog
      folder={null}
      open={open}
      onOpenChange={onOpenChange}
      onCreated={onCreated}
      onSaved={() => {}}
    />
  );
}
