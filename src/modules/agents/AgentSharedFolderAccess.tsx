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
import { Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface Props { agentId: string; agentName: string; }

/**
 * Toggle opt-in del acceso de un agente a la carpeta compartida
 * `/user/workspaces/shared`. Persiste en managed_agents.permissions y re-mintea
 * el runtime token (scope sintético `shared-workspace:rw`) en caliente.
 */
export function AgentSharedFolderAccess({ agentId, agentName }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<{ data: { enabled: boolean } }>(`/managed-agents/${agentId}/shared-folder-access`)
      .then(r => { if (alive) setEnabled(r.data.enabled); })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, [agentId]);

  const toggle = async (next: boolean) => {
    setSaving(true);
    try {
      await api.patch(`/managed-agents/${agentId}/shared-folder-access`, { enabled: next });
      setEnabled(next);
      toast.success(`Carpeta compartida ${next ? 'activada' : 'desactivada'} para ${agentName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fallo al cambiar el acceso');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--surface)' }}>
      <Share2 size={16} color="var(--amber)" style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>Acceso a carpeta compartida</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>
          Permite a <b>{agentName}</b> leer/escribir en <code>/user/workspaces/shared</code> — la carpeta común
          de tus agentes (p.ej. para intercambiar ficheros en una delegación). Opt-in; desactivado da 403.
        </div>
      </div>
      <button
        role="switch" aria-checked={enabled ?? false} disabled={enabled === null || saving}
        onClick={() => toggle(!enabled)}
        style={{
          width: 42, height: 23, borderRadius: 999, border: '1px solid var(--border)',
          background: enabled ? 'var(--success)' : 'var(--border)', position: 'relative',
          cursor: enabled === null || saving ? 'default' : 'pointer', transition: 'var(--transition-fast)', padding: 0, flexShrink: 0, marginTop: 2,
        }}
      >
        <span style={{ position: 'absolute', top: 2, left: enabled ? 21 : 2, width: 17, height: 17, borderRadius: 999, background: '#fff', transition: 'var(--transition-fast)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(enabled === null || saving) ? <Loader2 size={11} className="animate-spin" color="#333" /> : null}
        </span>
      </button>
    </div>
  );
}
