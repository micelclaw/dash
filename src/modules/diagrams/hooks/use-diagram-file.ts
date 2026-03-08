import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/services/api';
import { useDiagramsStore } from '@/stores/diagrams.store';
import type { DiagramFile } from '../types';
import type { FileRecord } from '@/types/files';
import type { ApiResponse } from '@/types/api';

const DIAGRAM_MIME = 'application/vnd.claw.diagram+json';
const AUTO_SAVE_DELAY = 5000;

export function useDiagramFile(fileId?: string) {
  const navigate = useNavigate();
  const loadDiagram = useDiagramsStore((s) => s.loadDiagram);
  const reset = useDiagramsStore((s) => s.reset);
  const toDiagramFile = useDiagramsStore((s) => s.toDiagramFile);
  const isDirty = useDiagramsStore((s) => s.isDirty);
  const saveStatus = useDiagramsStore((s) => s.saveStatus);
  const setSaveStatus = useDiagramsStore((s) => s.setSaveStatus);
  const setCurrentFileId = useDiagramsStore((s) => s.setCurrentFileId);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);

  // ─── Load diagram from file ──────────────────────────

  useEffect(() => {
    if (!fileId || fileId === 'new') {
      reset();
      return;
    }

    // Don't reload if already loaded
    const currentId = useDiagramsStore.getState().currentFileId;
    if (currentId === fileId) return;

    let cancelled = false;
    loadingRef.current = true;

    (async () => {
      try {
        const res = await api.get<{
          data: { content_text: string; file_id: string; filename: string };
        }>(`/files/${fileId}/content`);
        if (cancelled) return;
        const diagram: DiagramFile = JSON.parse(res.data.content_text);
        loadDiagram(diagram, fileId);
      } catch {
        if (!cancelled) {
          // File not found or parse error — redirect to launcher
          navigate('/diagrams', { replace: true });
        }
      } finally {
        loadingRef.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [fileId, loadDiagram, reset, navigate]);

  // ─── Save diagram ────────────────────────────────────

  const saveDiagram = useCallback(async () => {
    const state = useDiagramsStore.getState();
    if (!state.isDirty && state.saveStatus !== 'idle') return;

    setSaveStatus('saving');

    try {
      const diagram = state.toDiagramFile();
      const json = JSON.stringify(diagram, null, 2);
      const blob = new Blob([json], { type: DIAGRAM_MIME });

      if (state.currentFileId) {
        // Update existing file content
        const formData = new FormData();
        formData.append('file', blob, `${diagram.title || 'Untitled'}.diagram`);
        await api.upload(`/files/${state.currentFileId}/content`, formData, 'PUT');

        // Also update filename if title changed
        await api.patch(`/files/${state.currentFileId}`, {
          filename: `${diagram.title || 'Untitled'}.diagram`,
        });
      } else {
        // Create new file
        const formData = new FormData();
        formData.append('file', blob, `${diagram.title || 'Untitled'}.diagram`);
        formData.append('parent_folder', '/Diagrams/');
        const res = await api.upload<ApiResponse<FileRecord>>('/files/upload', formData);
        const newFileId = res.data.id;
        setCurrentFileId(newFileId);

        // Navigate to the new file URL (replace 'new' in URL)
        navigate(`/diagrams/${newFileId}`, { replace: true });
      }

      useDiagramsStore.setState({ isDirty: false });
      setSaveStatus('saved');

      // Reset status after 2s
      setTimeout(() => {
        const current = useDiagramsStore.getState().saveStatus;
        if (current === 'saved') setSaveStatus('idle');
      }, 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [setSaveStatus, setCurrentFileId, navigate]);

  // ─── Auto-save (respects settings.autoSave) ──────────

  const autoSaveEnabled = useDiagramsStore((s) => s.settings.autoSave);

  useEffect(() => {
    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
      autoSaveRef.current = null;
    }

    if (autoSaveEnabled && isDirty && !loadingRef.current) {
      autoSaveRef.current = setTimeout(() => {
        saveDiagram();
      }, AUTO_SAVE_DELAY);
    }

    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [isDirty, saveDiagram, autoSaveEnabled]);

  // ─── Before unload warning ───────────────────────────

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useDiagramsStore.getState().isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return { saveDiagram, saveStatus };
}
