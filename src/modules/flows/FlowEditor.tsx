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
import { ChevronLeft, Save, Play, TestTube2, Plus, Workflow, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFlowsStore, type Flow, type FlowStep } from '@/stores/flows.store';
import { StepCard } from './components/StepCard';
import { StepPalette } from './components/StepPalette';
import { TriggerSelector } from './components/TriggerSelector';

export function Component() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const flows = useFlowsStore((s) => s.flows);
  const fetchFlows = useFlowsStore((s) => s.fetchFlows);
  const fetchStepTypes = useFlowsStore((s) => s.fetchStepTypes);
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
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [flowId, isNew, runFlow]);

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
    const id = `s${steps.length + 1}`;
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
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }, []);

  const moveStep = useCallback((from: number, to: number) => {
    setSteps((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return updated;
    });
    setDirty(true);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate('/flows')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}
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
          onChange={(type, config) => { setTriggerType(type); setTriggerConfig(config); setDirty(true); }}
        />

        {/* Connector */}
        {steps.length > 0 && <div style={{ width: 2, height: 20, background: 'var(--border)' }} />}

        {/* Steps */}
        {steps.map((step, i) => (
          <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 520 }}>
            <StepCard
              step={step}
              index={i}
              totalSteps={steps.length}
              onUpdate={(updates) => updateStep(i, updates)}
              onRemove={() => removeStep(i)}
              onMoveUp={i > 0 ? () => moveStep(i, i - 1) : undefined}
              onMoveDown={i < steps.length - 1 ? () => moveStep(i, i + 1) : undefined}
            />
            {/* Connector + insert button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 2, height: 12, background: 'var(--border)' }} />
              <button
                onClick={() => { setInsertIndex(i + 1); setShowPalette(true); }}
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
        ))}

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
