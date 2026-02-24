import { useState } from 'react';
import { X, Calendar, Globe, Smartphone, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface AddCalendarModalProps {
  open: boolean;
  onClose: () => void;
}

function GoogleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function SynologyIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#e87e04">
      <circle cx="12" cy="12" r="10" fill="none" stroke="#e87e04" strokeWidth="2"/>
      <text x="12" y="16" textAnchor="middle" fill="#e87e04" fontSize="10" fontWeight="bold">S</text>
    </svg>
  );
}

function AppleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#a2aaad">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83"/>
    </svg>
  );
}

interface Provider {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
}

const PROVIDERS: Provider[] = [
  { id: 'google', name: 'Google Calendar', icon: <GoogleIcon size={24} />, color: '#4285f4' },
  { id: 'synology', name: 'Synology Calendar', icon: <SynologyIcon size={24} />, color: '#e87e04' },
  { id: 'apple', name: 'Apple Calendar', icon: <AppleIcon size={24} />, color: '#a2aaad' },
  { id: 'outlook', name: 'Outlook', icon: <Calendar size={24} style={{ color: '#0078d4' }} />, color: '#0078d4' },
  { id: 'caldav', name: 'CalDAV', icon: <Globe size={24} style={{ color: 'var(--text-dim)' }} />, color: 'var(--text-dim)' },
  { id: 'custom', name: 'Custom', icon: <Plus size={24} style={{ color: 'var(--amber)' }} />, color: 'var(--amber)' },
];

export function AddCalendarModal({ open, onClose }: AddCalendarModalProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 420,
          maxWidth: '90vw',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            Add calendar
          </h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Provider grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          padding: '16px 20px',
        }}>
          {PROVIDERS.map(provider => {
            const isHovered = hoveredId === provider.id;
            return (
              <button
                key={provider.id}
                onClick={() => {
                  toast.info(`${provider.name} integration — coming soon`);
                  onClose();
                }}
                onMouseEnter={() => setHoveredId(provider.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: 20,
                  background: isHovered ? 'var(--surface-hover)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {provider.icon}
                <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
                  {provider.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
