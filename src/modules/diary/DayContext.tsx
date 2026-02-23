import { useNavigate } from 'react-router';
import { Calendar, StickyNote, Mail } from 'lucide-react';
import { useDayContext } from './hooks/use-day-context';
import { formatTime } from '@/lib/date-helpers';

interface DayContextProps {
  entryDate: string;
}

const itemStyle: React.CSSProperties = {
  cursor: 'pointer',
  transition: 'color var(--transition-fast)',
};

export function DayContext({ entryDate }: DayContextProps) {
  const context = useDayContext(entryDate);
  const navigate = useNavigate();

  if (!context) return null;
  if (context.events.length === 0 && context.notes.length === 0 && context.emailCount === 0) return null;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{
        fontSize: '0.6875rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 8,
      }}>
        Day context
      </div>

      {context.events.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <Calendar size={14} style={{ color: 'var(--mod-calendar)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap', gap: '0 4px' }}>
            {context.events.map((e, i) => (
              <span
                key={e.id}
                onClick={() => navigate(`/calendar?id=${e.id}`)}
                style={itemStyle}
                onMouseEnter={ev => { ev.currentTarget.style.color = 'var(--mod-calendar)'; }}
                onMouseLeave={ev => { ev.currentTarget.style.color = 'var(--text-dim)'; }}
              >
                {i > 0 && ', '}
                {e.title}
                {e.start_at && ` (${formatTime(new Date(e.start_at))})`}
              </span>
            ))}
          </div>
        </div>
      )}

      {context.notes.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <StickyNote size={14} style={{ color: 'var(--mod-notes)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap', gap: '0 4px' }}>
            {context.notes.filter(n => n.title).map((n, i) => (
              <span
                key={n.id}
                onClick={() => navigate(`/notes?id=${n.id}`)}
                style={itemStyle}
                onMouseEnter={ev => { ev.currentTarget.style.color = 'var(--mod-notes)'; }}
                onMouseLeave={ev => { ev.currentTarget.style.color = 'var(--text-dim)'; }}
              >
                {i > 0 && ', '}
                &quot;{n.title}&quot;
              </span>
            ))}
            {context.notes.filter(n => !n.title).length > 0 && (
              <span> + {context.notes.filter(n => !n.title).length} untitled</span>
            )}
          </div>
        </div>
      )}

      {context.emailCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={14} style={{ color: 'var(--mod-mail)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            {context.emailCount} email{context.emailCount !== 1 ? 's' : ''} received
          </span>
        </div>
      )}
    </div>
  );
}
