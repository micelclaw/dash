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
 * Transferir la propiedad de un tablero a otro usuario (owner-only).
 * Extraído del antiguo ShareBoardModal al unificar el compartir en
 * EntityShareModal — el transfer es una acción específica del board, no
 * una forma de compartir. Selector vía /shares/recipients (no /admin/users:
 * un owner no-admin también puede transferir).
 */

import { useEffect, useState } from 'react';
import { X, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useProjectsStore } from '@/stores/projects.store';
import { useEscapeToClose } from '@/hooks/use-escape-to-close';
import { listShareRecipients, type ShareRecipient } from '@/services/shares.service';

export function TransferBoardModal({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const fetchFullBoard = useProjectsStore((s) => s.fetchFullBoard);
  const [recipients, setRecipients] = useState<ShareRecipient[]>([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  useEscapeToClose(onClose, { ignoreWhenTyping: false });

  useEffect(() => {
    listShareRecipients().then(setRecipients).catch(() => setRecipients([]));
  }, []);

  const handleTransfer = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.post(`/projects/boards/${boardId}/transfer`, { new_owner_id: target });
      toast.success('Propiedad transferida');
      void fetchFullBoard(boardId);
      onClose();
    } catch (err) {
      toast.error((err as Error)?.message || 'No se pudo transferir la propiedad');
    }
    setBusy(false);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 420, background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,.4)', zIndex: 101,
        fontFamily: 'var(--font-sans)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Crown size={16} style={{ color: 'var(--amber)' }} /> Transferir propiedad
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Transfiere este tablero a otro usuario. Tú conservarás acceso de edición.
          </p>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
              padding: '6px 8px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)',
              outline: 'none', colorScheme: 'dark',
            }}
          >
            <option value="">Selecciona el nuevo propietario…</option>
            {recipients.map(u => (
              <option key={u.id} value={u.id}>
                {u.display_name || u.email}{u.email && u.display_name ? ` (${u.email})` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => void handleTransfer()}
            disabled={!target || busy}
            style={{
              alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: 'var(--error)', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: !target || busy ? 'default' : 'pointer', opacity: !target || busy ? 0.4 : 1,
            }}
          >
            {busy ? 'Transfiriendo…' : 'Transferir'}
          </button>
        </div>
      </div>
    </>
  );
}
