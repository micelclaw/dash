import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings.store';
import { SettingSection } from '../SettingSection';
import { SettingToggle } from '../SettingToggle';
import { SettingInput } from '../SettingInput';
import { SaveBar } from '../SaveBar';
import { PhotoPipelineProgress } from './PhotoPipelineProgress';

export function PhotosSection() {
  const settings = useSettingsStore((s) => s.settings);
  const dirty = useSettingsStore((s) => s.dirty);
  const setLocalValue = useSettingsStore((s) => s.setLocalValue);
  const updateSection = useSettingsStore((s) => s.updateSection);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const [saving, setSaving] = useState(false);

  if (!settings) return null;
  const p = settings.photos;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSection('photos', settings.photos as unknown as Record<string, unknown>);
      toast.success('Settings saved');
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

      <SettingSection title="Photo AI Processing (Pro)">
        <SettingToggle
          label="Enabled"
          checked={p.ai_worker.enabled}
          onChange={(v) => setLocalValue('photos.ai_worker.enabled', v)}
        />

        {p.ai_worker.paused && (
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
          checked={p.ai_worker.paused}
          onChange={(v) => setLocalValue('photos.ai_worker.paused', v)}
        />

        <SettingInput
          label="Rate Limit"
          description="Photos per minute"
          type="number"
          value={String(p.ai_worker.rate_limit)}
          onChange={(v) => setLocalValue('photos.ai_worker.rate_limit', Math.max(1, parseInt(v) || 5))}
          min={1}
        />

        <SettingToggle
          label="Face Recognition"
          checked={p.ai_worker.face_recognition}
          onChange={(v) => setLocalValue('photos.ai_worker.face_recognition', v)}
        />

        {/* Face Threshold slider */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Face Threshold</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
              Lower = more matches, Higher = stricter
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
              style={{ width: 120, accentColor: 'var(--amber)' }}
            />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono, monospace)', minWidth: 30, textAlign: 'right' }}>
              {p.ai_worker.face_threshold.toFixed(2)}
            </span>
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Find Similar" description="Minimum similarity threshold for photo similarity search.">
        {/* Visual similarity slider */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Visual Threshold</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
              Pixel-level similarity (DINOv2)
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

        {/* Concept similarity slider */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>Concept Threshold</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
              Semantic similarity (SigLIP)
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
