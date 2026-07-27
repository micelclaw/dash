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

// ─── Desconectar: decir la verdad de lo que se lleva, y ofrecer la copia ─────
//
// Antes esto era un `confirm()` del navegador que decía «This will stop syncing».
// Era verdad a medias por partida doble: no contaba cuántos datos hay dentro, y
// desconectar tampoco los retiraba — se quedaban huérfanos para siempre.
//
// La política, decidida con el usuario (playbook §A.7): desconectar BORRA lo que
// trajo ese connector, siempre, y en ese momento —y solo en ese momento— se
// ofrece descargar una copia. El criterio I8-3 es tajante: si el export no está,
// la desconexión no está terminada. Por eso el botón de descargar está ARRIBA del
// de desconectar, y no al revés.

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { downloadAuthed } from '@/lib/file-download';
import * as syncSvc from '@/services/sync.service';

interface DisconnectDialogProps {
  connectorId: string;
  label: string;
  open: boolean;
  onClose: () => void;
  onDisconnected: () => void;
}

const DOMINIO_ES: Record<string, string> = {
  mail: 'correos',
  calendar: 'eventos de calendario',
  contacts: 'contactos',
};

export function DisconnectDialog({ connectorId, label, open, onClose, onDisconnected }: DisconnectDialogProps) {
  const [resumen, setResumen] = useState<syncSvc.ConnectorDataSummary | null>(null);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [descargada, setDescargada] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCargando(true);
    setDescargada(false);
    syncSvc.getConnectorDataSummary(connectorId)
      .then(setResumen)
      .catch(() => setResumen(null))
      .finally(() => setCargando(false));
  }, [open, connectorId]);

  const descargar = useCallback(async () => {
    setDescargando(true);
    try {
      await downloadAuthed(
        `/api/v1/sync/connectors/${connectorId}/export`,
        `micelclaw-${label.toLowerCase().replace(/\s+/g, '-')}.json`,
      );
      setDescargada(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo descargar la copia');
    } finally {
      setDescargando(false);
    }
  }, [connectorId, label]);

  const desconectar = useCallback(async () => {
    setDesconectando(true);
    try {
      // Primero los datos, luego el connector: si fallara el segundo paso, lo
      // que queda es una integración conectada sin datos —recuperable
      // resincronizando— y no datos huérfanos sin nada que los explique.
      const { removed } = await syncSvc.purgeConnectorData(connectorId);
      await syncSvc.deleteConnector(connectorId);
      toast.success(removed > 0 ? `Desconectado · ${removed} registros retirados` : 'Desconectado');
      onDisconnected();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo desconectar');
    } finally {
      setDesconectando(false);
    }
  }, [connectorId, onDisconnected, onClose]);

  if (!open) return null;

  const registros = resumen?.records ?? 0;
  const queSon = resumen?.domain ? DOMINIO_ES[resumen.domain] ?? 'registros' : 'registros';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 210 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Desconectar ${label}`}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 440, background: 'var(--glass-modal)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.5)', zIndex: 211, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
          Desconectar {label}
        </div>

        {cargando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
            <Loader2 size={14} className="animate-spin" /> Mirando qué hay dentro…
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.6 }}>
              {registros > 0 ? (
                <>
                  Esto borrará <strong>{registros.toLocaleString('es')} {queSon}</strong>
                  {resumen?.account ? <> de <strong>{resumen.account}</strong></> : null} de Micelclaw,
                  y dejará de sincronizar.
                </>
              ) : (
                <>Esta integración no ha traído ningún dato todavía. Dejará de sincronizar.</>
              )}
            </div>

            {resumen?.shared_scope && registros > 0 && (
              // No se disimula: para calendario y contactos la pertenencia se
              // decide por ORIGEN, no por connector, así que con dos del mismo
              // tipo el recuento incluye lo del otro.
              <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                <TriangleAlert size={14} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 2 }} />
                <span>
                  Tienes más de una integración de este tipo y comparten origen: ese
                  recuento incluye lo que trajeron las otras.
                </span>
              </div>
            )}

            {registros > 0 && (
              <Button variant="secondary" onClick={() => void descargar()} disabled={descargando}>
                {descargando
                  ? <><Loader2 size={14} className="animate-spin" /> Preparando la copia…</>
                  : <><Download size={14} /> {descargada ? 'Descargar otra vez' : 'Descargar una copia antes'}</>}
              </Button>
            )}
            {descargada && (
              <div style={{ fontSize: '0.75rem', color: 'var(--success, #10b981)' }}>
                Copia descargada. Ya puedes desconectar sin perder nada.
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={desconectando}>Cancelar</Button>
          <Button variant="destructive" onClick={() => void desconectar()} disabled={desconectando || cargando}>
            {desconectando
              ? <><Loader2 size={14} className="animate-spin" /> Desconectando…</>
              : registros > 0 ? 'Desconectar y borrar' : 'Desconectar'}
          </Button>
        </div>
      </div>
    </>
  );
}
