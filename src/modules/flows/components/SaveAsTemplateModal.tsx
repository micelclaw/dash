/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 */

import { useState, useCallback } from 'react';
import { X, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { useFlowsStore } from '@/stores/flows.store';

interface SaveAsTemplateModalProps {
  flowId: string;
  flowName: string;
  flowColor: string;
  onClose: () => void;
}

export function SaveAsTemplateModal({ flowId, flowName, flowColor, onClose }: SaveAsTemplateModalProps) {
  const saveAsTemplate = useFlowsStore((s) => s.saveAsTemplate);
  const [name, setName] = useState(flowName);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveAsTemplate(flowId);
      toast.success('Saved as template');
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [flowId, saveAsTemplate, onClose]);

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
          width: '90vw', maxWidth: 400, padding: 0,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Workflow size={16} style={{ color: flowColor }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Save as Template</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>Template name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this flow do?"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            The template will be saved to your personal template library. You can use it to create new flows with the same steps.
          </p>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '6px 14px', background: flowColor, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : 'Save template'}
          </button>
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
