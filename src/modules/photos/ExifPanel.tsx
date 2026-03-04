import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { getPreviewUrl, formatFileSize } from '@/lib/file-utils';
import { useExif } from './hooks/use-exif';
import { StarRating } from './StarRating';
import { api } from '@/services/api';
import { toast } from 'sonner';
import type { Photo } from '@/types/files';

interface ExifPanelProps {
  photo: Photo;
  onClose: () => void;
  onSaved?: () => void;
}

export function ExifPanel({ photo, onClose, onSaved }: ExifPanelProps) {
  const { data: exif, loading, error } = useExif(photo.id);
  const [filename, setFilename] = useState(photo.filename);
  const [saving, setSaving] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const cf = photo.custom_fields as Record<string, number | null> | null;
  const hasOverride = cf?.aesthetic_override != null;
  const aiScoreFloat = photo.metadata?.ai_aesthetic_score;
  const aiStars = aiScoreFloat != null
    ? (aiScoreFloat >= 0.8 ? 5 : aiScoreFloat >= 0.6 ? 4 : aiScoreFloat >= 0.4 ? 3 : aiScoreFloat >= 0.2 ? 2 : 1)
    : 0;
  const aestheticStars = hasOverride ? (cf!.aesthetic_override ?? 0) : aiStars;
  const hasAiData = photo.metadata?.ai_aesthetic_score != null || photo.metadata?.ai_description != null;

  const handleStarChange = async (value: number) => {
    try {
      await api.patch(`/files/${photo.id}`, { custom_fields: { aesthetic_override: value } });
      toast.success(`Rating set to ${value} star${value !== 1 ? 's' : ''}`);
      onSaved?.();
    } catch {
      toast.error('Failed to set rating');
    }
  };

  const handleStarReset = async () => {
    try {
      await api.patch(`/files/${photo.id}`, { custom_fields: { aesthetic_override: null } });
      toast.success('Rating reset to AI score');
      onSaved?.();
    } catch {
      toast.error('Failed to reset rating');
    }
  };

  useEffect(() => { setFilename(photo.filename); }, [photo.filename]);

  const handleSave = async () => {
    const updates: Record<string, unknown> = {};
    if (filename !== photo.filename) updates.filename = filename;
    if (Object.keys(updates).length === 0) return;

    setSaving(true);
    try {
      await api.patch(`/files/${photo.id}`, updates);
      toast.success('Photo updated');
      onSaved?.();
    } catch {
      toast.error('Failed to update photo');
    }
    setSaving(false);
  };

  const hasChanges = filename !== photo.filename;

  // Extract EXIF fields
  const exifImage = exif?.exif?.Image as Record<string, unknown> | undefined;
  const exifExif = exif?.exif?.Photo as Record<string, unknown> | undefined;
  const camera = exifImage?.Make
    ? `${exifImage.Make} ${exifImage.Model || ''}`.trim()
    : photo.metadata?.camera || null;
  const iso = exifExif?.ISOSpeedRatings ?? null;
  const aperture = exifExif?.FNumber ?? null;
  const focalLength = exifExif?.FocalLength ?? null;
  const exposureTime = exifExif?.ExposureTime ?? null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 400,
          maxWidth: '90vw',
          background: 'rgba(17, 17, 24, 0.5)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 41,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-sans)',
          animation: 'slideInRight 200ms ease',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
            Photo Details
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Preview */}
          <div style={{
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: 'var(--surface)',
          }}>
            <img
              src={getPreviewUrl(photo.id, 600)}
              alt={photo.filename}
              style={{ width: '100%', display: 'block' }}
            />
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Loading metadata...
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: 12, color: 'var(--error)', fontSize: '0.75rem' }}>
              {error}
            </div>
          )}

          {/* Editable fields */}
          <FieldGroup title="File">
            <EditableField label="Filename" value={filename} onChange={setFilename} />
            <ReadonlyField label="Size" value={formatFileSize(photo.size_bytes)} />
            <ReadonlyField label="Type" value={photo.mime_type} />
          </FieldGroup>

          {/* Image dimensions */}
          {exif && (
            <FieldGroup title="Image">
              <ReadonlyField label="Dimensions" value={
                exif.image.width && exif.image.height
                  ? `${exif.image.width} × ${exif.image.height}`
                  : '—'
              } />
              <ReadonlyField label="Format" value={exif.image.format ?? '—'} />
              <ReadonlyField label="Color space" value={exif.image.space ?? '—'} />
            </FieldGroup>
          )}

          {/* Camera info */}
          {(camera || iso || aperture) && (
            <FieldGroup title="Camera">
              {camera && <ReadonlyField label="Camera" value={camera} />}
              {iso && <ReadonlyField label="ISO" value={String(iso)} />}
              {aperture && <ReadonlyField label="Aperture" value={`f/${aperture}`} />}
              {focalLength && <ReadonlyField label="Focal length" value={`${focalLength}mm`} />}
              {exposureTime && <ReadonlyField label="Exposure" value={
                typeof exposureTime === 'number' && exposureTime < 1
                  ? `1/${Math.round(1 / exposureTime)}s`
                  : `${exposureTime}s`
              } />}
            </FieldGroup>
          )}

          {/* Location */}
          {photo.metadata?.gps && (
            <FieldGroup title="Location">
              <ReadonlyField label="Latitude" value={String(photo.metadata.gps.latitude)} />
              <ReadonlyField label="Longitude" value={String(photo.metadata.gps.longitude)} />
            </FieldGroup>
          )}

          {/* AI analysis */}
          {(hasAiData || hasOverride) && (
            <FieldGroup title="AI">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--amber)', minWidth: 90 }}>Rating</span>
                <StarRating
                  value={aestheticStars}
                  onChange={handleStarChange}
                  size={16}
                  isOverride={hasOverride}
                  onReset={hasOverride ? handleStarReset : undefined}
                />
              </div>
              {photo.metadata?.ai_description && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--amber)', minWidth: 90, paddingTop: 2 }}>Description</span>
                  <p style={{
                    margin: 0, fontSize: '0.8125rem', color: 'var(--text)',
                    lineHeight: 1.5, flex: 1,
                  }}>
                    {String(photo.metadata.ai_description)}
                  </p>
                </div>
              )}
            </FieldGroup>
          )}
        </div>

        {/* Footer */}
        {hasChanges && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
                fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              onMouseEnter={() => setHoveredBtn('save')}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 14px', background: saving ? 'var(--surface)' : 'var(--amber)',
                border: 'none', borderRadius: 'var(--radius-sm)',
                color: saving ? 'var(--text-muted)' : '#000',
                fontSize: '0.8125rem', fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
                opacity: hoveredBtn === 'save' && !saving ? 0.9 : 1,
              }}
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{
        margin: '0 0 8px', fontSize: '0.6875rem', fontWeight: 600,
        color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {title}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--amber)', minWidth: 90 }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--amber)', minWidth: 90 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 8px',
          fontSize: '0.8125rem',
          color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
          outline: 'none',
        }}
      />
    </div>
  );
}
