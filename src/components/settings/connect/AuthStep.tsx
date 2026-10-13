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

// ─── Ventana 3 · Identificarse ──────────────────────────────────────────────
//
// La ÚNICA pantalla donde se pide algo secreto, y **la forma la manda el
// proveedor**, no el tipo de dato (decisión del usuario: *"dependerá del
// proveedor: muchos serán por OAuth, otros usuario y contraseña, otros email y
// contraseña, o a lo mejor alguno es libre si es algo local sin contraseña"*).
//
// Las cinco formas salen del campo `auth_order` de la fila del catálogo:
//
//   oauth2       → no hay campo de contraseña; se autoriza en la web del
//                  proveedor, y se pide UN solo permiso (el del tipo de dato
//                  elegido en la ventana 1).
//   app_password → correo + contraseña de aplicación, con el aviso de que la
//                  normal no vale y dónde generarla.
//   basic        → usuario (no correo) + contraseña. Synology, Nextcloud.
//   (sin auth)   → casilla "mi servidor no pide contraseña". Existe: un CalDAV
//                  en la red local abierto.
//   servidor     → primero el servidor (dominio **o IP**), después la cuenta.
//
// El caso de la IP es un fallo que el usuario cazó en la maqueta anterior: *"si
// mi Synology lo tengo por IP local, ¿ya no puedo tener el Synology? Pues mal"*.
// Por dentro las direcciones privadas están permitidas **precisamente porque las
// teclea él**; lo que se bloquea es una dirección privada que venga de un
// descubrimiento automático, que es por donde entraría un ataque.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, ExternalLink, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataProviderIcon } from '@/config/data-provider-icons';
import type { DataTypeMeta } from '@/config/data-types';
import * as syncSvc from '@/services/sync.service';

/**
 * Un valor que hay que pegar EXACTO en otro sitio (la URL de retorno, el nombre
 * de una variable). Se ofrece copiar porque teclearlo a mano es justo donde
 * fallan estos registros: una barra de más en la URL y el proveedor rechaza la
 * autorización con un error que no dice por qué.
 */

export interface AuthResult {
  method: string;
  /** Lo que el usuario escribió, ya normalizado para el alta. */
  address: string;
  username: string;
  password: string;
  noPassword: boolean;
  server: string;
  imapHost: string;
  imapPort: number;
  imapSsl: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSsl: boolean;
  davUrl: string;
  allowSelfSigned: boolean;
  /** El candidato del motor, si hubo descubrimiento. */
  discovery: syncSvc.DiscoveryResult | null;
  /** Campos públicos declarados por el conector (URL, correo, clave API…). */
  extra: Record<string, string>;
}

interface AuthStepProps {
  dataType: DataTypeMeta;
  provider: syncSvc.DataProvider;
  ownServer: boolean;
  onBack: () => void;
  onOAuth: (providerSlug: string, ownClient?: { clientId: string; clientSecret: string }) => void;
  onNextcloudLogin?: (serverUrl: string) => void;
  onReady: (r: AuthResult) => void;
  busy?: boolean;
}

const campo: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.875rem',
  outline: 'none',
};

const etiqueta: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: 'var(--text-dim)',
  marginBottom: 5,
};

/** Cómo se dice, en llano, de dónde salió la configuración. */
const MECANISMO_ES: Record<string, string> = {
  catalog: 'Lo sabíamos de antemano: es un proveedor conocido.',
  srv: 'Nos lo dijo tu propio dominio (su registro SRV).',
  autoconfig: 'Lo publica tu proveedor en su fichero de configuración.',
  ispdb: 'Lo encontramos en el directorio público de Thunderbird.',
  mx_hoster: 'Lo dedujimos de quién gestiona el correo de tu dominio.',
  m365_dns: 'Tu dominio está en Microsoft 365 (nos lo dice su DNS).',
  dav_wellknown: 'Nos lo dijo tu servidor al preguntarle.',
  guess: 'No lo publica nadie: lo hemos deducido probando los nombres habituales.',
  post_auth: 'Nos lo dirá tu servidor al entrar con tu cuenta.',
};

/** Dónde se genera la contraseña de aplicación de cada proveedor que la exige. */
const DONDE_APP_PASSWORD: Record<string, string> = {
  icloud: 'appleid.apple.com → Iniciar sesión y seguridad',
  yahoo: 'la seguridad de tu cuenta de Yahoo → Contraseñas de aplicación',
  fastmail: 'Fastmail → Settings → Privacy & Security → App passwords',
  zoho: 'Zoho → My Account → Security → App passwords',
};

