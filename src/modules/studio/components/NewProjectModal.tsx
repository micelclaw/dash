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

// ─── NewProjectModal — Studio v2 create dialog ──────────────────────
// Collects name + description + the LLM model the project will use
// across every phase. Model is required (no fallback, no auto-pick)
// because every doc-phase call (Concept / Frontend / Foundation) and
// the Build phase route through the same OpenCode session keyed off
// this choice.

import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '@/stores/studio.store';
import { api } from '@/services/api';

interface ModelEntry {
  id: string;
  provider: string;
  model: string;
  is_default: boolean;
  is_fallback: boolean;
  status: 'available' | 'no_auth' | string;
}
interface ApiEnvelope<T> { data: T }
interface ModelsResponse { models: ModelEntry[]; default_model?: string }

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

export function NewProjectModal({ open, onClose, onCreated }: NewProjectModalProps) {
  const createProject = useStudioStore((s) => s.createProject);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState<string>('');
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setModel('');
      setModels([]);
      setModelsError(null);
      setSubmitting(false);
      // Defer focus to next frame so the modal is fully painted
      setTimeout(() => inputRef.current?.focus(), 50);
      // Pull authed models so we can populate the picker.
      void (async () => {
        try {
          const res = await api.get<ApiEnvelope<ModelsResponse>>('/gateway/models');
          const all = res.data.models ?? [];
          const available = all.filter((m) => m.status === 'available');
          setModels(available);
          // Pre-select the system default if it's available, else the
          // first authed model. The user can change before submitting.
          const def = res.data.default_model && available.find((m) => m.id === res.data.default_model)
            ? res.data.default_model
            : available[0]?.id ?? '';
          setModel(def);
        } catch (err) {
          setModelsError(err instanceof Error ? err.message : 'Failed to load models');
        }
      })();
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

  const canSubmit = name.trim().length > 0 && model.length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        model,
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
            resize: 'vertical', marginBottom: 12,
          }}
        />

        <label style={{
          display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)',
          marginBottom: 6, fontWeight: 500,
        }}>
          LLM model <span style={{ color: 'var(--danger)' }}>*</span>
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 12px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            fontSize: '0.875rem', fontFamily: 'var(--font-mono)', outline: 'none',
            marginBottom: 4,
          }}
        >
          {models.length === 0 && (
            <option value="" disabled>{modelsError ? 'failed to load' : 'loading…'}</option>
          )}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}{m.is_default ? '  (system default)' : ''}
            </option>
          ))}
        </select>
        <p style={{
          margin: '0 0 16px', fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.4,
        }}>
          Se aplica a TODAS las fases (Concept, Frontend, Foundation, Build). Sin fallback automático — si el provider falla, el proyecto falla y tendrás que cambiar el modelo desde la edición del proyecto.
        </p>

        {modelsError && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 6,
            padding: '8px 10px', marginBottom: 12,
            background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
            border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)',
            fontSize: '0.7rem', color: 'var(--danger)',
          }}>
            <AlertCircle size={12} style={{ marginTop: 2 }} />
            <span>{modelsError}</span>
          </div>
        )}

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
