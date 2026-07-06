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
import { useNavigate } from 'react-router';
import { X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, type StudioEngineId, type StudioTarget } from '@/stores/studio.store';
import { api } from '@/services/api';
import { EnginePicker } from './EnginePicker';
import { ConnectExternalEngineModal } from './v2/ConnectExternalEngineModal';
import { useStudioEngines } from '../hooks/useStudioEngines';
import { TARGET_CARDS } from '../lib/target-cards';

interface ModelEntry {
  id: string;
  provider: string;
  model: string;
  label?: string;
  recommended?: boolean;
  is_default?: boolean;
  is_fallback?: boolean;
  status?: 'available' | 'no_auth' | string;
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
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<StudioTarget>('micelclaw_app');
  const [model, setModel] = useState<string>('');
  const [engine, setEngine] = useState<StudioEngineId>('opencode');
  const engineTouched = useRef(false);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set right after a BYO create — opens the MCP connection modal in place.
  const [connectProjectId, setConnectProjectId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { engines, defaultEngine } = useStudioEngines();

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setKind('micelclaw_app');
      setModel('');
      setEngine(defaultEngine);
      engineTouched.current = false;
      setModels([]);
      setModelsError(null);
      setSubmitting(false);
      // Defer focus to next frame so the modal is fully painted
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaultEngine only seeds the initial state
  }, [open]);

  // OpenCode models load LAZILY — while the built-in engine is the
  // selection (filtered to OpenCode's synthesized providers, NOT the full
  // gateway catalog — V3-8 silent hangs) or when the kind is design (its
  // canvas generator runs on the same reachable list). ACP engines skip it.
  useEffect(() => {
    if (!open || (engine !== 'opencode' && kind !== 'design') || models.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<ApiEnvelope<ModelsResponse>>('/studio/models');
        if (cancelled) return;
        const available = res.data.models ?? [];
        setModels(available);
        // Pre-select the recommended default; the user can change it.
        const def = res.data.default_model && available.find((m) => m.id === res.data.default_model)
          ? res.data.default_model
          : available[0]?.id ?? '';
        setModel((prev) => prev || def);
      } catch (err) {
        if (!cancelled) setModelsError(err instanceof Error ? err.message : 'Failed to load models');
      }
    })();
    return () => { cancelled = true; };
  }, [open, engine, kind, models.length]);

  function changeEngine(next: StudioEngineId) {
    engineTouched.current = true;
    setEngine(next);
    // `model` is engine-scoped: reset when the axis changes.
    if (next === 'opencode') {
      setModel(models.find((m) => m.recommended)?.id ?? models[0]?.id ?? '');
    } else {
      setModel('');
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // OpenCode (built-in) needs a model; an ACP engine must be READY (its
  // readiness is enforced again server-side by the build pre-flight).
  // Design-only projects need neither (generation is engine-independent).
  const usesEngine = kind !== 'design';
  const selectedEngineInfo = engines.find((e) => e.id === engine);
  const engineBlocked = usesEngine && engine !== 'opencode' && selectedEngineInfo ? !selectedEngineInfo.ready : false;
  const canSubmit = name.trim().length > 0
    && (!usesEngine || engine !== 'opencode' || model.length > 0)
    && !engineBlocked
    && !submitting;

  async function doCreate(byo?: boolean) {
    if (submitting) return;
    if (byo && name.trim().length === 0) {
      // Never a silent no-op — the BYO card is clickable with an empty name.
      toast.message('Name the project first — then I create it and hand you the connection file for your editor.');
      inputRef.current?.focus();
      return;
    }
    if (byo ? false : !canSubmit) return;
    setSubmitting(true);
    try {
      if (kind === 'design') {
        // No build engine, but the canvas generator runs on an LLM —
        // honor an explicit model pick ('' = server resolves the
        // recommended one on the first generate).
        const created = await createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          target: 'design',
          model: model || null,
        });
        toast.success(`Design "${created.name}" created`);
        onCreated(created.id);
        return;
      }
      if (kind === 'website' || kind === 'webapp' || kind === 'mobile') {
        // Static targets skip scoping (they start in Concept); the
        // description is the brief the Concept phase works from.
        const effectiveEngine: StudioEngineId = byo ? 'opencode' : engine;
        const created = await createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          target: kind,
          engine: effectiveEngine,
          model: effectiveEngine === 'opencode'
            ? (engine === 'opencode' && model ? model : null)
            : (model.trim() || null),
        });
        if (byo) { setSubmitting(false); setConnectProjectId(created.id); return; }
        toast.success(`"${created.name}" created`);
        onCreated(created.id);
        return;
      }
      // BYO always creates with the built-in engine (open in your own tool).
      const effectiveEngine: StudioEngineId = byo ? 'opencode' : engine;
      const created = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        model: effectiveEngine === 'opencode'
          ? (engine === 'opencode' && model ? model : null)
          : (model.trim() || null),
        engine: effectiveEngine,
      });
      if (byo) {
        // BYO handoff happens RIGHT HERE: the connection modal (.mcp.json +
        // bearer) opens on top; navigating to the project happens on close.
        setSubmitting(false);
        setConnectProjectId(created.id);
        return;
      }
      toast.success(`Project "${created.name}" created`);
      onCreated(created.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      toast.error(message);
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doCreate(false);
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
          padding: 24, width: '90vw', maxWidth: 560,
          maxHeight: '90vh', overflowY: 'auto',
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
          What are we making?
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8, marginBottom: 12 }}>
          {TARGET_CARDS.map((k) => {
            const active = kind === k.id;
            const Icon = k.icon;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                disabled={submitting}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5,
                  textAlign: 'left', padding: '11px 12px', cursor: 'pointer', minHeight: 106,
                  background: active ? 'color-mix(in srgb, var(--amber) 7%, var(--card))' : 'var(--card)',
                  border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                }}
              >
                <Icon size={17} style={{ color: active ? 'var(--amber)' : 'var(--text-dim)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{k.title}</span>
                <span style={{ fontSize: '0.66rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>{k.desc}</span>
                <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 'auto' }}>
                  e.g. “{k.example}”
                </span>
              </button>
            );
          })}
        </div>

        {usesEngine && (
          <>
            <label style={{
              display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)',
              marginBottom: 6, fontWeight: 500,
            }}>
              Engine
            </label>
            <EnginePicker
              variant="compact"
              engines={engines}
              engine={engine}
              onEngineChange={changeEngine}
              model={model}
              onModelChange={setModel}
              models={models}
              onConfigureEngine={(id) => { onClose(); navigate(`/settings/studio-engines${id ? `?focus=${id}` : ''}`); }}
              onChooseByo={() => { void doCreate(true); }}
              disabled={submitting}
            />
            {engineBlocked && (
              <p style={{ margin: '8px 0 0', fontSize: '0.68rem', color: 'var(--amber)', lineHeight: 1.4 }}>
                Finish setup to use {selectedEngineInfo?.label ?? 'this engine'} — or pick Built-in to start now.
              </p>
            )}
            <p style={{
              margin: '8px 0 16px', fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.4,
            }}>
              The engine builds your app across every phase. For Built-in, only models the build engine (OpenCode) can actually reach are listed. You can change it later from the project's build settings.
            </p>
          </>
        )}
        {kind === 'design' && (
          <>
            <label style={{
              display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)',
              marginBottom: 6, fontWeight: 500,
            }}>
              AI model <span style={{ color: 'var(--text-muted)' }}>(for the design generation)</span>
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={submitting}
              style={{
                padding: '6px 10px', fontSize: '0.8rem', width: '100%', maxWidth: 340,
                background: 'var(--surface)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-sans)', marginBottom: 8,
              }}
            >
              <option value="">Automatic (recommended)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.label ?? m.id}{m.recommended ? ' ★' : ''}</option>
              ))}
            </select>
            <p style={{
              margin: '0 0 16px', fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.4,
            }}>
              You'll describe it, get three visual directions, and refine the screens on a canvas.
              From there you can turn it into a real app, or export the design. Only models the
              generator can actually reach are listed (from Models › Configured).
            </p>
          </>
        )}

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

        {/* BYO handoff — connection modal on top of the create dialog. */}
        {connectProjectId && (
          <ConnectExternalEngineModal
            projectId={connectProjectId}
            onClose={() => {
              const id = connectProjectId;
              setConnectProjectId(null);
              onCreated(id);
            }}
          />
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
