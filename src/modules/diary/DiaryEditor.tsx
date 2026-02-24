import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import UnderlineExt from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { ChevronLeft, Sparkles, X } from 'lucide-react';
import { NoteEditorToolbar } from '@/modules/notes/NoteEditorToolbar';
import { MoodSelector } from './MoodSelector';
import { DayContext } from './DayContext';
import { formatDateLong } from '@/lib/date-helpers';
import type { DiaryEntry, MoodLevel } from './types';

const lowlight = createLowlight(common);

const DIARY_PLACEHOLDERS = [
  'How was your day?',
  'What did you learn today?',
  'What are you grateful for?',
  'What was the highlight of your day?',
  'What challenged you today?',
];

interface DiaryEditorProps {
  entry: DiaryEntry;
  onUpdate: (id: string, input: Partial<DiaryEntry>) => Promise<DiaryEntry>;
  onBack?: () => void;
}

export function DiaryEditor({ entry, onUpdate, onBack }: DiaryEditorProps) {
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const isDirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Deterministic placeholder based on day of year
  const dayOfYear = Math.floor(
    (new Date(entry.entry_date + 'T12:00:00').getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const placeholder = DIARY_PLACEHOLDERS[Math.abs(dayOfYear) % DIARY_PLACEHOLDERS.length]!;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder }),
      UnderlineExt,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: entry.content || '',
    onUpdate: ({ editor: ed }) => {
      isDirtyRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        autoSave(ed.getHTML());
      }, 1500);
    },
  });

  // Reset editor when entry changes
  useEffect(() => {
    if (editor && !isDirtyRef.current) {
      const currentHTML = editor.getHTML();
      if (currentHTML !== entry.content) {
        editor.commands.setContent(entry.content || '');
      }
    }
  }, [entry.id, entry.content, editor]);

  // Reset dirty flag when entry changes
  useEffect(() => {
    isDirtyRef.current = false;
  }, [entry.id]);

  const autoSave = useCallback(async (content: string) => {
    setSaving(true);
    try {
      await onUpdate(entry.id, { content });
      isDirtyRef.current = false;
    } finally {
      setSaving(false);
    }
  }, [entry.id, onUpdate]);

  const handleMoodChange = async (mood: MoodLevel) => {
    await onUpdate(entry.id, { mood });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag || entry.tags.includes(tag)) { setTagInput(''); return; }
    onUpdate(entry.id, { tags: [...entry.tags, tag] });
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    onUpdate(entry.id, { tags: entry.tags.filter(t => t !== tag) });
  };

  const dateFormatted = formatDateLong(new Date(entry.entry_date + 'T12:00:00'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Back + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4, display: 'flex' }}
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            📅 {dateFormatted}
          </span>
          {saving && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Saving...
            </span>
          )}
        </div>

        {/* Mood + tags row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mood:</span>
          <MoodSelector value={entry.mood} onChange={handleMoodChange} />

          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

          {/* Tags */}
          {entry.tags.map(tag => (
            <span
              key={tag}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
              }}
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex' }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
            placeholder="Add tag"
            style={{
              width: 72,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
              outline: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
            }}
          />

          {/* Auto-generate placeholder */}
          <button
            disabled
            title="Pro feature — AI-generated diary entry"
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'not-allowed',
              opacity: 0.5,
            }}
          >
            <Sparkles size={12} />
            Auto-generate
            <span style={{ fontSize: '0.625rem', padding: '0 4px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
              Pro
            </span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      {editor && <NoteEditorToolbar editor={editor} />}

      {/* Editor */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {editor && <EditorContent editor={editor} />}

        {/* Day context */}
        <DayContext entryDate={entry.entry_date} />
      </div>
    </div>
  );
}
