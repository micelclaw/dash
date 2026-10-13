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

// ─── Conectar: el viaje completo ────────────────────────────────────────────
//
// Cuatro ventanas, en este orden y por este motivo:
//
//   1. QUÉ tipo de dato  → nueve baldosas del mismo peso
//   2. DÓNDE está        → solo los proveedores que sirven ESE dato
//   3. Identificarse     → la forma la manda el proveedor
//   4. Qué me traigo     → carpetas / calendarios / libretas, del servidor
//
// El orden lo decidió el usuario y tiene una razón técnica además de la de
// sentido común: una autorización OAuth se pide **con los permisos por delante**,
// así que preguntar el tipo de dato primero es lo único que permite pedir UN solo
// permiso en vez de todos "para poder mirar qué hay".
//
// Se puede entrar por dos puertas: desde Ajustes (empieza en la ventana 1) o
// desde el botón "+ Conectar" de un módulo, que **salta la ventana 1** porque el
// tipo de dato ya lo dice el sitio desde el que se pulsó. Al terminar se vuelve
// al módulo, no a Ajustes.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { DATA_TYPES, dataType as findDataType, type DataTypeMeta } from '@/config/data-types';
import * as syncSvc from '@/services/sync.service';
import * as emailSvc from '@/services/email-accounts.service';
import { WhatStep } from './WhatStep';
import { WhereStep, type ProviderChoice } from './WhereStep';
import { AuthStep, type AuthResult } from './AuthStep';
import { CollectionsStep, type CollectionsChoice } from './CollectionsStep';
import { TaskMappingStep } from './TaskMappingStep';

type Fase = 'what' | 'where' | 'auth' | 'collections' | 'mapping';

export interface ConnectWizardProps {
  open: boolean;
  onClose: () => void;
  /** Al terminar, para refrescar la lista de quien lo abrió. */
  onConnected: () => void;
  /**
   * Tipo de dato fijado: entra directo en la ventana 2. Es lo que usa el botón
   * "+ Conectar" de cada módulo.
   */
  fixedDataType?: string;
}

