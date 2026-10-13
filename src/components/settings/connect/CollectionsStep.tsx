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

// ─── Ventana 4 · Qué me traigo ──────────────────────────────────────────────
//
// Esta ventana no existía, y es la que hace que el viaje parezca terminado: en
// vez de escupir al usuario a la lista y ponerse a bajar cosas a ciegas, se le
// enseña lo que hay DENTRO y elige.
//
// Dos reglas:
//
//  1. **Las colecciones vienen del SERVIDOR.** Es el criterio I3-1 del playbook,
//     y no es una formalidad: el endpoint que las daba antes devolvía
//     `['INBOX','Sent','Drafts','Trash','Spam']` **inventadas, sin abrir un
//     socket**. Si la lista no llega, se dice — no se rellena con una plausible.
//
//  2. **El número que se elige aquí es el número que se ve luego.** Bug real que
//     reportó el usuario: la barra decía que sincronizaba 500 correos mientras la
//     configuración prometía 2.000. Había tres valores por defecto distintos para
//     lo mismo y ganaba el más bajo.

import { useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DataTypeMeta } from '@/config/data-types';
import type { CollectionItem } from '@/services/sync.service';

export interface CollectionsChoice {
  selected: string[];
  initialCap: number;
}

interface CollectionsStepProps {
  dataType: DataTypeMeta;
  /** Lo que devolvió el servidor. `null` = todavía cargando. */
  collections: CollectionItem[] | null;
  /** Cómo se llaman: lo dice el catálogo del servidor, no una tabla de aquí. */
  noun?: string;
  /** Por qué no hay lista, si no la hay. Se muestra tal cual. */
  collectionsError: string | null;
  emptyReason?: 'notion_no_shared_content';
  actionRequired?: string;
  helpUrl?: string;
  /** Tope del primer pull que declara el catálogo del proveedor. */
  suggestedCap: number;
  onBack: () => void;
  onStart: (c: CollectionsChoice) => void;
  allowManualEntry?: boolean;
  onResolveManual?: (input: string) => Promise<CollectionItem[]>;
  onRefresh?: () => void;
  busy?: boolean;
}

const CAP_OPTIONS = [200, 500, 1000, 2000, 5000];

/** Las carpetas que se marcan solas: lo que quiere el 99% de la gente. */
const POR_DEFECTO = ['inbox', 'sent', 'archive', 'entrada', 'enviados'];

