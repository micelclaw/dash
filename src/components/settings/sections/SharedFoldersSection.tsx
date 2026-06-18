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

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, FolderOpen } from 'lucide-react';
import { SettingSection } from '../SettingSection';
import {
  listSharedFolders, createSharedFolder, deleteSharedFolder, type SharedFolder,
} from '@/services/shared-folders.service';

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '0.8125rem', background: 'var(--bg-input, var(--bg))',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)',
};
const btnPrimary: React.CSSProperties = {
  padding: '7px 14px', fontSize: '0.8125rem', fontWeight: 500, background: 'var(--amber)',
  color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '6px 10px', fontSize: '0.8125rem', background: 'none', color: 'var(--text-dim)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
};

export function SharedFoldersSection() {
  const [folders, setFolders] = useState<SharedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recycle, setRecycle] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    listSharedFolders().then(setFolders).catch((e) => toast.error((e as Error).message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await createSharedFolder({ name: name.trim(), description: description.trim() || undefined, recycle_bin: recycle });
      toast.success(`Carpeta "${name}" creada`);
      setName(''); setDescription(''); setRecycle(true); setCreating(false);
      load();
    } catch (e) { toast.error((e as Error).message || 'No se pudo crear'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (f: SharedFolder) => {
    if (!confirm(`¿Eliminar la carpeta compartida "${f.name}"? (los datos en disco se conservan)`)) return;
    try { await deleteSharedFolder(f.id); toast.success('Carpeta eliminada'); load(); }
    catch (e) { toast.error((e as Error).message || 'No se pudo eliminar'); }
  };

  return (
    <SettingSection
      title="Carpetas compartidas"
      description="Carpetas accesibles por varios usuarios. Los permisos por usuario (Sin acceso / Solo lectura / Lectura-escritura) se asignan en Usuarios → Editar → Permisos."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!creating && (
          <button style={{ ...btnPrimary, alignSelf: 'flex-start', display: 'flex', gap: 6, alignItems: 'center' }} onClick={() => setCreating(true)}>
            <Plus size={15} /> Nueva carpeta
          </button>
        )}
        {creating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <input style={input} placeholder="Nombre (p.ej. Documentos)" value={name} onChange={(e) => setName(e.target.value)} />
            <input style={input} placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              <input type="checkbox" checked={recycle} onChange={(e) => setRecycle(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
              Habilitar papelera de reciclaje
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => setCreating(false)}>Cancelar</button>
              <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={handleCreate} disabled={saving}>
                {saving ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        )}

        {loading && <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Cargando…</div>}
        {!loading && folders.length === 0 && <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>Aún no hay carpetas compartidas.</div>}
        {!loading && folders.map((f) => (
          <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <FolderOpen size={16} style={{ color: 'var(--amber)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{f.name}</div>
              {f.description && <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{f.description}</div>}
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>\\host\{f.slug}</div>
            </div>
            <button style={{ ...btnGhost, padding: 6 }} title="Eliminar" onClick={() => handleDelete(f)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </SettingSection>
  );
}
