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
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingInput } from '../SettingInput';
import { SaveBar } from '../SaveBar';
import { ProLockBanner, useIsPro } from '../shared/ProLockBanner';
import { PhotoPipelineProgress } from './PhotoPipelineProgress';

export function PhotosSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const isPro = useIsPro();
  const [saving, setSaving] = useState(false);

  if (!settings) return null;
  const p = settings.photos;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('photos', settings.photos as unknown as Record<string, unknown>);
      toast.success('Photos saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <>
      <SettingSection title="Photos" description="Photo timeline and guest upload settings.">
        <SettingToggle
          label="Include Attachments in Timeline"
          description="Show images from email attachments in the Photos timeline"
          checked={p.include_attachments_in_timeline}
          onChange={(v) => setLocalValue('photos.include_attachments_in_timeline', v)}
        />
        <SettingInput
          label="Guest Upload Limit"
          description="Max uploads per IP per day for shared album guests"
          type="number"
          value={String(p.max_guest_uploads_per_ip_day)}
          onChange={(v) => setLocalValue('photos.max_guest_uploads_per_ip_day', Math.max(1, Math.min(1000, parseInt(v) || 50)))}
          min={1}
          max={1000}
        />
      </SettingSection>

      <SettingSection title="Photo AI Processing">
        {/* Pro gate: banner for free users + `disabled={!isPro}` on every
            control. Disabled is real (HTML disabled) — not just opacity —
            so users can't accidentally toggle stuff that the backend
            would reject anyway. */}
        <ProLockBanner description="Face recognition, semantic search, and automatic descriptions for your photos." />

        <SettingToggle
          label="Enabled"
          description="Run the AI worker that indexes new photos in the background."
          checked={p.ai_worker.enabled}
          onChange={(v) => setLocalValue('photos.ai_worker.enabled', v)}
          disabled={!isPro}
        />

        {p.ai_worker.paused && isPro && (
          <div style={{
            padding: '8px 12px', marginBottom: 8,
            background: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem', color: '#f59e0b', fontFamily: 'var(--font-sans)',
          }}>
            AI processing is paused. New photos won't be indexed until resumed.
          </div>
        )}

        <SettingToggle
          label="Paused"
          description="Stop processing new photos without losing the queue."
          checked={p.ai_worker.paused}
          onChange={(v) => setLocalValue('photos.ai_worker.paused', v)}
          disabled={!isPro}
        />

        <SettingInput
          label="Rate Limit"
          description="Maximum photos processed per minute. Lower = lighter on CPU/GPU."
          type="number"
          value={String(p.ai_worker.rate_limit)}
          onChange={(v) => setLocalValue('photos.ai_worker.rate_limit', Math.max(1, parseInt(v) || 5))}
          min={1}
          disabled={!isPro}
        />

        <SettingToggle
          label="Face Recognition"
          description="Detect and group faces across your library (uses InsightFace)."
          checked={p.ai_worker.face_recognition}
          onChange={(v) => setLocalValue('photos.ai_worker.face_recognition', v)}
          disabled={!isPro}
        />

        {/* Face Threshold slider */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)', opacity: !isPro ? 0.5 : 1 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Face match threshold</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
              How similar two faces must be to count as the same person. Range: 0.10–1.00 (default 0.50). Lower = more matches but more false positives.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={p.ai_worker.face_threshold}
              onChange={(e) => setLocalValue('photos.ai_worker.face_threshold', parseFloat(e.target.value))}
              disabled={!isPro}
              style={{ width: 120, accentColor: 'var(--amber)', cursor: !isPro ? 'not-allowed' : 'pointer' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', minWidth: 30, textAlign: 'right' }}>
              {p.ai_worker.face_threshold.toFixed(2)}
            </span>
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Find Similar" description="Thresholds used by the 'Find similar photos' feature in the Photos module.">
        {/* Visual similarity slider — DINOv2 model */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Visual similarity (DINOv2)</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
              Pixel-level similarity — finds photos that <em>look</em> alike (same composition, colors, framing).
              Range: 0.05–0.80 (default 0.30). Lower = stricter, higher = more permissive.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={p.similar_visual_threshold}
              onChange={(e) => setLocalValue('photos.similar_visual_threshold', parseFloat(e.target.value))}
              style={{ width: 120, accentColor: 'var(--amber)' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', minWidth: 30, textAlign: 'right' }}>
              {p.similar_visual_threshold.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Concept similarity slider — SigLIP model */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Concept similarity (SigLIP)</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
              Semantic similarity — finds photos of <em>the same thing</em> (same person, object, scene) even if they look different.
              Range: 0.05–0.80 (default 0.20). Lower = stricter, higher = more permissive.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={p.similar_concept_threshold}
              onChange={(e) => setLocalValue('photos.similar_concept_threshold', parseFloat(e.target.value))}
              style={{ width: 120, accentColor: 'var(--amber)' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', minWidth: 30, textAlign: 'right' }}>
              {p.similar_concept_threshold.toFixed(2)}
            </span>
          </div>
        </div>
      </SettingSection>

      {p.ai_worker.enabled && <PhotoPipelineProgress />}

      <SaveBar visible={!!dirty.photos} saving={saving} onSave={handleSave} onDiscard={() => resetSection('photos')} />
    </>
  );
}
