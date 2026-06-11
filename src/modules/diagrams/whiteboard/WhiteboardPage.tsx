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
import { useParams, useNavigate } from 'react-router';
import { Excalidraw, serializeAsJSON, THEME, useHandleLibrary } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { toast } from 'sonner';
import { Save, Download } from 'lucide-react';
import { api } from '@/services/api';
import type { FileRecord } from '@/types/files';

const PARENT_FOLDER = '/Tools/Whiteboards';
const AUTOSAVE_MS = 5000;

// ─── Librerías por defecto + persistencia de la librería ─────────────
// Bundle con las 16 librerías más descargadas de libraries.excalidraw.com
// (asset estático ~6.7MB, lazy — solo se fetchea al abrir el whiteboard y el
// navegador lo cachea). Como NO cabe en localStorage, ahí solo persisten los
// items añadidos por el usuario y los ids de defaults que haya borrado.
const DEFAULT_LIBS_URL = '/whiteboard-libraries/default-libraries.json';
const USER_LIBRARY_KEY = 'claw-whiteboard-user-library';
const REMOVED_DEFAULTS_KEY = 'claw-whiteboard-removed-defaults';

interface LibraryItemLike {
  id: string;
  [key: string]: unknown;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

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
  const defaultLibIdsRef = useRef<Set<string>>(new Set());

  // Protocolo #addLibrary: el botón "Add to Excalidraw" de
  // libraries.excalidraw.com vuelve a esta URL con
  // `#addLibrary=<url>&token=…` — este hook oficial parsea el hash (al
  // montar y en hashchange), valida el dominio, pide confirmación y hace el
  // merge en la librería. La persistencia la recoge onLibraryChange.
  useHandleLibrary({ excalidrawAPI });

  // Cargar librería al montar el canvas: defaults (menos los borrados) + items
  // del usuario. updateLibrary reemplaza el contenido del panel de librería.
  useEffect(() => {
    if (!excalidrawAPI) return;
    let cancelled = false;
    (async () => {
      try {
        const userItems = readJson<LibraryItemLike[]>(USER_LIBRARY_KEY, []);
        const removed = new Set(readJson<string[]>(REMOVED_DEFAULTS_KEY, []));
        let defaults: LibraryItemLike[] = [];
        try {
          const res = await fetch(DEFAULT_LIBS_URL);
          if (res.ok) {
            const bundle = await res.json() as { libraryItems?: LibraryItemLike[] };
            defaults = (bundle.libraryItems ?? []).filter((i) => !removed.has(i.id));
          }
        } catch { /* sin defaults si el asset no carga */ }
        defaultLibIdsRef.current = new Set(defaults.map((i) => i.id));
        const items = [...defaults, ...userItems];
        if (!cancelled && items.length > 0) {
          // merge:true — no machacar items que el hook de #addLibrary haya
          // instalado mientras cargaba el bundle (dedupe por contenido).
          excalidrawAPI.updateLibrary({ libraryItems: items, merge: true });
        }
      } catch { /* la librería nunca debe romper el lienzo */ }
    })();
    return () => { cancelled = true; };
  }, [excalidrawAPI]);

  // Persistir cambios de librería: solo items del usuario (los defaults no
  // caben en localStorage) + el tombstone de defaults borrados.
  const handleLibraryChange = useCallback((items: readonly unknown[]) => {
    try {
      const defaults = defaultLibIdsRef.current;
      // Hasta que el bundle de defaults haya cargado no se puede separar
      // user-items de defaults — no persistir aún (evita falsos positivos).
      if (defaults.size === 0) return;
      const current = items as LibraryItemLike[];
      const currentIds = new Set(current.map((i) => i.id));
      // Default = pertenece al bundle (por id REAL — los .excalidrawlib v2
      // conservan sus ids originales, no llevan prefijo "default-").
      const userItems = current.filter((i) => !defaults.has(i.id));
      const removedNow = [...defaults].filter((id) => !currentIds.has(id));
      const removedStored = readJson<string[]>(REMOVED_DEFAULTS_KEY, []);
      const removed = Array.from(new Set([
        ...removedStored.filter((id) => !currentIds.has(id)), // re-añadidos salen del tombstone
        ...removedNow,
      ]));
      localStorage.setItem(USER_LIBRARY_KEY, JSON.stringify(userItems));
      localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(removed));
    } catch { /* cuota llena u otros — no romper el lienzo */ }
  }, []);

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

    // No crear un archivo para un lienzo vacío (p.ej. el onChange que dispara
    // updateLibrary al sembrar las librerías por defecto al abrir en blanco).
    if (!currentFileId && elements.length === 0 && !force) return;

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
        navigate(`/diagrams/whiteboard/${saved.id}`, { replace: true });
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
          onLibraryChange={handleLibraryChange}
          name={currentFilename || 'Whiteboard'}
        />
      </div>
    </div>
  );
}
