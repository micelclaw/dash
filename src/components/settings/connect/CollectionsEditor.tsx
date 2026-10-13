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

// ─── Cambiar lo que se trae una integración YA conectada ────────────────────
//
// La ventana 4 del asistente pregunta una vez, al conectar. Esto es la misma
// pregunta desde la tarjeta, para cuando cambias de idea — y es lo que el
// usuario esperaba al pulsar «editar» en una tarjeta de calendario: opciones de
// calendario, no un formulario de correo.
//
// Antes, la única pista de qué había dentro era un botón «Show Folders» que
// pintaba unas etiquetas grises: informativas y no elegibles. Y solo existía
// para el correo con contraseña.

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import * as syncSvc from '@/services/sync.service';

interface CollectionsEditorProps {
  connectorId: string;
  connectorType?: string;
}

export function CollectionsEditor({ connectorId, connectorType }: CollectionsEditorProps) {
  const [data, setData] = useState<syncSvc.ConnectorCollections | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualItems, setManualItems] = useState<syncSvc.CollectionItem[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await syncSvc.getConnectorCollections(connectorId);
      setData(r);
      setSelected(r.selected);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'El servidor no devolvió la lista');
    } finally {
      setCargando(false);
    }
  }, [connectorId]);

  useEffect(() => {
    setData(null);
    setSelected([]);
    setError(null);
    setManualItems([]);
    setManualError(null);
  }, [connectorId]);

  const resolverNotion = useCallback(async () => {
    const input = manualInput.trim();
    if (!input) return;
    setManualBusy(true);
    setManualError(null);
    try {
      const resolved = await syncSvc.resolveConnectorCollection(connectorId, input);
      setManualItems((current) => [
        ...current.filter((item) => !resolved.some((entry) => entry.id === item.id)),
        ...resolved,
      ]);
      setSelected((current) => [...new Set([...current, ...resolved.map((entry) => entry.id)])]);
      setManualInput('');
    } catch (e: unknown) {
      setManualError(e instanceof Error ? e.message : 'No se pudo resolver esa referencia');
    } finally {
      setManualBusy(false);
    }
  }, [connectorId, manualInput]);

  const guardar = useCallback(async () => {
    if(connectorType?.endsWith('-notes')&&selected.length===0)return;
    setGuardando(true);
    try {
      await syncSvc.saveConnectorCollections(connectorId, selected);
      toast.success(selected.length > 0 ? 'Guardado' : 'Guardado · se traerá todo');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }, [connectorId, selected,connectorType]);

  const nombre = data?.noun ?? 'colecciones';
  const isTaskConnector = connectorType?.endsWith('-tasks') === true;
  const isNotesConnector=connectorType?.endsWith('-notes')===true;
  const explicitSelection=isTaskConnector||isNotesConnector;
  const isNotion = connectorType === 'notion-tasks';
  const visibleCollections = [
    ...(data?.collections ?? []),
    ...manualItems.filter((item) => !(data?.collections ?? []).some((entry) => entry.id === item.id)),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)' }}>
        Qué me traigo
      </label>

      {!data && !error && (
        <Button variant="secondary" onClick={() => void cargar()} disabled={cargando}>
          {cargando ? <><Loader2 size={13} className="animate-spin" /> Mirando qué hay dentro…</> : 'Ver qué hay dentro'}
        </Button>
      )}

      {error && (
        <div style={{ display: 'flex', gap: 7, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          <TriangleAlert size={13} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          <div
            style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              maxHeight: 180, overflowY: 'auto',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 6,
            }}
          >
            {visibleCollections.map((c) => (
              <label
                key={c.id}
                data-collection-id={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 4px', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text)',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() =>
                    setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))
                  }
                />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.name}
                </span>
                {typeof c.count === 'number' && c.count > 0 && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {c.count.toLocaleString('es')}
                  </span>
                )}
              </label>
            ))}
            {visibleCollections.length === 0 && (
              <div style={{ padding: '8px 4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isNotion ? 'No encontramos contenido compartido.' : `No se encontró ninguna ${nombre.slice(0, -1)}.`}
              </div>
            )}
          </div>
          {isNotion && visibleCollections.length > 0 && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Notion solo entrega las fuentes compartidas con esta integración. Si falta una, concédele acceso en Notion y actualiza esta lista.
            </div>
          )}

          {isNotion && visibleCollections.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <strong style={{ color: 'var(--text)' }}>Comparte tu base con la integración</strong>
              <span>{data.action_required ?? 'En Notion abre Content access o «Añadir conexión», concede acceso a la base y pulsa Actualizar.'}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {data.help_url && (
                  <Button variant="secondary" asChild>
                    <a href={data.help_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Instrucciones</a>
                  </Button>
                )}
                <Button variant="secondary" onClick={() => void cargar()} disabled={cargando}>
                  <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Actualizar
                </Button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={manualInput}
                  onChange={(event) => setManualInput(event.target.value)}
                  placeholder="URL o ID de base/fuente de Notion"
                  style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--text)', padding: '6px 8px' }}
                />
                <Button variant="secondary" onClick={() => void resolverNotion()} disabled={manualBusy || !manualInput.trim()}>
                  {manualBusy ? <Loader2 size={13} className="animate-spin" /> : 'Resolver y añadir'}
                </Button>
              </div>
              {manualError && <span style={{ color: 'var(--error)' }}>{manualError}</span>}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flex: 1 }}>
              {selected.length === 0
                ? (explicitSelection ? `Selecciona al menos una de las ${nombre}.` : `Sin marcar nada se traen todas las ${nombre}.`)
                : `${selected.length} de ${visibleCollections.length}`}
            </span>
            <Button variant="secondary" onClick={() => void guardar()} disabled={guardando || (explicitSelection && selected.length === 0)}>
              {guardando ? <><Loader2 size={13} className="animate-spin" /> Guardando…</> : 'Guardar selección'}
            </Button>
          </div>
          {isNotesConnector&&<p className="text-xs text-[var(--text-dim)]">Para retirar páginas ya importadas, desconecta primero: sus notas se conservarán como copias locales.</p>}
        </>
      )}
    </div>
  );
}
