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

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChevronLeft, Save, Play, Plus, Workflow, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFlowsStore, type FlowStep, type FlowRun } from '@/stores/flows.store';
import { StepCard } from './components/StepCard';
import { StepPalette } from './components/StepPalette';
import { TriggerSelector } from './components/TriggerSelector';
import { RunProgress } from './components/RunProgress';

export function Component() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const flows = useFlowsStore((s) => s.flows);
  const stepTypes = useFlowsStore((s) => s.stepTypes);
  const runEventTick = useFlowsStore((s) => s.runEventTick);
  const fetchFlows = useFlowsStore((s) => s.fetchFlows);
  const fetchStepTypes = useFlowsStore((s) => s.fetchStepTypes);
  const fetchRuns = useFlowsStore((s) => s.fetchRuns);
  const approveRun = useFlowsStore((s) => s.approveRun);
  const rejectRun = useFlowsStore((s) => s.rejectRun);
  const updateFlow = useFlowsStore((s) => s.updateFlow);
  const createFlow = useFlowsStore((s) => s.createFlow);
  const runFlow = useFlowsStore((s) => s.runFlow);
  const undoFlow = useFlowsStore((s) => s.undoFlow);

  const isNew = flowId === 'new';
  const flow = isNew ? null : flows.find((f) => f.id === flowId);

  // Editor state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('manual');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [showPalette, setShowPalette] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recentRun, setRecentRun] = useState<FlowRun | null>(null);
  // Bumped after run/approve/reject to (re)start the run poller.
  const [pollNonce, setPollNonce] = useState(0);
  // Tracks which flow id is currently loaded into editor state.
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetchFlows();
    fetchStepTypes();
  }, [fetchFlows, fetchStepTypes]);

  // Load editor state from the flow ONLY when the flow IDENTITY changes
  // (first load / navigation), not on every new array reference. A WS event
  // (workflow.started/completed) refetches `flows` and produces a fresh
  // `flow` object — resyncing on that would silently wipe unsaved edits.
  useEffect(() => {
    if (flow && flow.id !== loadedIdRef.current) {
      loadedIdRef.current = flow.id;
      setName(flow.name);
      setTriggerType(flow.trigger_type);
      setTriggerConfig(flow.trigger_config);
      setSteps(flow.steps);
      setDirty(false);
    } else if (isNew && loadedIdRef.current !== null) {
      // Navigated from an existing flow to "/flows/new" without a remount —
      // clear the editor so it doesn't carry the previous flow's data.
      loadedIdRef.current = null;
      setName('');
      setTriggerType('manual');
      setTriggerConfig({});
      setSteps([]);
      setDirty(false);
    }
  }, [flow, isNew]);

  // Browser-level guard against closing the tab / reloading with
  // unsaved edits. Does NOT cover in-app navigation — that's
  // wrapped at the back-button handler below.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleBack = useCallback(() => {
    if (dirty) {
      const ok = window.confirm('You have unsaved changes. Leave without saving?');
      if (!ok) return;
    }
    navigate('/flows');
  }, [dirty, navigate]);

  const handleSave = useCallback(async () => {
    // Guard against double-submit: an in-flight save (esp. create) could
    // otherwise be re-entered before navigation propagated → duplicate flow.
    if (saving) return;
    if (!name.trim()) { toast.error('Flow name is required'); return; }
    // Client-side pre-flight: surface the obvious problems (empty required
    // params, missing cron expression) immediately instead of letting the
    // backend validator reject the whole save with a less specific message.
    if (steps.length === 0) { toast.error('Add at least one step'); return; }
    for (const step of steps) {
      const def = stepTypes.find((t) => t.id === step.type);
      if (!def) continue;
      for (const p of def.params) {
        if (!p.required) continue;
        const v = step.config[p.id];
        const empty = v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
        if (empty) { toast.error(`Step "${step.label || def.label}": "${p.label}" is required`); return; }
      }
    }
    if (triggerType === 'cron' && !(triggerConfig as Record<string, unknown>)?.expression) {
      toast.error('Scheduled trigger needs a cron expression'); return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await createFlow({
          name: name.trim(),
          trigger_type: triggerType,
          trigger_config: triggerConfig,
          steps,
        });
        toast.success('Flow created');
        setDirty(false);
        navigate(`/flows/${created.id}`, { replace: true });
      } else if (flowId) {
        await updateFlow(flowId, {
          name: name.trim(),
          trigger_type: triggerType,
          trigger_config: triggerConfig,
          steps,
        });
        toast.success('Flow saved');
        setDirty(false);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [saving, isNew, flowId, name, triggerType, triggerConfig, steps, stepTypes, createFlow, updateFlow, navigate]);

  const handleRun = useCallback(async () => {
    if (!flowId || isNew) return;
    try {
      await runFlow(flowId);
      toast.success('Flow started');
      // Fetch the run we just kicked off so RunProgress can render it,
      // then (re)start the poller via the nonce.
      const runs = await fetchRuns(flowId, 1);
      if (runs[0]) setRecentRun(runs[0]);
      setPollNonce((n) => n + 1);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [flowId, isNew, runFlow, fetchRuns]);

  // Poll the most recent run while it's active. Self-reschedules with
  // setTimeout based on the FRESH status from each fetch (not a snapshot
  // captured in deps) — so it never double-fires per tick nor stops early
  // on an intermediate state. Backs off + caps retries on network errors.
  // Restarts whenever a run/approve/reject bumps `pollNonce`.
  useEffect(() => {
    if (!flowId || isNew) return;
    const ACTIVE = new Set(['running', 'queued', 'waiting_approval']);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let misses = 0;
    const tick = async () => {
      if (cancelled) return;
      try {
        const runs = await fetchRuns(flowId, 1);
        if (cancelled) return;
        const latest = runs[0];
        if (latest) setRecentRun(latest);
        misses = 0;
        // Keep polling only while the freshly-fetched run is non-terminal.
        if (latest && ACTIVE.has(latest.status)) {
          timer = setTimeout(tick, 2000);
        }
      } catch {
        if (cancelled) return;
        if (++misses <= 5) timer = setTimeout(tick, 3000);
      }
    };
    void tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // runEventTick: a workflow.* WS event re-triggers an immediate poll so the
    // editor's run view updates promptly instead of waiting for the next tick.
  }, [flowId, isNew, fetchRuns, pollNonce, runEventTick]);

  const handleApproveRun = useCallback(async () => {
    if (!flowId || !recentRun) return;
    try {
      await approveRun(flowId, recentRun.id);
      toast.success('Approved');
      const runs = await fetchRuns(flowId, 1);
      if (runs[0]) setRecentRun(runs[0]);
      setPollNonce((n) => n + 1);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [flowId, recentRun, approveRun, fetchRuns]);

  const handleRejectRun = useCallback(async () => {
    if (!flowId || !recentRun) return;
    try {
      await rejectRun(flowId, recentRun.id);
      toast.success('Rejected');
      const runs = await fetchRuns(flowId, 1);
      if (runs[0]) setRecentRun(runs[0]);
      setPollNonce((n) => n + 1);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [flowId, recentRun, rejectRun, fetchRuns]);

  const handleUndo = useCallback(async () => {
    if (!flowId || isNew) return;
    try {
      await undoFlow(flowId);
      toast.success('Undone');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [flowId, isNew, undoFlow]);

  const addStep = useCallback((type: string, label: string) => {
    // Step IDs must be unique within a flow because inputRef + condition
    // expressions reference them by literal id (`$s2.field`). Picking
    // `s${len+1}` collides after a remove (e.g. delete s2 from [s1,s2,s3]
    // → length 2 → next id "s3" duplicates the existing one).
    // Take max(existing) + 1 to stay sequential without collisions.
    const existing = new Set(steps.map((s) => s.id));
    let n = steps.length + 1;
    let id = `s${n}`;
    while (existing.has(id)) id = `s${++n}`;
    const newStep: FlowStep = { id, type, label, config: {} };
    if (insertIndex !== null) {
      const updated = [...steps];
      updated.splice(insertIndex, 0, newStep);
      setSteps(updated);
    } else {
      setSteps([...steps, newStep]);
    }
    setShowPalette(false);
    setInsertIndex(null);
    setDirty(true);
  }, [steps, insertIndex]);

  const updateStep = useCallback((index: number, updates: Partial<FlowStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
    setDirty(true);
  }, []);

  const removeStep = useCallback((index: number) => {
    let removedStep: FlowStep | undefined;
    let snapshot: FlowStep[] = [];
    let postDeleteSig = '';
    // Full signature (not just ids): a config/inputRef/condition/label edit to
    // a surviving step within the 5s window must also block the undo, or the
    // snapshot restore would silently revert that edit.
    const sig = (arr: FlowStep[]) =>
      JSON.stringify(arr.map((s) => ({ i: s.id, t: s.type, l: s.label, c: s.config, r: s.inputRef, d: s.condition })));
    setSteps((prev) => {
      removedStep = prev[index];
      snapshot = prev;
      const filtered = prev.filter((_, i) => i !== index);
      // C2: prune any inputRef / condition that referenced the removed
      // step. The backend validator would reject the flow on save, but
      // it's cleaner UX to silently drop the dangling refs here so the
      // user can save without hunting them down.
      let next = filtered;
      if (removedStep) {
        const danglingRef = `$${removedStep.id}`;
        next = filtered.map((s) => {
          let cleaned = s;
          if (s.inputRef === danglingRef) {
            cleaned = { ...cleaned, inputRef: undefined };
          }
          if (s.condition && s.condition.includes(danglingRef)) {
            cleaned = { ...cleaned, condition: undefined };
          }
          return cleaned;
        });
      }
      postDeleteSig = sig(next);
      return next;
    });
    setDirty(true);
    // E13: Undo toast — gives the user 5s to revert an accidental delete
    // without a confirm modal getting in the way for the common case.
    if (removedStep) {
      toast(`Removed "${removedStep.label || removedStep.type}"`, {
        action: {
          label: 'Undo',
          onClick: () => {
            // Only restore if nothing changed since the delete — otherwise the
            // snapshot would silently clobber edits made in the 5s window (and
            // could reintroduce a step id that now collides with a new one).
            setSteps((cur) => {
              if (sig(cur) !== postDeleteSig) {
                toast.error('Steps changed since delete — not undone');
                return cur;
              }
              return snapshot;
            });
            setDirty(true);
          },
        },
        duration: 5000,
      });
    }
  }, []);

  const moveStep = useCallback((from: number, to: number) => {
    setSteps((prev) => arrayMove(prev, from, to));
    setDirty(true);
  }, []);

  // ─── DnD ─────────────────────────────────────────────
  const sensors = useSensors(
    // Pointer activates after a small drag distance so a normal click
    // on the card header doesn't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    moveStep(oldIndex, newIndex);
  }, [steps, moveStep]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}
            title={dirty ? 'Unsaved changes' : 'Back to flows'}
          >
            <ChevronLeft size={18} />
          </button>
          <Workflow size={18} style={{ color: 'var(--mod-flows)' }} />
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            placeholder="Flow name..."
            style={{
              background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 15, fontWeight: 500,
              fontFamily: 'var(--font-sans)', outline: 'none', width: 300,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isNew && (
            <button onClick={handleUndo} title="Undo" style={iconBtnStyle}>
              <Undo2 size={14} />
            </button>
          )}
          {!isNew && (
            <button onClick={handleRun} style={{ ...actionBtnStyle, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              <Play size={12} /> Run
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...actionBtnStyle, background: dirty ? 'var(--mod-flows)' : 'var(--surface)', color: dirty ? '#fff' : 'var(--text-dim)', opacity: saving ? 0.6 : 1, cursor: saving ? 'wait' : 'pointer' }}
          >
            <Save size={12} /> {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Trigger */}
        <TriggerSelector
          triggerType={triggerType}
          triggerConfig={triggerConfig}
          flowId={isNew ? undefined : flowId}
          webhookSecret={(flow?.trigger_config?.secret as string | undefined) ?? undefined}
          onChange={(type, config) => { setTriggerType(type); setTriggerConfig(config); setDirty(true); }}
        />

        {/* Connector */}
        {steps.length > 0 && <div style={{ width: 2, height: 20, background: 'var(--border)' }} />}

        {/* Steps — drag-and-drop sortable list. The PointerSensor's
            distance threshold (4px) lets normal clicks on the header
            still toggle expand/collapse without triggering a drag. */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {steps.map((step, i) => (
              <SortableStep
                key={step.id}
                step={step}
                index={i}
                totalSteps={steps.length}
                previousSteps={steps.slice(0, i)}
                onUpdate={(updates) => updateStep(i, updates)}
                onRemove={() => removeStep(i)}
                onMoveUp={i > 0 ? () => moveStep(i, i - 1) : undefined}
                onMoveDown={i < steps.length - 1 ? () => moveStep(i, i + 1) : undefined}
                onInsertAfter={() => { setInsertIndex(i + 1); setShowPalette(true); }}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add step button */}
        <button
          onClick={() => { setInsertIndex(null); setShowPalette(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', background: 'none', border: '1px dashed var(--border)',
            borderRadius: 8, color: 'var(--text-muted)', fontSize: 12,
            cursor: 'pointer', fontFamily: 'var(--font-sans)', marginTop: 8,
          }}
        >
          <Plus size={14} /> Add step
        </button>

        {/* Live run progress — visible whenever there's a recent run.
            Polls every 2s while running/waiting/queued (see useEffect
            above). Shows step-by-step status and inline approval. */}
        {!isNew && recentRun && (
          <div style={{ width: '100%', maxWidth: 520, marginTop: 24 }}>
            <div style={{
              fontSize: 11, color: 'var(--text-dim)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: 6,
            }}>
              Latest run · {new Date(recentRun.started_at).toLocaleString()}
            </div>
            <RunProgress
              run={recentRun}
              flowSteps={steps.map((s) => ({ id: s.id, label: s.label, type: s.type }))}
              onApprove={recentRun.status === 'waiting_approval' ? handleApproveRun : undefined}
              onReject={recentRun.status === 'waiting_approval' ? handleRejectRun : undefined}
            />
          </div>
        )}
      </div>

      {/* Step palette modal */}
      {showPalette && (
        <StepPalette
          onSelect={(type, label) => addStep(type, label)}
          onClose={() => { setShowPalette(false); setInsertIndex(null); }}
        />
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 4,
  cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
};

const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 12px', border: 'none', borderRadius: 6, fontSize: 12,
  fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

// ─── SortableStep ──────────────────────────────────────────────────
// Wraps StepCard with @dnd-kit's useSortable so the GripVertical icon
// in the card header acts as a real drag handle for vertical reorder.
// Includes the connector line + insert-step button below the card.

interface SortableStepProps {
  step: FlowStep;
  index: number;
  totalSteps: number;
  previousSteps: FlowStep[];
  onUpdate: (updates: Partial<FlowStep>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onInsertAfter: () => void;
}

function SortableStep({
  step, index, totalSteps, previousSteps,
  onUpdate, onRemove, onMoveUp, onMoveDown, onInsertAfter,
}: SortableStepProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', width: '100%', maxWidth: 520,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <StepCard
        step={step}
        index={index}
        totalSteps={totalSteps}
        previousSteps={previousSteps}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        dragHandleProps={{ attributes, listeners }}
        isDragging={isDragging}
      />
      {/* Connector + insert button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 2, height: 12, background: 'var(--border)' }} />
        <button
          onClick={onInsertAfter}
          style={{
            width: 20, height: 20, borderRadius: '50%', border: '1px dashed var(--border)',
            background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
          }}
          title="Insert step here"
        >
          <Plus size={10} />
        </button>
        <div style={{ width: 2, height: 12, background: 'var(--border)' }} />
      </div>
    </div>
  );
}
