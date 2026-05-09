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

import { useEffect, useState, useCallback } from 'react';
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
  const [recentRun, setRecentRun] = useState<FlowRun | null>(null);

  useEffect(() => {
    fetchFlows();
    fetchStepTypes();
  }, [fetchFlows, fetchStepTypes]);

  useEffect(() => {
    if (flow) {
      setName(flow.name);
      setTriggerType(flow.trigger_type);
      setTriggerConfig(flow.trigger_config);
      setSteps(flow.steps);
      setDirty(false);
    }
  }, [flow]);

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
    try {
      if (isNew) {
        if (!name.trim()) { toast.error('Flow name is required'); return; }
        const created = await createFlow({
          name: name.trim(),
          trigger_type: triggerType,
          trigger_config: triggerConfig,
          steps,
        });
        toast.success('Flow created');
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
    }
  }, [isNew, flowId, name, triggerType, triggerConfig, steps, createFlow, updateFlow, navigate]);

  const handleRun = useCallback(async () => {
    if (!flowId || isNew) return;
    try {
      await runFlow(flowId);
      toast.success('Flow started');
      // Fetch the run we just kicked off so RunProgress can render it.
      const runs = await fetchRuns(flowId, 1);
      if (runs[0]) setRecentRun(runs[0]);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [flowId, isNew, runFlow, fetchRuns]);

  // Poll the most recent run while it's active. Cheap (single GET,
  // 2s cadence) and stops as soon as the run reaches a terminal state.
  useEffect(() => {
    if (!flowId || isNew) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const runs = await fetchRuns(flowId, 1);
        if (!cancelled && runs[0]) setRecentRun(runs[0]);
      } catch { /* silent */ }
    };
    void tick(); // initial fetch on mount
    const isActive = recentRun && (
      recentRun.status === 'running' ||
      recentRun.status === 'queued' ||
      recentRun.status === 'waiting_approval'
    );
    if (!isActive) return () => { cancelled = true; };
    const handle = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, isNew, recentRun?.status, recentRun?.id]);

  const handleApproveRun = useCallback(async () => {
    if (!flowId || !recentRun) return;
    try {
      await approveRun(flowId, recentRun.id);
      toast.success('Approved');
      const runs = await fetchRuns(flowId, 1);
      if (runs[0]) setRecentRun(runs[0]);
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
    setSteps((prev) => {
      removedStep = prev[index];
      snapshot = prev;
      const next = prev.filter((_, i) => i !== index);
      // C2: prune any inputRef / condition that referenced the removed
      // step. The backend validator would reject the flow on save, but
      // it's cleaner UX to silently drop the dangling refs here so the
      // user can save without hunting them down.
      if (removedStep) {
        const danglingRef = `$${removedStep.id}`;
        return next.map((s) => {
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
            setSteps(snapshot);
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
          <button onClick={handleSave} style={{ ...actionBtnStyle, background: dirty ? 'var(--mod-flows)' : 'var(--surface)', color: dirty ? '#fff' : 'var(--text-dim)' }}>
            <Save size={12} /> {isNew ? 'Create' : 'Save'}
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
