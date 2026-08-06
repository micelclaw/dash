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

/**
 * Elegir un fichero que YA está en el Drive, frente a subir uno del disco.
 *
 * No existía nada parecido: `FolderPicker` navega CARPETAS para elegir destino
 * (no ficheros) y `RelateEntityModal` busca entidades para enlazarlas, no para
 * devolver un id. Así que esto es una composición nueva sobre el mismo endpoint
 * que ya usa el Drive (`GET /files?parent_folder=…`), con `FileThumbnail` para
 * las miniaturas y el `?token=` de `getPreviewUrl` por debajo.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, ArrowUp, Search, Folder } from 'lucide-react';
import { api } from '@/services/api';
import { FileThumbnail } from '@/components/shared/FileThumbnail';
import { useEscapeToClose } from '@/hooks/use-escape-to-close';
import type { FileRecord } from '@/types/files';

const RAIZ = '/drive/';

function tamano(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DrivePickerModal({
  onClose,
  onPick,
  soloImagenes = false,
  titulo = 'Elegir del Drive',
}: {
  onClose: () => void;
  onPick: (files: FileRecord[]) => void;
  /** Para la portada: solo tiene sentido una imagen. */
  soloImagenes?: boolean;
  titulo?: string;
}) {
  const [ruta, setRuta] = useState(RAIZ);
  const [items, setItems] = useState<FileRecord[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());

  useEscapeToClose(onClose);

  const cargar = useCallback(async (destino: string, q: string) => {
    setCargando(true);
    try {
      // Con búsqueda se busca en TODO el Drive; sin ella, la carpeta actual.
      const url = q.trim()
        ? `/files?search=${encodeURIComponent(q.trim())}&limit=100`
        : `/files?parent_folder=${encodeURIComponent(destino)}&limit=200`;
      const res = await api.get<{ data: FileRecord[] }>(url);
      const filas = (res.data ?? []).filter((f) =>
        f.is_directory || !soloImagenes || f.mime_type?.startsWith('image/'));
      // Carpetas primero, luego por nombre.
      filas.sort((a, b) => (Number(b.is_directory) - Number(a.is_directory)) || a.filename.localeCompare(b.filename));
      setItems(filas);
    } catch {
      setItems([]);
    } finally { setCargando(false); }
  }, [soloImagenes]);

  useEffect(() => { void cargar(ruta, busqueda); }, [ruta, busqueda, cargar]);

  const subir = () => {
    if (ruta === RAIZ) return;
    const partes = ruta.replace(/\/$/, '').split('/');
    partes.pop();
    setRuta(`${partes.join('/')}/`);
  };

  function alternar(f: FileRecord) {
    if (soloImagenes) { onPick([f]); return; }   // una imagen: elegir y cerrar
    setElegidos((s) => {
      const n = new Set(s);
      n.has(f.id) ? n.delete(f.id) : n.add(f.id);
      return n;
    });
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{ width: 560, maxWidth: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>{titulo}</span>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
          <Search size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en el Drive…"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)' }}
          />
          {!busqueda && ruta !== RAIZ && (
            <button onClick={subir} title="Subir un nivel" style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex' }}>
              <ArrowUp size={14} />
            </button>
          )}
        </div>

        {!busqueda && (
          <div style={{ padding: '6px 14px', color: 'var(--text-dim)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
            {ruta}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {cargando ? (
            <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: 13 }}>Cargando…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: 13 }}>
              {busqueda ? 'Nada coincide.' : soloImagenes ? 'No hay imágenes en esta carpeta.' : 'Carpeta vacía.'}
            </div>
          ) : (
            items.map((f) => {
              const marcado = elegidos.has(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => (f.is_directory ? (setBusqueda(''), setRuta(`${f.filepath.replace(/\/$/, '')}/`)) : alternar(f))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '6px 8px', borderRadius: 'var(--radius-sm, 6px)', cursor: 'pointer',
                    background: marcado ? 'var(--card-hover, var(--card))' : 'transparent',
                    border: marcado ? '1px solid var(--amber)' : '1px solid transparent',
                    textAlign: 'left', fontFamily: 'var(--font-sans)',
                  }}
                >
                  <div style={{ width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {f.is_directory
                      ? <Folder size={16} style={{ color: 'var(--text-dim)' }} />
                      : <FileThumbnail file={f} width={64} fit="cover" iconSize={16} />}
                  </div>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.filename}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11, flexShrink: 0 }}>
                    {f.is_directory ? '' : tamano(f.size_bytes)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {!soloImagenes && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
            <button onClick={onClose} style={{ padding: '5px 12px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }}>
              Cancelar
            </button>
            <button
              onClick={() => onPick(items.filter((f) => elegidos.has(f.id)))}
              disabled={elegidos.size === 0}
              style={{ padding: '5px 12px', borderRadius: 6, background: elegidos.size ? 'var(--amber)' : 'var(--border)', border: 'none', color: elegidos.size ? '#06060a' : 'var(--text-dim)', cursor: elegidos.size ? 'pointer' : 'default', fontSize: 12, fontWeight: 500 }}
            >
              Elegir{elegidos.size > 0 ? ` (${elegidos.size})` : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
