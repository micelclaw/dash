import { MOOD_CONFIG, type MoodLevel } from './types';
import { getPreview } from '@/lib/text';

interface DiaryTimelineItemProps {
  entryDate: string;
  content: string;
  mood: MoodLevel | null;
  selected: boolean;
  onClick: () => void;
}

export function DiaryTimelineItem({ entryDate, content, mood, selected, onClick }: DiaryTimelineItemProps) {
  const d = new Date(entryDate + 'T12:00:00');
  const dayNum = d.getDate();
  const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const moodConfig = mood ? MOOD_CONFIG[mood] : null;
  const preview = getPreview(content, 'html');

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        width: '100%',
        padding: '8px 12px',
        background: selected ? 'var(--surface-hover)' : 'transparent',
        border: 'none',
        borderLeft: selected ? '2px solid var(--amber)' : '2px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Date column */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 36,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
          {dayNum}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          {dayName}
        </span>
      </div>

      {/* Mood emoji */}
      <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>
        {moodConfig ? moodConfig.emoji : '·'}
      </span>

      {/* Preview */}
      <span style={{
        fontSize: '0.8125rem',
        color: 'var(--text-dim)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        marginTop: 2,
      }}>
        {preview || 'Empty entry'}
      </span>
    </button>
  );
}
