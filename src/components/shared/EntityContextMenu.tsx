import { useState, type ReactNode } from 'react';
import { Share2, Link2, Pencil, Trash2 } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { EntityShareModal } from './EntityShareModal';
import { RelateModal } from './RelateModal';

interface EntityContextMenuProps {
  entityType: 'note' | 'contact' | 'diary_entry' | 'photo' | 'event' | 'email' | 'file';
  entityId: string;
  entityTitle?: string;
  trigger: ReactNode;
  extraItems?: ContextMenuItem[];
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onRelate?: () => void;
  disableShare?: boolean;
  disableRelate?: boolean;
}

export function EntityContextMenu({
  entityType,
  entityId,
  entityTitle,
  trigger,
  extraItems = [],
  onEdit,
  onDelete,
  onShare,
  onRelate,
  disableShare,
  disableRelate,
}: EntityContextMenuProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [relateOpen, setRelateOpen] = useState(false);

  const items: ContextMenuItem[] = [];

  // Domain-specific items first
  for (const item of extraItems) {
    items.push(item);
  }

  // Separator if we had extra items
  if (extraItems.length > 0) {
    items.push({ label: '', onClick: () => {}, separator: true });
  }

  // Universal actions: Share & Relate
  if (!disableShare) {
    items.push({
      label: 'Share',
      icon: Share2,
      onClick: () => {
        if (onShare) {
          onShare();
        } else {
          setShareOpen(true);
        }
      },
    });
  }

  if (!disableRelate) {
    items.push({
      label: 'Relate',
      icon: Link2,
      onClick: () => {
        if (onRelate) {
          onRelate();
        } else {
          setRelateOpen(true);
        }
      },
    });
  }

  // Edit & Delete
  if (onEdit || onDelete) {
    items.push({ label: '', onClick: () => {}, separator: true });
  }

  if (onEdit) {
    items.push({ label: 'Edit', icon: Pencil, onClick: onEdit });
  }

  if (onDelete) {
    items.push({ label: 'Delete', icon: Trash2, onClick: onDelete, variant: 'danger' });
  }

  return (
    <>
      <ContextMenu trigger={trigger} items={items} />

      {shareOpen && (
        <EntityShareModal
          open={shareOpen}
          entityType={entityType}
          entityId={entityId}
          entityTitle={entityTitle ?? ''}
          onClose={() => setShareOpen(false)}
        />
      )}

      {relateOpen && (
        <RelateModal
          open={relateOpen}
          sourceType={entityType}
          sourceId={entityId}
          onClose={() => setRelateOpen(false)}
        />
      )}
    </>
  );
}
