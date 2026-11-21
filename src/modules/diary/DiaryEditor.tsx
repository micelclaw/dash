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
import { ChevronLeft, Sparkles, Loader2 } from 'lucide-react';
import { TagInput } from '@/components/shared/TagInput';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { useCoNavigation } from '@/hooks/use-co-navigation';
import { NoteEditorToolbar } from '@/modules/notes/NoteEditorToolbar';
import { MoodSelector } from './MoodSelector';
import { RelatedItemsPanel } from '@/components/shared/RelatedItemsPanel';
import { SimilarContentPanel } from '@/components/shared/SimilarContentPanel';
import { GraphProximityPanel } from '@/components/shared/GraphProximityPanel';
import { useDiaryLinks } from './hooks/use-diary-links';
import { useDayContext } from './hooks/use-day-context';
import { DayContext } from './DayContext';
import type { DiaryEntry, MoodLevel } from './types';
import { useI18n } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { useSettingsStore } from '@/stores/settings.store';

const lowlight = createLowlight(common);

interface DiaryEditorProps {
  entry: DiaryEntry;
  onUpdate: (id: string, input: Partial<DiaryEntry>) => Promise<DiaryEntry>;
  onBack?: () => void;
}

export function DiaryEditor({ entry, onUpdate, onBack }: DiaryEditorProps) {
  const { t, locale } = useI18n();
  const general = useSettingsStore((s) => s.serverSettings?.general);
  useCoNavigation('diary', entry.id);
  const { links, loading: linksLoading } = useDiaryLinks(entry.id);
  const isPro = useAuthStore(s => s.user?.tier !== 'free');
  const dayCtx = useDayContext(entry.entry_date);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const isDirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Deterministic placeholder based on day of year
  const dayOfYear = Math.floor(
    (new Date(entry.entry_date + 'T12:00:00').getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const placeholder = [t('diary.prompt.day'), t('diary.prompt.learned'), t('diary.prompt.grateful'), t('diary.prompt.highlight'), t('diary.prompt.challenge')][Math.abs(dayOfYear) % 5]!;

  const editor = useEditor({
    extensions: [
      // StarterKit de TipTap 3.x ya incluye link y underline; los desactivamos
      // aquí para añadirlos configurados aparte sin colisión de nombres.
      StarterKit.configure({ codeBlock: false, link: false, underline: false }),
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
        // Si el editor se desmontó mientras el debounce estaba pendiente, su schema
        // ya es null y getHTML() petaría ("schema is null"). Salir en silencio.
        if (ed.isDestroyed) return;
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

  // Cancelar el autosave debounced al desmontar para que no dispare sobre un editor
  // ya destruido (causa del crash "schema is null").
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

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

  const handleTagsChange = (newTags: string[]) => {
    onUpdate(entry.id, { tags: newTags });
  };

  const photoCount = dayCtx?.photoCount ?? 0;
  const canGenerate = isPro && photoCount >= 3 && !generating;
  const isNarrativeDraft = (entry.custom_fields as any)?.source === 'auto_narrative' && entry.is_draft;

  const handleGenerateNarrative = useCallback(async () => {
    setGenerating(true);
    try {
      await api.post(`/diary/${entry.entry_date}/narrative`);
      toast.success(t('diary.narrativeGenerated'));
      onBack?.();
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'TIER_RESTRICTED') toast.error(t('diary.narrativePro'));
      else if (code === 'INSUFFICIENT_PHOTOS') toast.error(t('diary.needProcessedPhotos'));
      else if (code === 'NARRATIVE_EXISTS') toast.error(t('diary.narrativeExists'));
      else toast.error(err?.message || t('diary.generateFailed'));
    } finally {
      setGenerating(false);
    }
  }, [entry.entry_date, onBack, t]);

  const handleSaveNarrative = useCallback(async () => {
    await onUpdate(entry.id, { is_draft: false });
    toast.success(t('diary.narrativeSaved'));
  }, [entry.id, onUpdate, t]);

  const handleDiscardNarrative = useCallback(async () => {
    try {
      await api.delete(`/diary/${entry.id}`);
      toast.success(t('diary.narrativeDiscarded'));
      onBack?.();
    } catch {
      toast.error(t('diary.discardFailed'));
    }
  }, [entry.id, onBack, t]);

  const handleRegenerateNarrative = useCallback(async () => {
    try {
      await api.delete(`/diary/${entry.id}`);
    } catch { /* ignore */ }
    await handleGenerateNarrative();
  }, [entry.id, handleGenerateNarrative]);

  const dateFormatted = formatDate(new Date(entry.entry_date + 'T12:00:00'), locale, general);

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
              {t('diary.saving')}
            </span>
          )}
        </div>

        {/* Mood + tags row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('diary.mood')}</span>
          <MoodSelector value={entry.mood} onChange={handleMoodChange} />

          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

          {/* Tags unificados */}
          <TagInput tags={entry.tags} onChange={handleTagsChange} />

          {/* Auto-generate narrative */}
          <button
            disabled={!canGenerate}
            onClick={handleGenerateNarrative}
            title={!isPro ? t('diary.proFeature') : photoCount < 3 ? t('diary.needPhotos') : t('diary.generateNarrative')}
            aria-label={t('diary.generateNarrative')}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: canGenerate ? 'var(--amber)' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              opacity: canGenerate ? 1 : 0.5,
              transition: 'color var(--transition-fast), opacity var(--transition-fast)',
            }}
          >
            {generating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
            {generating ? t('diary.generating') : t('diary.generate')}
            {!isPro && (
              <span style={{ fontSize: '0.625rem', padding: '0 4px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                Pro
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Narrative draft banner */}
      {isNarrativeDraft && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          background: 'rgba(245,158,11,0.08)',
          borderBottom: '1px solid rgba(245,158,11,0.2)',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          flexShrink: 0,
        }}>
          <Sparkles size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ color: 'var(--text-dim)', flex: 1 }}>{t('diary.draftNotice')}</span>
          <button
            onClick={handleSaveNarrative}
            style={{
              padding: '3px 10px', background: 'var(--amber)', color: '#000',
              border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)', cursor: 'pointer', fontWeight: 500,
            }}
          >{t('diary.save')}</button>
          <button
            onClick={handleDiscardNarrative}
            style={{
              padding: '3px 10px', background: 'transparent', color: 'var(--text-dim)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >{t('diary.discard')}</button>
          <button
            onClick={handleRegenerateNarrative}
            style={{
              padding: '3px 10px', background: 'transparent', color: 'var(--text-dim)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
              fontFamily: 'var(--font-sans)', cursor: 'pointer',
            }}
          >{t('diary.regenerate')}</button>
        </div>
      )}

      {/* Toolbar */}
      {editor && <NoteEditorToolbar editor={editor} />}

      {/* Editor */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {editor && <EditorContent editor={editor} />}
      </div>

      {/* Day context + Intelligence panels */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <DayContext entryDate={entry.entry_date} />
        <RelatedItemsPanel links={links} loading={linksLoading} onNavigate={onBack} sourceType="diary_entry" sourceId={entry.id} />
        <SimilarContentPanel sourceType="diary_entry" sourceId={entry.id} />
        <GraphProximityPanel sourceType="diary_entry" sourceId={entry.id} />
      </div>
    </div>
  );
}
