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

import { useState, lazy, Suspense } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';

const LazyTokenDashboard = lazy(() => import('./TokenUsageDashboard').then(m => ({ default: m.TokenUsageDashboard })));
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingSelect } from '../SettingSelect';
import { SettingToggle } from '../SettingToggle';
import { SaveBar } from '../SaveBar';
import { GraphHealthSection } from './GraphHealthSection';
import { EntityExtractionConfig } from './EntityExtractionConfig';
import { MultimodalModelSection } from './MultimodalModelSection';

const CLOUD_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-3-5',
  'deepseek-chat',
  'gpt-4o',
  'gemini-2.0-flash',
];

export function AISection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);

  if (!settings) return null;
  const ai = settings.ai;

  const allModels = [
    ...CLOUD_MODELS.map((m) => ({ value: m, label: m })),
    ...ai.local_models.available_models.map((m) => ({ value: m, label: `${m} (local)` })),
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('ai', {
        default_model: ai.default_model,
        payment_method: ai.payment_method,
        auto_routing: ai.auto_routing,
      });
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <>
      {/* Model Configuration */}
      <SettingSection title="Model Configuration">
        <SettingSelect
          label="Default Model"
          value={ai.default_model}
          options={allModels}
          onChange={(v) => setLocalValue('ai.default_model', v)}
        />

        {/* Payment Method */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Payment Method</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['byok', 'credits'] as const).map((method) => {
              const isActive = ai.payment_method === method;
              const labels: Record<string, string> = { byok: 'Bring Your Own Key (BYOK)', credits: 'Claw Credits (Pro)' };
              return (
                <button
                  key={method}
                  onClick={() => setLocalValue('ai.payment_method', method)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 30, padding: '0 12px',
                    background: isActive ? 'var(--amber)' : 'var(--surface)',
                    color: isActive ? '#06060a' : 'var(--text-dim)',
                    border: isActive ? 'none' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
                    cursor: 'pointer', fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${isActive ? '#06060a' : 'var(--text-muted)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#06060a' }} />}
                  </span>
                  {labels[method]}
                </button>
              );
            })}
          </div>
        </div>

        <SettingToggle
          label="Auto-routing"
          description="When enabled, the system automatically selects the best model for each task."
          checked={ai.auto_routing}
          onChange={(v) => setLocalValue('ai.auto_routing', v)}
        />
      </SettingSection>

      {/* Pointer to Gateway → Models → Advanced (providers, keys, Ollama moved there) */}
      <SettingSection title="Providers & Runtimes">
        <Link
          to="/gateway?tab=models&view=advanced"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, padding: '12px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            color: 'var(--text)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              Manage API keys, providers and local runtimes
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>
              Built-in provider keys (Anthropic, OpenAI, Google, DeepSeek), custom providers (vLLM, OpenRouter, Together AI, ...), and local Ollama runtime all live in <strong>Gateway → Models → Advanced</strong>.
            </div>
          </div>
          <ExternalLink size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        </Link>
      </SettingSection>

      {/* Multimodal Model */}
      <SettingSection title="Multimodal Model" description="Local Ollama model used for photo descriptions, entity extraction, diary narratives, and digests.">
        <MultimodalModelSection />
      </SettingSection>

      {/* Token Usage Dashboard */}
      <SettingSection title="Token Usage">
        <Suspense fallback={
          <div style={{ padding: '24px 0' }}>
            <div style={{ height: 60, background: 'var(--surface)', borderRadius: 'var(--radius-md)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        }>
          <LazyTokenDashboard />
        </Suspense>
      </SettingSection>

      {/* Entity Extraction */}
      <SettingSection title="Entity Extraction">
        <EntityExtractionConfig />
      </SettingSection>

      {/* Graph Health */}
      <SettingSection title="Graph Health">
        <GraphHealthSection />
      </SettingSection>

      <SaveBar visible={!!dirty.ai} saving={saving} onSave={handleSave} onDiscard={() => resetSection('ai')} />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
