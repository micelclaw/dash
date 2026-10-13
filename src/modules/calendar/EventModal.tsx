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

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RelateModal } from '@/components/shared/RelateModal';
import { useCoNavigation } from '@/hooks/use-co-navigation';
import { EventViewDetails } from './components/EventViewDetails';
import { EventFormFields } from './components/EventFormFields';
import {
  createFormState,
  eventToFormState,
  formStateToInput,
  type EventFormState,
} from './components/event-form';
import type { CalendarEvent, EventCreateInput, EventUpdateInput } from './types';
import type { LinkedRecord } from '@/types/links';

interface EventModalProps {
  calendarNames?: string[];
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onCreate?: (input: EventCreateInput) => Promise<CalendarEvent>;
  onUpdate: (id: string, input: EventUpdateInput) => Promise<CalendarEvent>;
  onDelete: (id: string) => Promise<void>;
  linkedRecords: LinkedRecord[];
  linkedRecordsLoading: boolean;
  /** Pre-fill start time when creating from a slot click */
  defaultDate?: Date | null;
}

type Mode = 'view' | 'edit' | 'create';

export function EventModal({
  event,
  open,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  linkedRecords,
  linkedRecordsLoading,
  defaultDate,
  calendarNames,
}: EventModalProps) {
  useCoNavigation('event', event?.id ?? '');
  const [mode, setMode] = useState<Mode>('view');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [relateOpen, setRelateOpen] = useState(false);
  const [form, setForm] = useState<EventFormState>(() => createFormState());

  const patchForm = useCallback((patch: Partial<EventFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  // Sync form from event (or reset for create mode)
  useEffect(() => {
    if (event) {
      setForm(eventToFormState(event));
      setMode('view');
      setConfirmingDelete(false);
    } else if (open) {
      setForm(createFormState(defaultDate));
      setMode('create');
      setConfirmingDelete(false);
    }
  }, [event, open, defaultDate]);

  // Close on Escape (covers the case where RelateModal is on top and the
  // Radix dialog is unmounted, so its own Escape handling does not fire)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSave = useCallback(async () => {
    const input = formStateToInput(form);
    if (mode === 'create') {
      await onCreate?.(input);
      onClose();
    } else if (event) {
      await onUpdate(event.id, input);
      setMode('view');
    }
  }, [mode, event, form, onCreate, onUpdate, onClose]);

  const handleDelete = useCallback(async () => {
    if (!event) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await onDelete(event.id);
    onClose();
  }, [event, confirmingDelete, onDelete, onClose]);

  const isCreate = mode === 'create';

  return (
    <>
      {/* El Dialog canonico es modal (bloquea pointer-events del body), asi que
          se desmonta mientras RelateModal esta abierto para que este sea usable. */}
      <Dialog open={open && !relateOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent
          style={{
            maxWidth: 520,
            width: '90vw',
            maxHeight: '85vh',
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {/* Header */}
          <DialogHeader style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
            <DialogTitle
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              {isCreate ? 'New Event' : mode === 'edit' ? 'Edit Event' : 'Event Details'}
            </DialogTitle>
          </DialogHeader>

          {/* Body */}
          <div style={{ padding: 16, flex: 1, overflow: 'auto' }}>
            {mode === 'view' && event ? (
              <EventViewDetails
                event={event}
                linkedRecords={linkedRecords}
                linkedRecordsLoading={linkedRecordsLoading}
                onNavigate={onClose}
              />
            ) : (
              <EventFormFields form={form} onChange={patchForm} calendarNames={calendarNames} />
            )}
          </div>

          {/* Footer */}
          <DialogFooter
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: mode === 'view' ? 'space-between' : 'flex-end',
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              gap: 8,
            }}
          >
            {mode === 'view' ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    color: confirmingDelete ? 'var(--error)' : 'var(--text-dim)',
                    borderColor: confirmingDelete ? 'var(--error)' : undefined,
                  }}
                >
                  <Trash2 size={14} />
                  {confirmingDelete ? 'Are you sure?' : 'Delete'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRelateOpen(true)}
                  style={{ borderRadius: 'var(--radius-md)', color: 'var(--text-dim)' }}
                >
                  <Link2 size={14} />
                  Relate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMode('edit');
                    setConfirmingDelete(false);
                  }}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--amber)',
                    borderColor: 'var(--amber)',
                  }}
                >
                  <Pencil size={14} />
                  Edit
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (isCreate) onClose();
                    else setMode('view');
                  }}
                  style={{ borderRadius: 'var(--radius-md)', color: 'var(--text-dim)' }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {isCreate ? 'Create' : 'Save'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {open && relateOpen && event && (
        <RelateModal
          open={relateOpen}
          sourceType="event"
          sourceId={event.id}
          onClose={() => setRelateOpen(false)}
        />
      )}
    </>
  );
}