const FIELD_LABELS: Record<string, string> = {
  server_url: 'Dirección del servidor',
  email: 'Correo de la cuenta',
  api_key: 'Clave de API',
};

const FIELD_PLACEHOLDERS: Record<string, string> = {
  server_url: 'https://tareas.tudominio.com',
  email: 'tu@empresa.com',
  api_key: 'Clave pública de la aplicación',
};

export function AuthStep({ dataType, provider, ownServer, onBack, onOAuth, onNextcloudLogin, onReady, busy }: AuthStepProps) {
  const [address, setAddress] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nextcloudManual, setNextcloudManual] = useState(false);
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [noPassword, setNoPassword] = useState(false);
  const [allowSelfSigned, setAllowSelfSigned] = useState(false);
  const [verDetalles, setVerDetalles] = useState(false);
  const [verSmtp, setVerSmtp] = useState(false);

  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [imapSsl, setImapSsl] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSsl, setSmtpSsl] = useState(false);
  const [davUrl, setDavUrl] = useState('');

  const [buscando, setBuscando] = useState(false);
  const [discovery, setDiscovery] = useState<syncSvc.DiscoveryResult | null>(null);

  const [metodo, setMetodo] = useState(provider.auth_order?.[0] ?? 'basic');
  useEffect(() => {
    setMetodo(provider.auth_order?.[0] ?? 'basic');
    setPassword('');
    setOauthClientSecret('');
  }, [provider.slug, dataType.id]);
  const elegirMetodo = provider.auth_order.length > 1 ? (
    <div>
      <label htmlFor="connector-auth-method" style={etiqueta}>Cómo entrar</label>
      <select id="connector-auth-method" value={metodo} disabled={busy} style={campo}
        onChange={e => { setMetodo(e.target.value); setPassword(''); setNoPassword(false); setAllowSelfSigned(false); }}>
        {provider.auth_order.map(method => <option key={method} value={method}>
          {{ oauth2: 'Autorizar en el proveedor', app_password: 'Contraseña de aplicación', basic: 'Usuario y contraseña', token: 'Token de API', bridge_local: 'Puente local' }[method] ?? method}
        </option>)}
      </select>
    </div>
  ) : null;
  const esOAuth = metodo === 'oauth2';
  const esToken = metodo === 'token';
  const esAppPassword = metodo === 'app_password';
  const esCorreo = dataType.id === 'mail';

  /**
   * ¿Hay que pedir el servidor a mano?
   *
   * «Otro servidor» siempre. Y también un proveedor CON NOMBRE que no tenga
   * dominios de correo —un Synology es una máquina tuya, no un servicio con
   * dominio— porque a ese no hay a quién preguntarle. El banco de pruebas lo
   * cazó: el botón salía deshabilitado y el campo para arreglarlo ni existía.
   */
  const pideServidor = !esToken && (ownServer || provider.mail_domains.length === 0);

  /**
   * ¿Hay que pedir el usuario del servidor Y la dirección de correo?
   *
   * Un proveedor cuyo primer método es `basic` (Synology) entra con el usuario
   * de SU sistema, que no es una dirección de correo — pero para sincronizar un
   * buzón hace falta saber cuál es. Antes se pedía un solo campo «Cuenta» con
   * marca de agua `tu@dominio.com`: si escribías el correo la conexión fallaba
   * (el DSM no lo conoce como usuario) y si escribías el usuario la cuenta se
   * guardaba con una dirección que no es una dirección.
   */
  const pideUsuarioYCorreo = esCorreo && metodo === 'basic';

  // El descubrimiento del proveedor conocido.
  //
  // Antes se pedía SIN tocar la red (`catalogOnly`), por no provocar una consulta
  // DNS con solo pulsar un logo. La intención era buena y el resultado, inservible:
  // **el catálogo no guarda los servidores de correo de nadie**. Medido el
  // 2026-07-28 — zoho, fastmail, mailbox.org, iCloud y Yahoo devuelven NADA sin
  // red y los cinco se aciertan con ella. Consecuencia: elegías «Zoho», el
  // formulario se quedaba vacío y «Probar y conectar» pedía un servidor de
  // entrada que el usuario no tiene por qué saberse. El banco de pruebas lo cazó
  // en 4 de los 5 proveedores de su primera tanda.
  //
  // Así que se pregunta de verdad: elegir un proveedor concreto es un clic
  // deliberado, y averiguar su servidor es exactamente para lo que existe el
  // motor. `discovery === 'preset'` sigue resolviéndose sin salir a la red.
  useEffect(() => {
    if (ownServer || esOAuth || provider.mail_domains.length === 0) return;
    let vivo = true;
    setBuscando(true);
    syncSvc
      .discoverProvider(`usuario@${provider.mail_domains[0]}`, false)
      .then((r) => {
        if (!vivo) return;
        setDiscovery(r);
        aplicarCandidato(r);
      })
      .catch(() => { /* sin descubrimiento se rellena a mano; no es un error que mostrar */ })
      .finally(() => { if (vivo) setBuscando(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.slug, ownServer, esOAuth]);

  const aplicarCandidato = useCallback((r: syncSvc.DiscoveryResult) => {
    const imap = r.candidate?.mail.find((m) => m.kind === 'imap');
    const smtp = r.candidate?.mail.find((m) => m.kind === 'smtp');
    if (imap) { setImapHost(imap.host); setImapPort(imap.port); setImapSsl(imap.socket === 'ssl'); }
    if (smtp) { setSmtpHost(smtp.host); setSmtpPort(smtp.port); setSmtpSsl(smtp.socket === 'ssl'); }
    const davKind = dataType.id === 'contacts' ? 'carddav' : 'caldav';
    const dav = r.candidate?.dav.find((d) => d.kind === davKind);
    if (dav) setDavUrl(dav.url);
  }, [dataType.id]);

  /**
   * "Otro servidor": el usuario escribe dominio O IP y se intenta descubrir. Con
   * un dominio el motor rellena los puertos; con una IP no hay a quién
   * preguntar, así que se escriben a mano (y ahí sí aparece la casilla del
   * certificado propio).
   */
  const buscarServidor = useCallback(async () => {
    const s = server.trim();
    if (!s) return;
    setBuscando(true);
    try {
      const r = await syncSvc.discoverProvider(s);
      setDiscovery(r);
      aplicarCandidato(r);
      // Si no se encontró nada, los detalles se abren solos: esconder justo lo
      // que hay que rellenar sería esconder el trabajo.
      if (r.manual_required || !r.candidate) setVerDetalles(true);
      // Y el servidor que el usuario TECLEÓ es el mejor valor por defecto para
      // el host: en "Otro servidor" el servidor que escribe ES su servidor. Sin
      // esto, un servidor que el motor no descubre dejaba el campo del host
      // vacío y el botón deshabilitado **sin decir por qué** — cazado montando
      // el viaje completo de la pantalla contra el correo del propio box.
      if ((r.candidate?.mail.length ?? 0) === 0) {
        setImapHost((h) => h || s);
        setSmtpHost((h) => h || s);
      }
    } catch {
      setVerDetalles(true);
      setImapHost((h) => h || s);
      setSmtpHost((h) => h || s);
    } finally {
      setBuscando(false);
    }
  }, [server, aplicarCandidato]);

  const esIp = useMemo(() => /^\d{1,3}(\.\d{1,3}){3}$/.test(server.trim()), [server]);

  /**
   * ¿El host lo ha TECLEADO el usuario?
   *
   * O eligió «Otro servidor», o el proveedor no tiene dominios de correo a los
   * que preguntar —un Synology es una máquina tuya— y lo escribió él, o metió
   * una IP a mano. Es la condición de la casilla del certificado: para un host
   * que salió del descubrimiento el motor se NIEGA a relajarlo (un dominio
   * hostil que publique un SRV se llevaría la credencial), así que ofrecerla
   * ahí sería prometer algo que no pasa.
   *
   * Antes la casilla se ataba a `verDetalles`, que es otra cosa: significaba
   * «abrió el pliegue», no «teclé el servidor». Con un NAS por NOMBRE
   * (`vicnas.ddns.net`, no una IP) no llegaba a ofrecerse.
   */
  const hostTecleado = pideServidor || esIp;

  /** Qué falta para poder continuar, con nombre. Vacío = se puede. */
  const faltaQue = useMemo(() => {
    if (esOAuth) return [];
    if (esToken) {
      const missing = (provider.connection_fields ?? [])
        .filter((field) => !field.secret && !extraFields[field.name]?.trim())
        .map((field) => FIELD_LABELS[field.name]?.toLowerCase() ?? field.name);
      if (password.length === 0) missing.push('el token');
      return missing;
    }
    const falta: string[] = [];
    if (pideServidor && !server.trim()) falta.push('el servidor');
    if (pideUsuarioYCorreo) {
      // Las DOS: la credencial del servidor y el buzón. Una sin la otra no
      // sincroniza (o falla el login, o guarda una dirección inventada).
      if (!username.trim()) falta.push('la cuenta');
      if (!address.trim()) falta.push('la dirección de correo');
    } else if (!address.trim() && !username.trim()) {
      falta.push(esCorreo ? 'la cuenta' : 'el usuario');
    }
    if (!noPassword && password.length === 0) falta.push('la contraseña');
    if (esCorreo && !imapHost.trim()) falta.push('el servidor de entrada (en «Ver detalles técnicos»)');
    if (!esCorreo && !davUrl.trim() && !server.trim()) falta.push('la dirección del servidor');
    return falta;
  }, [esOAuth, esToken, provider.connection_fields, extraFields, pideServidor, pideUsuarioYCorreo, server, address, username, esCorreo, noPassword, password, imapHost, davUrl]);

  const puedeContinuar = !esOAuth && faltaQue.length === 0;

  const continuar = () => {
    const token = esToken
      ? password.trim()
        .replace(/^authorization\s*:\s*bearer\s+/i, '')
        .replace(/^bearer\s+/i, '')
        .trim()
      : password;
    onReady({
      method: metodo,
      address: address.trim() || `${username.trim()}@${(server || provider.mail_domains[0] || 'local').trim()}`,
      username: username.trim() || address.trim(),
      password: token,
      noPassword,
      server: server.trim(),
      imapHost: imapHost.trim() || server.trim(),
      imapPort,
      imapSsl,
      smtpHost: smtpHost.trim() || imapHost.trim() || server.trim(),
      smtpPort,
      smtpSsl,
      davUrl: davUrl.trim(),
      // Solo puede ir a `true` si el host lo TECLEÓ el usuario. Para un host que
      // salió del descubrimiento el motor se niega a relajar el certificado —un
      // dominio hostil que publique un SRV se llevaría la credencial— así que
      // ofrecer la casilla ahí sería prometer algo que no pasa. La condición es
      // EXACTAMENTE la de visibilidad de la casilla: antes era `verDetalles`
      // («abrió el pliegue»), que no es lo mismo que «lo escribió él».
      allowSelfSigned: allowSelfSigned && hostTecleado,
      discovery,
      extra: extraFields,
    });
  };

  // ── OAuth: sin campo de contraseña, y con el permiso que se va a pedir ─────
  if (esOAuth) {
    const needsOwnClient = provider.requires_own_oauth_client === true;
    const oauthReady = !needsOwnClient || (oauthClientId.trim().length > 0 && oauthClientSecret.length > 0);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {elegirMetodo}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '4px 0' }}>
          <DataProviderIcon slug={provider.slug} size={28} />
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Conectar con {provider.label}
          </span>
        </div>

        <div style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.6 }}>
          {needsOwnClient
            ? `Primero registra una aplicación gratuita en ${provider.label}; después se abrirá su ventana de autorización.`
            : `Se abrirá una ventana de ${provider.label}. Micelclaw nunca ve tu contraseña.`}
        </div>

        {needsOwnClient && (
          <>
            {provider.credential_guide && (
              <div style={{
                padding: 10, background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>Cómo configurarlo</div>
                <ol style={{ margin: 0, paddingLeft: 18, listStyle: 'decimal' }}>
                  {provider.credential_guide.steps.map((step, index) => (
                    <li key={index} style={{ marginTop: index === 0 ? 0 : 3 }}>{step}</li>
                  ))}
                </ol>
                <a href={provider.credential_guide.url} target="_blank" rel="noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 7,
                  color: 'var(--link, #60a5fa)', textDecoration: 'underline', fontWeight: 500,
                }}>
                  {provider.credential_guide.link_label} <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            )}

            <div>
              <label htmlFor="oauth-redirect-uri" style={etiqueta}>URL de retorno OAuth</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input id="oauth-redirect-uri" readOnly value={provider.oauth_redirect_uri ?? ''} style={{ ...campo, flex: 1 }} />
                <button
                  type="button"
                  aria-label="Copiar URL de retorno"
                  onClick={() => void navigator.clipboard.writeText(provider.oauth_redirect_uri ?? '')}
                  style={{ ...campo, width: 38, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="oauth-client-id" style={etiqueta}>Client ID</label>
              <input
                id="oauth-client-id"
                autoFocus
                type="text"
                autoComplete="off"
                value={oauthClientId}
                onChange={(event) => setOauthClientId(event.target.value)}
                placeholder="Pega el Client ID de tu aplicación"
                style={campo}
              />
            </div>
            <div>
              <label htmlFor="oauth-client-secret" style={etiqueta}>Client Secret</label>
              <input
                id="oauth-client-secret"
                type="password"
                autoComplete="off"
                value={oauthClientSecret}
                onChange={(event) => setOauthClientSecret(event.target.value)}
                placeholder="Pega el Client Secret"
                style={campo}
              />
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>
                Micelclaw lo transporta cifrado dentro de la autorización y nunca lo añade a la URL.
              </div>
            </div>
          </>
        )}

        <div style={{
          padding: 11, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--text)',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <ShieldCheck size={15} style={{ color: 'var(--success, #10b981)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600 }}>Solo pedirá permisos de {dataType.label.toLowerCase()}</div>
              <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
                tu {dataType.label.toLowerCase()} de {provider.label}
              </div>
              {/*
                Esto es lo que hace valiosa la ventana 1: al elegir el tipo de
                dato primero, la autorización pide UN permiso en vez de todos.
              */}
              <div style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: '0.75rem' }}>
                No pedirá acceso a correo, calendario ni otros tipos de dato.
              </div>
            </div>
          </div>
        </div>

        {/*
          Lo ÚNICO que le sirve al usuario de todo esto: que el proveedor puede
          llamar «no verificado» al editor, y que eso no significa que algo vaya
          mal. Aquí también decía «te conectas con la aplicación de Micelclaw: no
          tienes que registrar nada» — se quitó porque le hablaba de un trámite
          (registrar una aplicación) que no existe en su mundo: tranquilizarle
          sobre algo que nunca iba a tener que hacer solo planta la duda.
        */}
        {provider.uses_shipped_oauth_client && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Puede que {provider.label} avise de que el editor no está verificado. Es normal: continúa.
          </div>
        )}

        {/*
          Las notas del proveedor también en la rama OAuth. Se pintaban SOLO
          junto al campo de contraseña, así que quien autoriza nunca las veía —
          y ahí va el aviso de que la autorización de Google caduca cada 7 días
          si su proyecto no está «In production». Un aviso que no se ve es un
          aviso que no existe.
        */}
        {(provider.notes ?? []).length > 0 && (
          <ul style={{
            margin: 0, paddingLeft: 16, listStyle: 'disc',
            fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.5,
            display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            {(provider.notes ?? []).map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
          <Button variant="ghost" onClick={onBack} disabled={busy}>Atrás</Button>
          {/*
            El botón se ofrece SIEMPRE. Aquí hubo un estado «este box todavía no
            puede autorizar» que primero enseñaba los pasos para registrar una
            aplicación y luego mandaba a hablar con quien administra el box:
            las dos cosas fuera. Con mil instalaciones ahí afuera, nadie va a
            escribir a nadie por esto — o funciona, o da error como cualquier
            otro fallo. Diseñar una pantalla para un estado que solo existe
            mientras se monta el producto es diseñar para el caso que no importa.
          */}
          <Button
            onClick={() => onOAuth(provider.slug, needsOwnClient ? {
              clientId: oauthClientId.trim(),
              clientSecret: oauthClientSecret,
            } : undefined)}
            disabled={busy || !oauthReady}
            style={{ maxWidth: '100%', minWidth: 0, whiteSpace: 'normal', textAlign: 'center' }}
          >
            {busy
              ? <><Loader2 size={14} className="animate-spin" /> Abriendo…</>
              : needsOwnClient ? `Autorizar con ${provider.label}` : `Continuar con ${provider.label}`}
          </Button>
        </div>
      </div>
    );
  }

  if (esToken) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {elegirMetodo}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: '4px 0' }}>
          <DataProviderIcon slug={provider.slug} size={28} />
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Conectar con {provider.label}
          </span>
        </div>
        {(provider.connection_fields ?? []).filter((field) => !field.secret).map((field) => (
          <div key={field.name}>
            <label style={etiqueta}>{provider.slug === 'jira' && field.name === 'server_url' ? 'URL de tu sitio Jira Cloud' : FIELD_LABELS[field.name] ?? field.name}</label>
            <input
              autoFocus={field === (provider.connection_fields ?? []).find((candidate) => !candidate.secret)}
              type={field.name === 'email' ? 'email' : 'text'}
              autoComplete="off"
              value={extraFields[field.name] ?? ''}
              onChange={(e) => setExtraFields((current) => ({ ...current, [field.name]: e.target.value }))}
              placeholder={provider.slug === 'jira' && field.name === 'server_url' ? 'https://tuempresa.atlassian.net' : FIELD_PLACEHOLDERS[field.name] ?? ''}
              style={campo}
            />
            {provider.slug === 'jira' && field.name === 'server_url' && (
              <div style={{ marginTop: 5, fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Abre <a href="https://home.atlassian.com/" target="_blank" rel="noreferrer">Atlassian Home</a>, entra en Jira y copia de la barra solo la raíz del sitio, por ejemplo <code>https://tuempresa.atlassian.net</code> (sin <code>/jira</code> ni <code>/browse</code>). La página donde creaste el token no es la URL del sitio.
                <div style={{ marginTop: 5 }}>Si creaste un token <strong>con scopes</strong>, Atlassian exige aquí <code>https://api.atlassian.com/ex/jira/tu-cloudId</code>. Puedes ver el <code>cloudId</code> abriendo <code>https://tuempresa.atlassian.net/_edge/tenant_info</code>.</div>
              </div>
            )}
          </div>
        ))}
        <div>
          <label style={etiqueta}>{provider.slug === 'trello' ? 'Token autorizado de Trello' : `Token de ${provider.label}`}</label>
          <input
            autoFocus={(provider.connection_fields ?? []).every((field) => field.secret)}
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={provider.slug === 'trello' ? 'Pega el token obtenido tras pulsar «Token» y «Allow»' : 'Pega aquí el token'}
            style={campo}
          />
          {provider.credential_guide && (
            <div style={{
              marginTop: 9, padding: 10, background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>
                Cómo conseguirlo
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, listStyle: 'decimal' }}>
                {provider.credential_guide.steps.map((step, index) => (
                  <li key={index} style={{ marginTop: index === 0 ? 0 : 3 }}>{step}</li>
                ))}
              </ol>
              <a
                href={provider.credential_guide.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 7,
                  color: 'var(--link, #60a5fa)', textDecoration: 'underline', fontWeight: 500,
                }}
              >
                {provider.credential_guide.link_label} <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          )}
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>
            {provider.slug === 'notion'
              ? 'Recomendamos una integración interna compartida solo con las páginas que quieras sincronizar.'
              : `Puedes revocarlo desde los ajustes de integraciones de ${provider.label}.`}
            {' '}Micelclaw lo cifra y no vuelve a mostrarlo.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onBack} disabled={busy}>Atrás</Button>
          <Button onClick={continuar} disabled={busy || faltaQue.length > 0}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Conectando…</> : 'Continuar'}
          </Button>
        </div>
      </div>
    );
  }

  if (dataType.id === 'notes' && provider.slug === 'nextcloud') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.9375rem' }}>
          <DataProviderIcon slug="nextcloud" size={27} /> Notas de Nextcloud
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', lineHeight: 1.5 }}>
          Escribe la dirección con la que abres Nextcloud. Se abrirá su propia ventana de autorización; no necesitas registrar ninguna aplicación.
        </div>
        <label style={etiqueta}>URL de tu Nextcloud
          <input autoFocus value={server} onChange={e => setServer(e.target.value)}
            placeholder="https://cloud.tudominio.com" style={campo} autoComplete="url" />
        </label>
        {nextcloudManual && <>
          <label style={etiqueta}>Usuario de Nextcloud
            <input value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Tu nombre de usuario, no necesariamente un correo" style={campo} autoComplete="username" />
          </label>
          <label style={etiqueta}>Contraseña de aplicación
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña creada para Micelclaw" style={campo} autoComplete="off" />
          </label>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', lineHeight: 1.5 }}>
            En Nextcloud: avatar → Ajustes personales → Seguridad → Dispositivos y sesiones → Crear contraseña de aplicación.
            No uses tu contraseña habitual. Micelclaw guarda la de aplicación cifrada.
          </div>
        </>}
        <button type="button" onClick={() => setNextcloudManual(value => !value)} disabled={busy}
          style={{ alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, color: 'var(--link, #60a5fa)', cursor: 'pointer', fontSize: '0.75rem' }}>
          {nextcloudManual ? 'Usar autorización en Nextcloud' : 'Usar una contraseña de aplicación en su lugar'}
        </button>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onBack} disabled={busy}>Atrás</Button>
          <Button onClick={() => nextcloudManual ? continuar() : onNextcloudLogin?.(server.trim())}
            disabled={busy || !server.trim() || (nextcloudManual && faltaQue.length > 0)}>
            {busy ? <><Loader2 size={14} className="animate-spin" /> Esperando autorización…</>
              : nextcloudManual ? 'Ver categorías' : 'Continuar en Nextcloud'}
          </Button>
        </div>
      </div>
    );
  }

  const donde = DONDE_APP_PASSWORD[provider.slug];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {elegirMetodo}
      {/* ── "Otro servidor": PRIMERO el servidor, después la cuenta ────────── */}
      {pideServidor && (
        <div>
          <label style={etiqueta}>Servidor</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              autoFocus
              value={server}
              onChange={(e) => setServer(e.target.value)}
              onBlur={() => void buscarServidor()}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void buscarServidor(); } }}
              placeholder="cloud.midominio.com  ·  o  ·  192.168.1.40"
              style={campo}
            />
            <Button variant="secondary" onClick={() => void buscarServidor()} disabled={buscando || !server.trim()}>
              {buscando ? <Loader2 size={14} className="animate-spin" /> : 'Buscar'}
            </Button>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Dominio o dirección IP — vale la IP de tu NAS en la red local.
          </div>
        </div>
      )}

      {/* ── Lo que encontró el motor, en llano ─────────────────────────────── */}
      {discovery?.candidate && (
        <div style={{
          display: 'flex', gap: 9, padding: 10,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', fontSize: '0.75rem', lineHeight: 1.5,
        }}>
          <ShieldCheck size={15} style={{ color: 'var(--success, #10b981)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>Encontrado tu servidor</div>
            <div style={{ color: 'var(--text-dim)' }}>
              {MECANISMO_ES[discovery.candidate.mechanism] ?? 'Configuración encontrada.'}
            </div>
          </div>
        </div>
      )}
      {pideServidor && esIp && !discovery?.candidate && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          A una dirección IP no se le puede preguntar su configuración: escríbela
          abajo. Si es tu servidor, la tienes en su panel.
        </div>
      )}

      {/* ── La cuenta ──────────────────────────────────────────────────────── */}
      {pideUsuarioYCorreo ? (
        /*
          Un servidor propio (Synology) entra con el usuario de SU sistema. La
          marca de agua decía `tu@dominio.com` y era una instrucción falsa: el
          DSM no conoce tu correo como usuario.
        */
        <div>
          <label style={etiqueta}>Cuenta</label>
          <input
            autoFocus={!ownServer}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="tu usuario"
            style={campo}
          />
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
            El usuario con el que entras a tu servidor (en un Synology, el de su panel),
            no una dirección de correo.
          </div>
        </div>
      ) : esCorreo || esAppPassword ? (
        <div>
          <label style={etiqueta}>Cuenta</label>
          <input
            autoFocus={!ownServer}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={provider.mail_domains[0] ? `tu@${provider.mail_domains[0]}` : 'tu@dominio.com'}
            style={campo}
          />
        </div>
      ) : (
        <div>
          <label style={etiqueta}>Usuario de tu servidor</label>
          <input
            autoFocus={!ownServer}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="tu usuario"
            style={campo}
          />
        </div>
      )}

      {/* ── La credencial ──────────────────────────────────────────────────── */}
      {!noPassword && (
        <div>
          <label style={etiqueta}>
            {esAppPassword ? 'Contraseña de aplicación' : 'Contraseña'}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={esAppPassword ? 'xxxx-xxxx-xxxx-xxxx' : '••••••••'}
            style={campo}
          />
          {esAppPassword && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>
              {provider.label} no acepta tu contraseña normal aquí.
              {donde ? <> Genera una en {donde}.</> : ' Necesita una contraseña de aplicación, que se genera en su web.'}
            </div>
          )}
          {(provider.notes ?? []).map((n, i) => (
            <div key={i} style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>{n}</div>
          ))}
        </div>
      )}

      {/* ── El buzón (solo cuando la credencial NO es el correo) ───────────── */}
      {pideUsuarioYCorreo && (
        <div>
          <label style={etiqueta}>Dirección de correo</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="tu@dominio.com"
            style={campo}
          />
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
            El buzón que se va a sincronizar.
          </div>
        </div>
      )}

      {/*
        "Sin contraseña" es un caso REAL, no un hueco: un servidor de calendario
        en la red local puede no pedir autenticación. Solo se ofrece para un
        servidor propio — un proveedor comercial siempre la pide.
      */}
      {pideServidor && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          <input type="checkbox" checked={noPassword} onChange={(e) => setNoPassword(e.target.checked)} />
          <span>Mi servidor no pide contraseña</span>
        </label>
      )}

      {/*
        ── El certificado, A LA VISTA ──────────────────────────────────────
        En un servidor propio el certificado que no cuadra es LA NORMA, no un
        detalle técnico: un NAS presenta o su firma propia, o un certificado
        válido emitido para otro nombre (lo que pasa detrás de un DDNS). Estaba
        plegado dentro de «Ver detalles técnicos» y por eso el alta fallaba con
        un error de certificado teniendo el remedio a un clic, invisible.

        Sigue apareciendo SOLO si el host lo escribió el usuario (`hostTecleado`):
        para un host que salió del descubrimiento el motor se niega a relajarlo.
      */}
      {hostTecleado && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          <input
            type="checkbox"
            checked={allowSelfSigned}
            onChange={(e) => setAllowSelfSigned(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            Es mi servidor: acepto su certificado aunque no esté firmado por una autoridad
            conocida o esté emitido para otro nombre.
          </span>
        </label>
      )}

      {/* ── Detalles técnicos, plegados ────────────────────────────────────── */}
      <button
        onClick={() => setVerDetalles((v) => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
        }}
      >
        {verDetalles ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {esCorreo ? 'Ver detalles técnicos' : 'Ruta y puerto'}
      </button>

      {verDetalles && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {esCorreo ? (
            <>
              <div>
                <label style={etiqueta}>Entrante (IMAP)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 66px 106px', gap: 6 }}>
                  <input value={imapHost} onChange={(e) => setImapHost(e.target.value)} style={campo} />
                  <input type="number" value={imapPort} onChange={(e) => setImapPort(Number(e.target.value))} style={campo} />
                  <select value={imapSsl ? 'ssl' : 'starttls'} onChange={(e) => setImapSsl(e.target.value === 'ssl')} style={campo}>
                    <option value="ssl">SSL</option>
                    <option value="starttls">STARTTLS</option>
                  </select>
                </div>
              </div>

              {/* El envío va plegado: quien solo quiere leer no lo toca. */}
              <button
                onClick={() => setVerSmtp((v) => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
                }}
              >
                {verSmtp ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Envío de correo (SMTP)
              </button>
              {verSmtp && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 66px 106px', gap: 6 }}>
                  <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} style={campo} />
                  <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} style={campo} />
                  <select value={smtpSsl ? 'ssl' : 'tls'} onChange={(e) => setSmtpSsl(e.target.value === 'ssl')} style={campo}>
                    <option value="tls">STARTTLS</option>
                    <option value="ssl">SSL</option>
                  </select>
                </div>
              )}
            </>
          ) : (
            <div>
              <label style={etiqueta}>Ruta del servidor</label>
              <input
                value={davUrl}
                onChange={(e) => setDavUrl(e.target.value)}
                placeholder={dataType.id === 'contacts' ? 'https://tu-servidor/dav/' : 'https://tu-servidor/remote.php/dav/'}
                style={campo}
              />
              {/*
                Con una IP el motor casi nunca puede deducir la ruta, así que se
                dan los ejemplos de los tres casos reales en vez de dejar al
                usuario buscándolos.
              */}
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
                Nextcloud: <code>/remote.php/dav/</code> · Synology: <code>/caldav/</code> · Fastmail: <code>/dav/</code>
              </div>
            </div>
          )}

        </div>
      )}

      {/*
        Un botón deshabilitado que no dice por qué es un callejón sin salida: el
        usuario ve el formulario relleno "a su juicio" y no sabe qué falta. Se
        nombra lo que falta, no se le deja adivinar.
      */}
      {!puedeContinuar && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'right' }}>
          Falta: {faltaQue.join(' · ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
        <Button variant="ghost" onClick={onBack} disabled={busy}>Atrás</Button>
        <Button onClick={continuar} disabled={busy || !puedeContinuar}>
          {busy ? <><Loader2 size={14} className="animate-spin" /> Probando…</> : <><KeyRound size={14} /> Probar y conectar</>}
        </Button>
      </div>
    </div>
  );
}
