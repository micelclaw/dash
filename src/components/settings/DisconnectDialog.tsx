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
import { useI18n } from '@/i18n';

interface DisconnectDialogProps {
  connectorId: string;
  label: string;
  open: boolean;
  onClose: () => void;
  onDisconnected: () => void;
  /** Explicit connector domain, never inferred from its display name. */
  preserveNotes?: boolean;
}

const DOMAIN_KEYS: Record<string, string> = {
  mail: 'settings.disconnect.records.mail',
  calendar: 'settings.disconnect.records.calendar',
  contacts: 'settings.disconnect.records.contacts',
  tasks: 'settings.disconnect.records.tasks',
};

export function DisconnectDialog({ connectorId, label, open, onClose, onDisconnected,preserveNotes=false }: DisconnectDialogProps) {
  const { t, locale } = useI18n();
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
      toast.error(err instanceof Error ? err.message : t('settings.disconnect.downloadFailed'));
    } finally {
      setDescargando(false);
    }
  }, [connectorId, label, t]);

  const desconectar = useCallback(async () => {
    setDesconectando(true);
    try {
      // Una sola llamada: el borrado de la integración se lleva sus datos por
      // dentro. Antes eran dos pasos y la purga vivía SOLO aquí, así que
      // desconectar por cualquier otro camino dejaba los datos huérfanos —el
      // fallo que el usuario cazó con su Synology.
      const { records_removed: removed } = await syncSvc.deleteConnector(connectorId);
      toast.success(preserveNotes ? t('settings.disconnect.toastPreserved') : removed > 0 ? t('settings.disconnect.toastRemoved', { count: removed }) : t('settings.disconnect.toastEmpty'));
      onDisconnected();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('settings.disconnect.failed'));
    } finally {
      setDesconectando(false);
    }
  }, [connectorId, onDisconnected, onClose, preserveNotes, t]);

  if (!open) return null;

  const registros = resumen?.records ?? 0;
  const orphanCount = resumen?.orphans ?? 0;
  const queSon = resumen?.domain ? t(DOMAIN_KEYS[resumen.domain] ?? 'settings.disconnect.records.generic') : t('settings.disconnect.records.generic');

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 210 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.disconnect.title', { label })}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 440, background: 'var(--glass-modal)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.5)', zIndex: 211, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
          {t('settings.disconnect.title', { label })}
        </div>

        {cargando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
            <Loader2 size={14} className="animate-spin" /> {t('settings.disconnect.loading')}
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.6 }}>
              {preserveNotes ? (
                <>{t('settings.disconnect.preserveNotes')}</>
              ) : registros > 0 ? (
                <>
                  {t('settings.disconnect.removeRecords', { count: registros.toLocaleString(locale === 'es' ? 'es-ES' : 'en-US'), records: queSon })}
                  {resumen?.account ? t('settings.disconnect.account', { account: resumen.account }) : ''}
                  {t('settings.disconnect.stopSync')}
                </>
              ) : (
                <>{t('settings.disconnect.noData')}</>
              )}
            </div>

            {resumen?.shared_scope && registros > 0 && (
              // Solo para CORREO sin cuenta asociada: ahí la pertenencia se
              // sigue decidiendo por ORIGEN. En calendario y contactos el
              // recuento es exacto desde que la purga dejó de reclamar lo
              // huérfano, así que este aviso ya no aparece por ellos.
              <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                <TriangleAlert size={14} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 2 }} />
                <span>
                  {t('settings.disconnect.sharedScope')}
                </span>
              </div>
            )}

            {orphanCount > 0 && (
              // La otra mitad de la verdad: lo que NO se va. Antes esto se
              // borraba con el resto (y así desaparecieron 97 eventos), ahora se
              // queda y se dice — un registro de más es recuperable; el
              // calendario de alguien, no.
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {t(orphanCount === 1 ? 'settings.disconnect.orphan.one' : 'settings.disconnect.orphan.many', { count: orphanCount })}
              </div>
            )}

            {registros > 0 && !preserveNotes && (
              <Button variant="secondary" onClick={() => void descargar()} disabled={descargando}>
                {descargando
                  ? <><Loader2 size={14} className="animate-spin" /> {t('settings.disconnect.prepareCopy')}</>
                  : <><Download size={14} /> {descargada ? t('settings.disconnect.downloadAgain') : t('settings.disconnect.downloadBefore')}</>}
              </Button>
            )}
            {descargada && (
              <div role="status" style={{ fontSize: '0.75rem', color: 'var(--success, #10b981)' }}>
                {t('settings.disconnect.copyDownloaded')}
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose} disabled={desconectando}>{t('settings.disconnect.cancel')}</Button>
          <Button variant="destructive" onClick={() => void desconectar()} disabled={desconectando || cargando}>
            {desconectando
              ? <><Loader2 size={14} className="animate-spin" /> {t('settings.disconnect.disconnecting')}</>
              : preserveNotes ? t('settings.disconnect.keep') : registros > 0 ? t('settings.disconnect.delete') : t('settings.disconnect.confirm')}
          </Button>
        </div>
      </div>
    </>
  );
}
