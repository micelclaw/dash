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

// Inline-styles var(--*) para combinar con el resto del módulo Storage
// (que no usa Tailwind). Misma lógica que antes; solo cambia el estilado.

import { useState, useEffect, useCallback } from 'react';
import { Copy, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { formatFileSize } from '@/lib/file-utils';

// Guarda contra valores nulos/undefined/NaN: formatFileSize(undefined)
// devuelve "NaN undefined". Si el byte-count no es un número finito,
// mostramos un guion en vez de la cadena rota.
function safeSize(bytes: number | null | undefined): string {
  if (bytes == null || typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—';
  return formatFileSize(bytes);
}

interface DuplicateFile {
  id: string;
  filename: string;
  filepath: string;
  size_bytes: number;
  updated_at: string;
}

interface DuplicateGroup {
  checksum: string;
  size_bytes: number;
  files: DuplicateFile[];
}

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: 16,
};

export function FileDuplicatesCard() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: DuplicateGroup[] }>('/files/duplicates?limit=20');
      setGroups(res.data ?? []);
    } catch {
      // optional
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (fileId: string) => {
    setDeleting(fileId);
    try {
      await api.delete(`/files/${fileId}`);
      toast.success('Archivo eliminado');
      setGroups(prev => prev.map(g => ({
        ...g,
        files: (Array.isArray(g.files) ? g.files : []).filter(f => f.id !== fileId),
      })).filter(g => (Array.isArray(g.files) ? g.files.length : 0) > 1));
    } catch {
      toast.error('No se pudo eliminar el archivo');
    }
    setDeleting(null);
  };

  if (loading) return null;
  if (groups.length === 0) return null;

  const totalWaste = groups.reduce((sum, g) => {
    const fileCount = Array.isArray(g.files) ? g.files.length : 0;
    const size = Number.isFinite(g.size_bytes) ? g.size_bytes : 0;
    return sum + size * Math.max(0, fileCount - 1);
  }, 0);

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{
          display: 'flex', alignItems: 'center', gap: 8, margin: 0,
          fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)',
        }}>
          <Copy size={14} />
          Archivos duplicados
          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--warning, #f59e0b)' }}>
            {safeSize(totalWaste)} recuperables
          </span>
        </h3>
        <button
          onClick={load}
          title="Recargar"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 6,
            background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover, var(--card))'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(group => {
          const files = Array.isArray(group.files) ? group.files : [];
          return (
            <div key={group.checksum} style={{
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              background: 'var(--bg, var(--card))', padding: 12,
            }}>
              <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: 8 }}>
                {files.length} copias · {safeSize(group.size_bytes)} cada una
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {files.map((file, i) => (
                  <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
                    <span style={{
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: 'var(--text)', fontFamily: 'var(--font-sans)',
                    }} title={file.filepath}>
                      {file.filepath}
                    </span>
                    {i > 0 && (
                      <button
                        onClick={() => handleDelete(file.id)}
                        disabled={deleting === file.id}
                        title="Eliminar esta copia"
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 4,
                          background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-muted)', cursor: deleting === file.id ? 'default' : 'pointer',
                          flexShrink: 0, opacity: deleting === file.id ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--error, #ef4444) 12%, transparent)'; e.currentTarget.style.color = 'var(--error, #ef4444)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
