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

// ─── NewProjectModal — Phase 1 minimal create dialog ────────────────
// Just collects name + description. Phase 2 replaces this with the
// scoping wizard so the user lands directly at Battery 1 of Fase 0.

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '@/stores/studio.store';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

export function NewProjectModal({ open, onClose, onCreated }: NewProjectModalProps) {
  const createProject = useStudioStore((s) => s.createProject);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setSubmitting(false);
      // Defer focus to next frame so the modal is fully painted
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success(`Project "${created.name}" created`);
      onCreated(created.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      toast.error(message);
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          padding: 24, width: '90vw', maxWidth: 480,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <h3 style={{
            margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)',
          }}>
            New Studio project
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-muted)', padding: 2,
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <label style={{
          display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)',
          marginBottom: 6, fontWeight: 500,
        }}>
          Project name
        </label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="My CRM"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 12px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontSize: '0.875rem', fontFamily: 'var(--font-sans)', outline: 'none',
            marginBottom: 12,
          }}
        />

        <label style={{
          display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)',
          marginBottom: 6, fontWeight: 500,
        }}>
          Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What is this project about?"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 12px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontSize: '0.875rem', fontFamily: 'var(--font-sans)', outline: 'none',
            resize: 'vertical', marginBottom: 16,
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              cursor: 'pointer', border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-dim)',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              border: 'none', background: 'var(--amber)', color: '#000',
              fontWeight: 600, opacity: canSubmit ? 1 : 0.5,
            }}
          >
            {submitting ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  );
}