export function CollectionsStep({
  dataType,
  collections,
  noun,
  collectionsError,
  emptyReason,
  actionRequired,
  helpUrl,
  suggestedCap,
  onBack,
  onStart,
  allowManualEntry,
  onResolveManual,
  onRefresh,
  busy,
}: CollectionsStepProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [cap, setCap] = useState(suggestedCap);
  const [manual, setManual] = useState('');
  const [manualItems, setManualItems] = useState<CollectionItem[]>([]);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    if (!collections) return;
    // Notes start with an explicit empty selection. A discovery refresh must
    // not erase choices the user has already made in this same step.
    if (dataType.id === 'notes') return;
    // Spam y papelera NO se marcan: nadie quiere que su buzón de basura entre en
    // la búsqueda del sistema. Se pueden marcar a mano.
    const buenas = collections.filter((c) => {
      const l = `${c.name} ${c.id}`.toLowerCase();
      if (/spam|junk|trash|papelera|basura|deleted/.test(l)) return false;
      return POR_DEFECTO.some((d) => l.includes(d)) || collections.length <= 3;
    });
    const elegidas = buenas.length > 0 ? buenas : collections.slice(0, 1);
    setSelected(elegidas.map((c) => c.id));
  }, [collections, dataType.id]);

  useEffect(() => { setCap(suggestedCap); }, [suggestedCap]);

  const toggle = (c: string) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const addManual = async () => {
    const raw = manual.trim();
    if (!raw || !onResolveManual) return;
    setManualBusy(true);
    setManualError(null);
    try {
      const resolved = await onResolveManual(raw);
      setManualItems((current) => [
        ...current,
        ...resolved.filter((entry) => !current.some((existing) => existing.id === entry.id)),
      ]);
      setSelected((current) => [
        ...current,
        ...resolved.map((entry) => entry.id).filter((id) => !current.includes(id)),
      ]);
      setManual('');
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'No se pudo resolver ese enlace de Notion');
    } finally {
      setManualBusy(false);
    }
  };

  const visibleCollections = [
    ...(collections ?? []),
    ...manualItems.filter((entry) => !(collections ?? []).some((existing) => existing.id === entry.id)),
  ];

  const nombre = noun ?? (dataType.id === 'mail' ? 'carpetas' : dataType.id === 'calendar' ? 'calendarios' : 'libretas');
  const exigeSeleccion = dataType.id === 'tasks' || dataType.id === 'notes';
  const googleTasks403 = exigeSeleccion && /google respondi[oó] 403/i.test(collectionsError ?? '');
  const noPuedeEmpezar = Boolean(busy)
    || (exigeSeleccion && selected.length === 0);

  if (collections === null && !collectionsError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '36px 0', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
        <Loader2 size={14} className="animate-spin" /> Mirando qué hay dentro…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        <Check size={16} style={{ color: 'var(--success, #10b981)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 600 }}>
          Dentro. ¿Qué {nombre} me traigo?
        </div>
      </div>

      {collectionsError ? (
        <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          <TriangleAlert size={14} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 2 }} />
          <span>
            {googleTasks403
              ? <>Google Tasks no permite leer tus listas (403). Comprueba que la API de Google Tasks está habilitada en el proyecto de Google Cloud usado para OAuth.{' '}
                <a href="https://console.cloud.google.com/apis/library/tasks.googleapis.com" target="_blank" rel="noreferrer">Abrir configuración de la API</a>. Después pulsa «Reintentar».</>
              : <>No hemos podido leer la lista de {nombre} de tu servidor: {collectionsError}</>}
            {exigeSeleccion
              ? ' No se importará nada hasta poder mostrarte y guardar una selección.'
              : ' Se traerá lo principal y podrás afinarlo después desde la tarjeta.'}
          </span>
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          maxHeight: 220, overflowY: 'auto',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          padding: 6,
        }}>
          {visibleCollections.map((c) => (
            <label
              key={c.id}
              data-collection-id={c.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '6px 6px', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text)',
              }}
            >
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
              {typeof c.count === 'number' && c.count > 0 && (
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  {c.count.toLocaleString('es')}
                </span>
              )}
            </label>
          ))}
          {visibleCollections.length === 0 && (
            <div style={{ padding: '10px 6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {allowManualEntry
                ? 'Notion no devolvió ninguna fuente compartida. Comparte la base con la integración o pega debajo su enlace o ID.'
                : `Tu servidor no declaró ninguna ${nombre.slice(0, -1)}.`}
            </div>
          )}
        </div>
      )}

      {emptyReason === 'notion_no_shared_content' && !collectionsError && visibleCollections.length === 0 && (
        <div style={{ padding: '10px 12px', border: '1px solid rgba(245,158,11,.28)', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,.07)', fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>
          <strong style={{ display: 'block', color: 'var(--text)', marginBottom: 4 }}>No encontramos contenido compartido</strong>
          <ol style={{ margin: '0 0 8px 18px', padding: 0 }}>
            <li>Abre tu integración en Notion.</li>
            <li>En Content access, pulsa Edit access.</li>
            <li>{dataType.id === 'notes' ? 'Permite las páginas que quieres traer y pulsa Actualizar.' : 'Comparte la base de tareas y vuelve a pulsar Actualizar.'}</li>
          </ol>
          {actionRequired && <div style={{ marginBottom: 8 }}>{actionRequired}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            {helpUrl && <Button asChild variant="secondary"><a href={helpUrl} target="_blank" rel="noreferrer">Abrir instrucciones</a></Button>}
            {onRefresh && <Button variant="secondary" onClick={onRefresh}><RefreshCw size={14} /> Actualizar</Button>}
          </div>
        </div>
      )}

      {dataType.id==='notes'&&visibleCollections.length>0&&onRefresh&&
        <Button variant="ghost" onClick={onRefresh} disabled={busy} title="Actualizar páginas"><RefreshCw size={14}/>Actualizar páginas</Button>}

      {allowManualEntry && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visibleCollections.length > 0 && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Estas son todas las fuentes que Notion ha compartido con esta integración. Si falta alguna, añádela en Notion desde Content access o «Añadir conexión» y pulsa actualizar.
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addManual(); } }}
              placeholder="Enlace o ID de una base o fuente de Notion"
              style={{ flex: 1, minWidth: 0, padding: '8px 9px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: '0.75rem' }}
            />
            <Button variant="secondary" onClick={() => void addManual()} disabled={!manual.trim() || manualBusy || !onResolveManual}>
              {manualBusy ? <Loader2 size={14} className="animate-spin" /> : null} Resolver y añadir
            </Button>
            {onRefresh && <Button variant="ghost" onClick={onRefresh} title="Actualizar desde Notion"><RefreshCw size={14} /></Button>}
          </div>
          {manualError && <div role="alert" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{manualError}</div>}
        </div>
      )}

      {dataType.id === 'mail' && (
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 5 }}>
            De entrada me traigo
          </label>
          <select
            value={String(cap)}
            onChange={(e) => setCap(Number(e.target.value))}
            style={{
              width: '100%', padding: '9px 11px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text)',
              fontFamily: 'var(--font-sans)', fontSize: '0.875rem',
            }}
          >
            {CAP_OPTIONS.map((n) => (
              <option key={n} value={n}>los últimos {n.toLocaleString('es')}</option>
            ))}
          </select>
          {/*
            Este número se PERSISTE en la configuración del connector, no se
            aplica solo en tiempo de ejecución: es lo que hace que la barra de
            progreso y la configuración digan lo mismo.
          */}
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Es el número que verás sincronizando. Lo demás llega después, poco a poco.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onBack} disabled={busy}>Atrás</Button>
        {collectionsError && onRefresh && (
          <Button variant="secondary" onClick={onRefresh} disabled={busy}>
            <RefreshCw size={14} /> Reintentar
          </Button>
        )}
        <Button onClick={() => onStart({ selected, initialCap: cap })} disabled={noPuedeEmpezar}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Empezando…</> : 'Empezar'}
        </Button>
      </div>
    </div>
  );
}
