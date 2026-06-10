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

// Wrapper sortable de SidebarItem: hace el item entero arrastrable para
// reordenarlo DENTRO de su sección (drag cross-section bloqueado por la
// collision detection + guard de onDragEnd en Sidebar.tsx). El
// PointerSensor del DndContext usa activationConstraint distance:5, así
// que el click de navegación sigue funcionando sin drag accidental.

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ModuleConfig } from '@/types/modules';
import { SidebarItem } from './SidebarItem';

interface SortableSidebarItemProps {
  module: ModuleConfig;
  /** '__top' para los items sin grupo; el nombre del grupo para el resto. */
  section: string;
  collapsed: boolean;
  /** Drag deshabilitado en modo rail (collapsed). */
  disabled: boolean;
  onNavigate?: () => void;
}

export function SortableSidebarItem({ module, section, collapsed, disabled, onNavigate }: SortableSidebarItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
    data: { section },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <SidebarItem module={module} collapsed={collapsed} onNavigate={onNavigate} />
    </div>
  );
}
