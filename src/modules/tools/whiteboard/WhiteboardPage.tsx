import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Excalidraw, serializeAsJSON, THEME } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { toast } from 'sonner';
import { Save, Download } from 'lucide-react';
import { api } from '@/services/api';
import type { FileRecord } from '@/types/files';

const PARENT_FOLDER = '/Tools/Whiteboards';
const AUTOSAVE_MS = 5000;

export function Component() {
  const { fileId } = useParams<{ fileId?: string }>();
  const navigate = useNavigate();

  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [initialData, setInitialData] = useState<any>(undefined);
  const [loading, setLoading] = useState(!!fileId);
  const [currentFileId, setCurrentFileId] = useState<string | null>(fileId ?? null);
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  // Load existing whiteboard from Drive
  useEffect(() => {
    if (!fileId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const meta = await api.get<{ data: FileRecord }>(`/files/${fileId}`);
        setCurrentFilename(meta.data.filename);

        const token = (await import('@/stores/auth.store')).useAuthStore.getState().tokens?.accessToken;
        const base = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${base}/api/v1/files/${fileId}/download`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Download failed');
        const json = await res.json();
        setInitialData({
          elements: json.elements || [],
          appState: { ...(json.appState || {}), theme: 'dark' },
          files: json.files || undefined,
        });
        lastSavedRef.current = JSON.stringify({ elements: json.elements || [], files: json.files });
      } catch {
        toast.error('Failed to load whiteboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [fileId]);

  // Save whiteboard to Drive
  const saveToFile = useCallback(async (force?: boolean) => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();

    const serialized = serializeAsJSON(elements, appState, files, 'local');
    // Skip save if nothing changed
    const contentKey = JSON.stringify({ elements, files });
    if (!force && contentKey === lastSavedRef.current) return;

    setSaving(true);
    try {
      const blob = new Blob([serialized], { type: 'application/json' });
      const filename = currentFilename || `Whiteboard ${new Date().toISOString().slice(0, 16).replace('T', ' ')}.excalidraw`;

      if (currentFileId) {
        // Update existing file content
        const file = new File([blob], filename, { type: 'application/json' });
        const formData = new FormData();
        formData.append('file', file);
        await api.upload<{ data: FileRecord }>(`/files/${currentFileId}/content`, formData, 'PUT');
      } else {
        // Create new file
        const file = new File([blob], filename, { type: 'application/json' });
        const formData = new FormData();
        formData.append('file', file);
        formData.append('parent_folder', PARENT_FOLDER);
        const res = await api.upload<{ data: FileRecord }>('/files/upload', formData);
        const saved = res.data;
        setCurrentFileId(saved.id);
        setCurrentFilename(saved.filename);
        navigate(`/tools/whiteboard/${saved.id}`, { replace: true });
      }

      lastSavedRef.current = contentKey;
      setDirty(false);
    } catch {
      toast.error('Failed to save whiteboard');
    } finally {
      setSaving(false);
    }
  }, [excalidrawAPI, currentFileId, currentFilename, navigate]);

  // Auto-save debounced
  const handleChange = useCallback(() => {
    setDirty(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToFile();
    }, AUTOSAVE_MS);
  }, [saveToFile]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Export as PNG
  const handleExportPng = useCallback(async () => {
    if (!excalidrawAPI) return;
    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements: excalidrawAPI.getSceneElements(),
        appState: { ...excalidrawAPI.getAppState(), exportWithDarkMode: true },
        files: excalidrawAPI.getFiles(),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (currentFilename || 'whiteboard').replace('.excalidraw', '') + '.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  }, [excalidrawAPI, currentFilename]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem',
      }}>
        Loading whiteboard...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{
          fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
        }}>
          {currentFilename || 'New Whiteboard'}
          {dirty && <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>• unsaved</span>}
          {saving && <span style={{ color: 'var(--amber)', marginLeft: 6 }}>saving...</span>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => saveToFile(true)}
            title="Save"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', fontSize: '0.75rem', fontWeight: 500,
              background: 'var(--amber)', color: '#000', border: 'none',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Save size={12} /> Save
          </button>
          <button
            onClick={handleExportPng}
            title="Export PNG"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', fontSize: '0.75rem', fontWeight: 500,
              background: 'transparent', color: 'var(--text-dim)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Download size={12} /> PNG
          </button>
        </div>
      </div>

      {/* Excalidraw Canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          theme={THEME.DARK}
          initialData={initialData ?? undefined}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          onChange={handleChange}
          name={currentFilename || 'Whiteboard'}
        />
      </div>
    </div>
  );
}
