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

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';

interface CustomModelConfigModalProps {
  mode: 'add' | 'edit';
  provider: string;
  modelId: string;
  modelName?: string;
  initialContextWindow?: number;
  initialMaxTokens?: number;
  onClose: () => void;
  onSuccess: () => void;
}

const CTX_PRESETS = [
  { value: 32_768, label: '32K' },
  { value: 65_536, label: '64K' },
  { value: 131_072, label: '128K' },
  { value: 200_000, label: '200K' },
  { value: 1_000_000, label: '1M' },
];

const MAX_TOKEN_PRESETS = [
  { value: 4_096, label: '4K' },
  { value: 8_192, label: '8K' },
  { value: 16_384, label: '16K' },
  { value: 32_768, label: '32K' },
];

export function CustomModelConfigModal({
  mode,
  provider,
  modelId,
  modelName,
  initialContextWindow,
  initialMaxTokens,
  onClose,
  onSuccess,
}: CustomModelConfigModalProps) {
  const [contextWindow, setContextWindow] = useState<number>(initialContextWindow ?? 200_000);
  const [maxTokens, setMaxTokens] = useState<number>(initialMaxTokens ?? 8_192);
  const [saving, setSaving] = useState(false);
  // Inline error from the backend probe (catalog lookup). Surfaced in the
  // modal instead of via toast so the user sees the actionable detail
  // (sample of available model ids when it's a catalog mismatch).
  const [probeError, setProbeError] = useState<{ code?: string; message: string; sample?: string[] } | null>(null);

  const canSave = contextWindow > 0 && maxTokens > 0 && maxTokens <= contextWindow;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setProbeError(null);
    try {
      await gwService.addModelWithConfig({
        model: `${provider}/${modelId}`,
        provider_id: provider,
        model_id: modelId,
        name: modelName ?? modelId,
        max_tokens: maxTokens,
        context_window: contextWindow,
      });
      toast.success(mode === 'add' ? `Added ${modelId}` : `Updated ${modelId}`);
      onSuccess();
      onClose();
    } catch (err) {
      const code = (err as { code?: string }).code;
      const sample = (err as { available_sample?: string[] }).available_sample;
      const msg = err instanceof Error ? err.message : String(err);
      // Probe failures get inline display so the user sees the available
      // model sample (when catalog mismatch) or a clear "not serving" message.
      // Other errors fall through to toast.
      if (
        code === 'MODEL_NOT_IN_CATALOG' ||
        code === 'MODEL_PROBE_FAILED' ||
        code === 'MODEL_PROBE_UNREACHABLE' ||
        code === 'MODEL_NOT_SERVING'
      ) {
        setProbeError({ code, message: msg, sample });
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%', maxWidth: 460,
          padding: 24, margin: 16,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <h2 style={{
            margin: 0, fontSize: '1rem', fontWeight: 600,
            color: 'var(--text)', fontFamily: 'var(--font-sans)',
          }}>
            {mode === 'add' ? 'Add model' : 'Edit model'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{
          fontSize: '0.75rem', color: 'var(--text-dim)',
          marginBottom: 16, lineHeight: 1.5,
          fontFamily: 'var(--font-sans)',
        }}>
          <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{provider}/{modelId}</strong>
          <br />
          The provider's <code style={{ fontFamily: 'var(--font-mono)' }}>/v1/models</code> endpoint doesn't expose context limits. Set them so OpenClaw doesn't compact prematurely.
        </p>

        {/* Context Window */}
        <Field
          label="Context window (tokens)"
          desc="Total tokens the model can hold (input + output)."
          value={contextWindow}
          onChange={setContextWindow}
          presets={CTX_PRESETS}
        />

        {/* Max Tokens */}
        <Field
          label="Max output tokens"
          desc="Maximum tokens per response. Must be ≤ context window."
          value={maxTokens}
          onChange={setMaxTokens}
          presets={MAX_TOKEN_PRESETS}
        />

        {!canSave && contextWindow > 0 && maxTokens > contextWindow && (
          <p style={{
            fontSize: '0.6875rem', color: '#f43f5e',
            margin: '4px 0 12px', fontFamily: 'var(--font-sans)',
          }}>
            Max output tokens must be ≤ context window.
          </p>
        )}

        {probeError && (
          <div style={{
            margin: '12px 0 4px',
            padding: '8px 10px',
            background: 'color-mix(in srgb, #ef4444 12%, transparent)',
            border: '1px solid color-mix(in srgb, #ef4444 35%, transparent)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text)',
            lineHeight: 1.4,
          }}>
            <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>
              {probeError.code === 'MODEL_NOT_IN_CATALOG'
                ? 'Modelo no encontrado en el proveedor'
                : probeError.code === 'MODEL_PROBE_UNREACHABLE'
                  ? 'No se pudo contactar al proveedor'
                  : probeError.code === 'MODEL_NOT_SERVING'
                    ? 'Modelo listado pero no responde'
                    : 'Verificación rechazada por el proveedor'}
            </div>
            <div style={{ color: 'var(--text-dim)', marginBottom: 6 }}>
              {probeError.message}
            </div>
            {probeError.sample && probeError.sample.length > 0 && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.625rem' }}>
                  Modelos disponibles ({probeError.sample.length})
                </summary>
                <div style={{
                  marginTop: 6,
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.625rem',
                  color: 'var(--text-muted)',
                  maxHeight: 120,
                  overflowY: 'auto',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 8px',
                }}>
                  {probeError.sample.map((id) => <div key={id}>{id}</div>)}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          marginTop: 20,
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px', fontSize: '0.8125rem',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--amber)', color: '#000',
              border: 'none', borderRadius: 'var(--radius-sm)',
              padding: '8px 16px', fontSize: '0.8125rem',
              fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: (!canSave || saving) ? 'not-allowed' : 'pointer',
              opacity: (!canSave || saving) ? 0.6 : 1,
            }}
          >
            {saving && <Loader2 size={12} className="spin" />}
            {saving ? 'Verifying...' : mode === 'add' ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, desc, value, onChange, presets }: {
  label: string;
  desc: string;
  value: number;
  onChange: (v: number) => void;
  presets: { value: number; label: string }[];
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: '0.75rem',
        color: 'var(--text-dim)', marginBottom: 4,
        fontFamily: 'var(--font-sans)',
      }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <input
          type="number"
          value={value}
          min={1}
          step={1024}
          onChange={e => onChange(parseInt(e.target.value, 10) || 0)}
          style={{
            background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px', fontSize: '0.8125rem',
            fontFamily: 'var(--font-mono)', width: 140,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {presets.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              style={{
                background: value === p.value ? 'var(--amber-dim)' : 'var(--surface)',
                color: value === p.value ? 'var(--amber)' : 'var(--text-dim)',
                border: `1px solid ${value === p.value ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px', fontSize: '0.6875rem',
                fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p style={{
        fontSize: '0.6875rem', color: 'var(--text-muted)',
        margin: 0, fontFamily: 'var(--font-sans)',
      }}>
        {desc}
      </p>
    </div>
  );
}
