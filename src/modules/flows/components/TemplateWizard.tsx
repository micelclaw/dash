/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { X, ChevronLeft, ChevronRight, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { useFlowsStore } from '@/stores/flows.store';

interface WizardField {
  id: string;
  question: string;
  type: string;
  source?: string;
  options?: Array<{ value: string; label: string }>;
  default?: unknown;
  required?: boolean;
  maps_to?: string;
}

interface WizardStep {
  id: string;
  title: string;
  fields: WizardField[];
}

interface TemplateData {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: unknown[];
  wizard: { steps: WizardStep[] };
}

interface TemplateWizardProps {
  template: TemplateData;
  onClose: () => void;
}

export function TemplateWizard({ template, onClose }: TemplateWizardProps) {
  const navigate = useNavigate();
  const createFlow = useFlowsStore((s) => s.createFlow);
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    // Initialize with defaults
    const defaults: Record<string, unknown> = {};
    for (const step of template.wizard.steps) {
      for (const field of step.fields) {
        if (field.default !== undefined) {
          defaults[field.id] = field.default;
        }
      }
    }
    return defaults;
  });
  const [creating, setCreating] = useState(false);

  const wizardSteps = template.wizard.steps;
  const hasWizard = wizardSteps.length > 0;
  const totalSteps = wizardSteps.length;
  const step = wizardSteps[currentStep];

  const applyWizardValues = useCallback(() => {
    // Deep clone template data
    const flowData: Record<string, unknown> = {
      name: template.name,
      trigger_type: template.trigger_type ?? 'manual',
      trigger_config: JSON.parse(JSON.stringify(template.trigger_config ?? {})),
      steps: JSON.parse(JSON.stringify(template.steps ?? [])),
      icon: template.icon,
      color: template.color,
      category: template.category,
      template_source: `built-in:${template.id}`,
    };

    // Apply wizard values via maps_to paths
    for (const ws of wizardSteps) {
      for (const field of ws.fields) {
        const val = values[field.id] ?? field.default;
        if (val === undefined) continue;

        const mapsTo = field.maps_to;
        if (!mapsTo) continue;

        // Handle special case: manual trigger
        if (mapsTo === 'trigger_config.expression' && val === 'manual') {
          flowData.trigger_type = 'manual';
          flowData.trigger_config = {};
          continue;
        }

        // Simple path resolution: "steps[0].config.account" → set nested value
        const parts = mapsTo.split('.');
        let target: any = flowData;
        for (let i = 0; i < parts.length - 1; i++) {
          const p = parts[i]!;
          const match = p.match(/^(\w+)\[(\d+)\]$/);
          if (match && match[1] && match[2]) {
            target = target[match[1]][Number(match[2])];
          } else {
            target = target[p];
          }
        }
        const lastKey = parts[parts.length - 1]!;
        target[lastKey] = val;
      }
    }

    return flowData;
  }, [template, wizardSteps, values]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const flowData = applyWizardValues();
      const flow = await createFlow(flowData);
      toast.success(`Flow "${template.name}" created`);
      onClose();
      navigate(`/flows/${flow.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  }, [applyWizardValues, createFlow, template.name, onClose, navigate]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
          width: '90vw', maxWidth: 440, padding: 0, display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Workflow size={18} style={{ color: template.color }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Create: {template.name}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '18px 20px', minHeight: 200 }}>
          {!hasWizard ? (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 12px' }}>{template.description}</p>
              <p style={{ fontSize: 13, color: 'var(--text)' }}>This template is ready to use. No configuration needed.</p>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                {wizardSteps.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === currentStep ? 20 : 8, height: 4, borderRadius: 2,
                      background: i <= currentStep ? template.color : 'var(--border)',
                      transition: 'all 200ms',
                    }}
                  />
                ))}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                  Step {currentStep + 1} of {totalSteps}
                </span>
              </div>

              {/* Step title */}
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>{step?.title}</div>

              {/* Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {step?.fields.map((field) => (
                  <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>{field.question}</label>
                    {field.type === 'select' && field.options ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {field.options.map((opt) => (
                          <label
                            key={opt.value}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                              borderRadius: 6, cursor: 'pointer',
                              border: `1px solid ${values[field.id] === opt.value ? template.color : 'var(--border)'}`,
                              background: values[field.id] === opt.value ? `${template.color}10` : 'var(--surface)',
                            }}
                          >
                            <input
                              type="radio"
                              name={field.id}
                              checked={values[field.id] === opt.value}
                              onChange={() => setValues({ ...values, [field.id]: opt.value })}
                              style={{ accentColor: template.color }}
                            />
                            <span style={{ fontSize: 13, color: 'var(--text)' }}>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'number' ? (
                      <input
                        type="number"
                        value={(values[field.id] as number) ?? field.default ?? ''}
                        onChange={(e) => setValues({ ...values, [field.id]: Number(e.target.value) })}
                        style={inputStyle}
                      />
                    ) : field.type === 'tag_input' ? (
                      <input
                        value={Array.isArray(values[field.id]) ? (values[field.id] as string[]).join(', ') : ''}
                        onChange={(e) => setValues({ ...values, [field.id]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                        placeholder="Tag 1, Tag 2, ..."
                        style={inputStyle}
                      />
                    ) : field.type === 'toggle' ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(values[field.id] ?? field.default)}
                          onChange={(e) => setValues({ ...values, [field.id]: e.target.checked })}
                          style={{ accentColor: template.color }}
                        />
                        Yes
                      </label>
                    ) : (
                      <input
                        value={(values[field.id] as string) ?? ''}
                        onChange={(e) => setValues({ ...values, [field.id]: e.target.value })}
                        style={inputStyle}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={hasWizard && currentStep > 0 ? () => setCurrentStep(currentStep - 1) : onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            <ChevronLeft size={12} /> {hasWizard && currentStep > 0 ? 'Back' : 'Cancel'}
          </button>
          {hasWizard && currentStep < totalSteps - 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: template.color, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Next <ChevronRight size={12} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{ padding: '6px 14px', background: template.color, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: creating ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', opacity: creating ? 0.7 : 1 }}
            >
              {creating ? 'Creating...' : 'Create flow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '7px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)',
  outline: 'none',
};