export function ConnectWizard({ open, onClose, onConnected, fixedDataType }: ConnectWizardProps) {
  const oauthPending = useRef<{ state: string; popup: Window; origin: string } | null>(null);
  const nextcloudLoginGeneration = useRef(0);
  const nextcloudLoginPopup = useRef<Window | null>(null);
  const [fase, setFase] = useState<Fase>('what');
  const [tipo, setTipo] = useState<DataTypeMeta | null>(null);
  const [eleccion, setEleccion] = useState<ProviderChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Lo creado, para la ventana 4 y para el guardado final.
  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [collections, setCollections] = useState<syncSvc.CollectionItem[] | null>(null);
  const [collectionsNoun, setCollectionsNoun] = useState<string | undefined>(undefined);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [collectionsDiagnostic, setCollectionsDiagnostic] = useState<Pick<syncSvc.ConnectorCollections, 'empty_reason' | 'action_required' | 'help_url'>>({});
  const [suggestedCap, setSuggestedCap] = useState(2000);
  const [taskSchemas, setTaskSchemas] = useState<syncSvc.TaskCollectionSchema[]>([]);

  const reset = useCallback(() => {
    oauthPending.current = null;
    nextcloudLoginGeneration.current++;
    nextcloudLoginPopup.current?.close();
    nextcloudLoginPopup.current = null;
    setTipo(null);
    setEleccion(null);
    setConnectorId(null);
    setCollections(null);
    setCollectionsError(null);
    setCollectionsDiagnostic({});
    setTaskSchemas([]);
    setBusy(false);
  }, []);

  useEffect(() => { if (!open) { nextcloudLoginGeneration.current++; nextcloudLoginPopup.current?.close(); nextcloudLoginPopup.current = null; } }, [open]);

  // Al abrir: si el tipo viene fijado (botón "+" de un módulo) se salta la
  // ventana 1. Si no, se cuentan las integraciones que hay por tipo para el
  // contador de las baldosas — sale del ESTADO REAL, no de una lista.
  useEffect(() => {
    if (!open) return;
    reset();
    const fijo = fixedDataType ? findDataType(fixedDataType) : undefined;
    if (fijo) {
      setTipo(fijo);
      setFase('where');
    } else {
      setFase('what');
    }
    syncSvc
      .listConnectors()
      .then((list) => {
        const c: Record<string, number> = {};
        for (const conn of list) {
          if (conn.connector_type.endsWith('-observer')) continue;
          for (const d of conn.domains ?? []) {
            const id = d === 'emails' ? 'mail' : d === 'events' ? 'calendar' : ['contacts', 'tasks', 'notes'].includes(d) ? d : null;
            if (id) c[id] = (c[id] ?? 0) + 1;
          }
        }
        setCounts(c);
      })
      .catch(() => setCounts({}));
  }, [open, fixedDataType, reset]);

  /**
   * Preguntar al servidor qué hay dentro. Es la ventana 4, y hasta ahora solo
   * ocurría para el correo con contraseña: quien autorizaba con Google no elegía
   * nada (el asistente se cerraba solo) y quien conectaba un CalDAV recibía
   * siempre «no hemos podido leer la lista», porque se preguntaba al endpoint de
   * mensajería.
   */
  const cargarColecciones = useCallback(async (id: string): Promise<string | null> => {
    setCollections(null);
    setCollectionsError(null);
    setCollectionsDiagnostic({});
    try {
      const r = await syncSvc.getConnectorCollections(id);
      setCollections(r.collections);
      setCollectionsNoun(r.noun);
      setCollectionsDiagnostic({
        empty_reason: r.empty_reason,
        action_required: r.action_required,
        help_url: r.help_url,
      });
      return null;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'el servidor no las devolvió';
      setCollectionsError(message);
      return message;
    }
  }, []);

  // ── OAuth: el popup y su vuelta ───────────────────────────────────────────
  useEffect(() => {
    if (!open || !busy) return;
    const handler = async (event: MessageEvent) => {
      const pending = oauthPending.current;
      if (event.data?.type !== 'oauth_callback' || !pending || event.source !== pending.popup ||
          event.origin !== pending.origin || event.data.state !== pending.state) return;
      oauthPending.current = null;
      try {
        const creado = await syncSvc.oauthCallback({
          provider: event.data.provider,
          code: event.data.code,
          state: event.data.state,
        });
        localStorage.removeItem('claw_oauth_pending');
        // La autorización NO es el final del viaje: falta la pregunta de qué
        // traerse. Antes aquí se cerraba el asistente, así que una cuenta de
        // Google entera entraba sin que nadie preguntase nada.
        setConnectorId(creado.id);
        setFase('collections');
        void cargarColecciones(creado.id);
      } catch (err: unknown) {
        // El callback puede fallar con causa (identidad no disponible,
        // autorización que no corresponde a ninguna integración conocida). Se
        // muestra tal cual en vez de un "algo falló".
        toast.error(err instanceof Error ? err.message : 'No se pudo completar la autorización');
      } finally {
        setBusy(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [open, busy, cargarColecciones]);

  const empezarOAuth = useCallback(async (
    slug: string,
    ownClient?: { clientId: string; clientSecret: string },
  ) => {
    if (!tipo) return;
    const scope = eleccion?.provider.oauth_scopes?.join(',');
    const connectorType = eleccion?.provider.connector_type;
    const oauthProvider = eleccion?.provider.oauth_provider ?? slug;
    if (!scope || !connectorType) {
      toast.error(`Todavía no se puede autorizar ${tipo.label.toLowerCase()} de este proveedor`);
      return;
    }
    setBusy(true);
    try {
      const oauth = await syncSvc.getOAuthAuthorizeUrl(oauthProvider, scope, ownClient ? {
        client_id: ownClient.clientId,
        client_secret: ownClient.clientSecret,
      } : undefined, connectorType);
      localStorage.setItem('claw_oauth_pending', JSON.stringify({ provider: slug, state: oauth.state }));
      const popup = window.open(oauth.authorize_url, 'claw_oauth', 'width=500,height=700,scrollbars=yes,resizable=yes');
      if (popup) oauthPending.current = { state: oauth.state, popup,
        origin: new URL(eleccion?.provider.oauth_redirect_uri ?? window.location.origin).origin };
      if (!popup) {
        toast.error('El navegador bloqueó la ventana. Permite las ventanas emergentes de este sitio.');
        setBusy(false);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo iniciar la autorización');
      setBusy(false);
    }
  }, [tipo, eleccion]);

  const empezarNextcloud = useCallback(async (serverUrl: string) => {
    const generation = ++nextcloudLoginGeneration.current;
    // Open synchronously with the click so popup blockers do not swallow the provider window.
    const popup = window.open('about:blank', 'claw_nextcloud_login', 'width=550,height=740,scrollbars=yes,resizable=yes');
    if (!popup) { toast.error('Permite las ventanas emergentes para autorizar Nextcloud.'); return; }
    nextcloudLoginPopup.current = popup;
    setBusy(true);
    try {
      const login = await syncSvc.startNextcloudNotesLogin(serverUrl);
      if (generation !== nextcloudLoginGeneration.current) { popup.close(); return; }
      popup.location.href = login.login_url;
      const deadline = Date.now() + login.expires_in_seconds * 1000;
      while (generation === nextcloudLoginGeneration.current && Date.now() < deadline) {
        const result = await syncSvc.pollNextcloudNotesLogin(login.state);
        if (result.status === 'connected') {
          popup.close();
          setConnectorId(result.connector_id);
          setFase('collections');
          await cargarColecciones(result.connector_id);
          return;
        }
        await new Promise(resolve => window.setTimeout(resolve, 2000));
      }
      if (generation === nextcloudLoginGeneration.current) toast.error('La autorización de Nextcloud caducó. Vuelve a intentarlo.');
    } catch (error: unknown) {
      if (generation === nextcloudLoginGeneration.current)
        toast.error(error instanceof Error ? error.message : 'No se pudo autorizar Nextcloud');
      popup.close();
    } finally {
      if (nextcloudLoginPopup.current === popup) nextcloudLoginPopup.current = null;
      if (generation === nextcloudLoginGeneration.current) setBusy(false);
    }
  }, [cargarColecciones]);

  // ── El alta con contraseña ────────────────────────────────────────────────
  const conectar = useCallback(async (r: AuthResult) => {
    if (!tipo || !eleccion) return;
    setBusy(true);
    try {
      if (tipo.id === 'mail') {
        // El correo entra por el alta de cuenta, que es la que verifica de verdad
        // y crea el connector como efecto.
        const cuenta = await emailSvc.createEmailAccount({
          // El nombre de la tarjeta es la DIRECCIÓN, no el proveedor: es lo que
          // identifica la cuenta y lo que el usuario reconoce de un vistazo. Con
          // el nombre del proveedor, dos cuentas del mismo sitio salían con el
          // mismo título — y con uno largo ("Otro proveedor / servidor propio")
          // la tarjeta lo truncaba a algo ilegible.
          name: r.address,
          email_address: r.address,
          imap_host: r.imapHost,
          imap_port: r.imapPort,
          imap_encryption: r.imapSsl ? 'ssl' : 'starttls',
          smtp_host: r.smtpHost,
          smtp_port: r.smtpPort,
          smtp_encryption: r.smtpSsl ? 'ssl' : 'tls',
          password: r.noPassword ? '' : r.password,
          sync_enabled: true,
          // El proveedor que se ELIGIÓ en la ventana 2: es lo único que le dice
          // al dash qué logo pintar en la tarjeta sin adivinar por el nombre del
          // tipo (un IMAP genérico no tiene forma de derivarlo del protocolo).
          provider: eleccion.provider.slug,
          ...(r.allowSelfSigned ? { allow_self_signed: true } : {}),
        });

        // Se prueba SIEMPRE antes de dar nada por bueno: el alta deja la cuenta
        // en "sin verificar" y es esta llamada la que abre el socket.
        const prueba = await emailSvc.testEmailAccount(cuenta.id);
        if (prueba.imap?.status !== 'ok') {
          toast.error(prueba.imap?.hint ?? 'Guardada, pero no se pudo entrar', { duration: 9000 });
        }

        const conns = await syncSvc.listConnectors();
        const mio = conns.find((c) => c.account_id === cuenta.id) ?? null;
        setConnectorId(mio?.id ?? null);

        // Las carpetas las da el SERVIDOR. Si no llegan, se dice.
        if (mio) await cargarColecciones(mio.id);
        else setCollectionsError('la integración no se creó');
      } else {
        // Calendario, contactos y tareas: un connector DAV, sin cuenta de correo de por
        // medio (fallo que el usuario cazó: pedirle un correo a quien quiere
        // conectar un calendario).
        const esToken = r.method === 'token';
        const catalog = await syncSvc.listDataCatalog(tipo.providerDomain ?? undefined);
        const davTypes: Record<string, string> = {
          calendar: 'caldav',
          contacts: 'carddav',
          tasks: 'caldav-tasks',
          notes: 'nextcloud-notes',
        };
        const connectorType = esToken
          ? catalog.connectorTypes.find((candidate) => candidate.provider_slug === eleccion.provider.slug && candidate.domains.includes(tipo.providerDomain === 'calendar' ? 'events' : tipo.providerDomain === 'mail' ? 'emails' : tipo.providerDomain ?? ''))?.type
          : davTypes[tipo.id];
        if (!connectorType) throw new Error(`No hay conector para ${tipo.label.toLowerCase()}`);
        const created = await syncSvc.createConnector({
          connector_type: connectorType,
          display_name: `${eleccion.provider.label} · ${tipo.label}`,
          config: esToken ? {
            token: r.password,
            ...r.extra,
            provider: eleccion.provider.slug,
            sync_interval_minutes: eleccion.provider.slug === 'notion' ? 30 : 15,
          } : {
            server_url: tipo.id === 'notes' ? (r.server.startsWith('http') ? r.server : `https://${r.server}/`)
              : r.davUrl || (r.server.startsWith('http') ? r.server : `https://${r.server}/`),
            username: r.username || r.address,
            password: r.noPassword ? '' : r.password,
            sync_interval_minutes: 15,
            // Mismo motivo que en el alta de correo: el proveedor elegido en la
            // ventana 2 es la única pista real para un CalDAV/CardDAV genérico.
            provider: eleccion.provider.slug,
            ...(r.allowSelfSigned ? { allow_self_signed: true } : {}),
          },
        });
        setConnectorId(created.id);
        // Antes se preguntaba a `/channels`, que es el descubrimiento de la
        // MENSAJERÍA y contesta 400 para un CalDAV: por eso elegir calendarios
        // no fallaba, es que nunca llegó a existir.
        const discoveryError = await cargarColecciones(created.id);
        if (discoveryError && (esToken || connectorType === 'nextcloud-notes')) {
          // El alta por token es atómica desde el punto de vista del usuario:
          // si la credencial no permite ni listar las colecciones, no dejamos
          // una integración inválida/duplicada detrás para cada reintento.
          await syncSvc.deleteConnector(created.id).catch(() => undefined);
          setConnectorId(null);
          throw new Error(discoveryError);
        }
      }

      setSuggestedCap(2000);
      setFase('collections');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo conectar');
    } finally {
      setBusy(false);
    }
  }, [tipo, eleccion]);

  // ── Empezar de verdad ─────────────────────────────────────────────────────
  const empezar = useCallback(async (c: CollectionsChoice) => {
    if (!connectorId) { onConnected(); onClose(); return; }
    setBusy(true);
    try {
      // La clave donde va lo elegido (`folders`, `labels`, `calendars`,
      // `address_books`, `contact_groups`) la decide el CATÁLOGO del servidor,
      // no un `if` por tipo de dato aquí: ese `if` era el que no contemplaba los
      // tipos de Google.
      await syncSvc.saveConnectorCollections(connectorId, c.selected);

      if (tipo?.id === 'tasks' && ['monday', 'jira', 'trello'].includes(eleccion?.provider.slug ?? '')) {
        const schemas = await Promise.all(c.selected.map((id) => syncSvc.getConnectorCollectionSchema(connectorId, id)));
        setTaskSchemas(schemas);
        setFase('mapping');
        return;
      }

      if (tipo?.id === 'mail') {
        // El tope se PERSISTE, no se aplica en silencio: es lo que hace que la
        // barra de progreso y la configuración digan el mismo número.
        await syncSvc.updateConnectorConfig(connectorId, { max_initial_messages: c.initialCap });
      }
      await syncSvc.runConnector(connectorId);
      toast.success('Conectado · trayendo tus datos');
      onConnected();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo empezar');
    } finally {
      setBusy(false);
    }
  }, [connectorId, tipo, eleccion, onConnected, onClose]);

  const empezarMapeado = useCallback(async (mappings: Record<string, Record<string, unknown>>) => {
    if (!connectorId) return;
    setBusy(true);
    try {
      await syncSvc.updateConnectorConfig(connectorId, { mappings });
      await syncSvc.runConnector(connectorId);
      toast.success('Conectado · trayendo tus tareas');
      onConnected();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo empezar');
    } finally {
      setBusy(false);
    }
  }, [connectorId, onConnected, onClose]);

  /**
   * Cerrar a mitad. Si ya se creó la integración (p.ej. tras autorizar, cuando
   * queda la pregunta de qué traerse), la lista de quien abrió el asistente
   * tiene que enterarse — si no, autorizas, cierras, y parece que no pasó nada.
   */
  const cerrar = useCallback(() => {
    oauthPending.current = null;
    nextcloudLoginGeneration.current++;
    nextcloudLoginPopup.current?.close();
    nextcloudLoginPopup.current = null;
    if (connectorId) onConnected();
    onClose();
  }, [connectorId, onConnected, onClose]);

  const titulo = useMemo(() => {
    if (fase === 'what') return 'Conectar';
    if (!tipo) return 'Conectar';
    if (fase === 'where') return tipo.label;
    return `${tipo.label} · ${eleccion?.ownServer ? 'Otro servidor' : eleccion?.provider.label ?? ''}`;
  }, [fase, tipo, eleccion]);

  const puedeVolver = fase !== 'what' && !(fase === 'where' && Boolean(fixedDataType));

  if (!open) return null;

  return (
    <>
      <div
        onClick={cerrar}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conectar"
        data-provider={eleccion?.provider.slug ?? undefined}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(480px, calc(100vw - 24px))',
          maxHeight: 'min(84vh, calc(100dvh - 24px))',
          background: 'var(--glass-modal)', backdropFilter: 'blur(20px)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.5)', zIndex: 201,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '13px 14px', borderBottom: '1px solid var(--border)',
        }}>
          {puedeVolver ? (
            <button
              onClick={() => {
                if (fase === 'mapping') setFase('collections');
                else if (fase === 'collections') setFase('auth');
                else if (fase === 'auth') setFase('where');
                else setFase('what');
              }}
              aria-label="Atrás"
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <ArrowLeft size={16} />
            </button>
          ) : <span style={{ width: 20 }} />}

          <div style={{ flex: 1, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            {titulo}
          </div>

          <button
            onClick={cerrar}
            aria-label="Cerrar"
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 16, overflow: 'auto', flex: 1, minHeight: 0, overscrollBehavior: 'contain' }}>
          {fase === 'what' && (
            <WhatStep
              counts={counts}
              onPick={(t) => { setTipo(t); setFase('where'); }}
            />
          )}

          {fase === 'where' && tipo && (
            <WhereStep
              dataType={tipo}
              onPick={(c) => { setEleccion(c); setFase('auth'); }}
            />
          )}

          {fase === 'auth' && tipo && eleccion && (
            <AuthStep
              dataType={tipo}
              provider={eleccion.provider}
              ownServer={eleccion.ownServer}
              busy={busy}
              onBack={() => {
                nextcloudLoginGeneration.current++;
                nextcloudLoginPopup.current?.close();
                nextcloudLoginPopup.current = null;
                setBusy(false);
                setFase('where');
              }}
              onOAuth={(slug, ownClient) => void empezarOAuth(slug, ownClient)}
              onNextcloudLogin={(serverUrl) => void empezarNextcloud(serverUrl)}
              onReady={(r) => void conectar(r)}
            />
          )}

          {fase === 'collections' && tipo && (
            <CollectionsStep
              dataType={tipo}
              collections={collections}
              noun={collectionsNoun}
              collectionsError={collectionsError}
              emptyReason={collectionsDiagnostic.empty_reason}
              actionRequired={collectionsDiagnostic.action_required}
              helpUrl={collectionsDiagnostic.help_url}
              suggestedCap={suggestedCap}
              busy={busy}
              onBack={() => setFase('auth')}
              onStart={(c) => void empezar(c)}
              allowManualEntry={tipo.id === 'tasks' && eleccion?.provider.slug === 'notion'}
              onResolveManual={connectorId && tipo.id === 'tasks' && eleccion?.provider.slug === 'notion'
                ? (input) => syncSvc.resolveConnectorCollection(connectorId, input)
                : undefined}
              onRefresh={connectorId ? () => cargarColecciones(connectorId) : undefined}
            />
          )}

          {fase === 'mapping' && eleccion && ['monday', 'jira', 'trello'].includes(eleccion.provider.slug) && (
            <TaskMappingStep
              provider={eleccion.provider.slug as 'monday' | 'jira' | 'trello'}
              schemas={taskSchemas}
              busy={busy}
              onBack={() => setFase('collections')}
              onStart={(mappings) => void empezarMapeado(mappings)}
            />
          )}
        </div>

        {/* El rastro de migas: se ve dónde estás sin leer nada. */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 0', borderTop: '1px solid var(--border)',
        }}>
          {(['what', 'where', 'auth', 'collections', ...(['monday', 'jira', 'trello'].includes(eleccion?.provider.slug ?? '') ? ['mapping' as const] : [])] as Fase[]).map((f, i) => {
            const orden: Fase[] = ['what', 'where', 'auth', 'collections', ...(['monday', 'jira', 'trello'].includes(eleccion?.provider.slug ?? '') ? ['mapping'] as const : [])];
            const actual = orden.indexOf(fase);
            const hecho = i < actual;
            const aqui = i === actual;
            if (fixedDataType && f === 'what') return null;
            return (
              <span
                key={f}
                style={{
                  width: aqui ? 18 : 6, height: 6, borderRadius: 3,
                  background: hecho || aqui ? 'var(--amber)' : 'var(--border)',
                  transition: 'all var(--transition-fast)',
                }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Los nueve tipos, para quien quiera pintarlos fuera del asistente. */
export { DATA_TYPES };
