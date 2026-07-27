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

// ─── Conectar una cuenta: una caja, y el resto plegado ───────────────────────
//
// Sustituye a la rejilla de 9 botones fijos. Diseño elegido por el usuario con
// maquetas delante (2026-07-27):
//
//   Pantalla 1 → SOLO la caja de la dirección. Los proveedores existen, pero
//                plegados detrás de "Ver proveedores": quien sabe su dirección
//                —o sea, todo el mundo— no tiene que elegir logo.
//   Pantalla 2 → lo que encontró el motor, en LLANO ("nos lo dijo tu propio
//                dominio"), el campo de la contraseña, y los hosts y puertos
//                detrás de "Ver detalles técnicos".
//
// Regla que gobierna la pantalla 2 y no es cosmética: la casilla de "acepto el
// certificado de mi servidor" solo aparece cuando el host lo ha TECLEADO el
// usuario. Un host que salió del descubrimiento no puede relajar el certificado
// por mucho que alguien marque una casilla — lo impide el backend, y la UI no
// ofrece lo que no se puede hacer.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import * as syncSvc from '@/services/sync.service';
import * as emailSvc from '@/services/email-accounts.service';

interface DiscoverFormProps {
  onConnected: () => void;
  /** Abre el formulario manual del flujo antiguo (proveedores sin descubrimiento). */
  onManualFallback?: () => void;
  /**
   * Arranca la autorización OAuth de ese proveedor. Se ofrece cuando el catálogo
   * dice que su primer método de auth es OAuth: pedirle la contraseña a alguien
   * cuyo proveedor no la acepta es mandarle a un fallo seguro.
   */
  onOAuth?: (providerSlug: string) => void;
}

type Fase = 'direccion' | 'buscando' | 'credencial';

const DOMINIO_ES: Record<string, string> = {
  mail: 'correo',
  calendar: 'calendario',
  contacts: 'contactos',
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

const campo: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
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
  marginBottom: 6,
};

export function DiscoverForm({ onConnected, onManualFallback, onOAuth }: DiscoverFormProps) {
  const [fase, setFase] = useState<Fase>('direccion');
  const [direccion, setDireccion] = useState('');
  const [resultado, setResultado] = useState<syncSvc.DiscoveryResult | null>(null);
  const [proveedores, setProveedores] = useState<syncSvc.DataProvider[]>([]);
  const [verProveedores, setVerProveedores] = useState(false);
  const [verDetalles, setVerDetalles] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Campos editables de la pantalla 2 (los rellena el motor; el usuario puede tocarlos).
  const [pass, setPass] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [imapSsl, setImapSsl] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSsl, setSmtpSsl] = useState(false);
  const [tocadoAMano, setTocadoAMano] = useState(false);
  const [aceptaCertPropio, setAceptaCertPropio] = useState(false);

  useEffect(() => {
    if (!verProveedores || proveedores.length > 0) return;
    syncSvc.listDataProviders().then(setProveedores).catch(() => {
      // Que falle el catálogo no puede impedir escribir la dirección: la caja
      // sigue siendo el camino principal.
      toast.error('No se pudo cargar la lista de proveedores');
    });
  }, [verProveedores, proveedores.length]);

  const aplicarResultado = useCallback((r: syncSvc.DiscoveryResult, dir: string) => {
    setResultado(r);
    const imap = r.candidate?.mail.find((m) => m.kind === 'imap');
    const smtp = r.candidate?.mail.find((m) => m.kind === 'smtp');
    setImapHost(imap?.host ?? '');
    setImapPort(imap?.port ?? 993);
    setImapSsl((imap?.socket ?? 'ssl') === 'ssl');
    setSmtpHost(smtp?.host ?? '');
    setSmtpPort(smtp?.port ?? 587);
    setSmtpSsl((smtp?.socket ?? 'starttls') === 'ssl');
    setTocadoAMano(false);
    setAceptaCertPropio(false);
    setPass('');
    // Si no encontró nada, los detalles se abren solos: el usuario tiene que
    // escribirlos, y esconderlos sería esconder justo lo que hay que hacer.
    setVerDetalles(r.manual_required || !r.candidate);
    setFase('credencial');
    setDireccion(dir);
  }, []);

  const buscar = useCallback(async (dir: string) => {
    const limpia = dir.trim();
    if (!limpia) return;
    setFase('buscando');
    try {
      aplicarResultado(await syncSvc.discoverProvider(limpia), limpia);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo buscar la configuración';
      toast.error(msg);
      setFase('direccion');
    }
  }, [aplicarResultado]);

  const elegirProveedor = useCallback(async (p: syncSvc.DataProvider) => {
    // El atajo del logo: si ya hay dirección escrita, se usa; si no, se pide.
    const dir = direccion.trim() || (p.mail_domains[0] ? `@${p.mail_domains[0]}` : '');
    if (!dir.includes('@') || dir.startsWith('@')) {
      setVerProveedores(false);
      toast.info(`Escribe tu dirección de ${p.label} para continuar`);
      return;
    }
    setFase('buscando');
    try {
      aplicarResultado(await syncSvc.discoverProvider(dir), dir);
    } catch {
      toast.error('No se pudo cargar la configuración de ese proveedor');
      setFase('direccion');
    }
  }, [direccion, aplicarResultado]);

  const conectar = useCallback(async () => {
    if (!pass) { toast.error('Falta la contraseña'); return; }
    if (!imapHost || !smtpHost) { toast.error('Faltan los servidores de correo'); return; }
    setGuardando(true);
    try {
      const cuenta = await emailSvc.createEmailAccount({
        name: resultado?.provider?.label ?? direccion,
        email_address: direccion,
        imap_host: imapHost,
        imap_port: imapPort,
        imap_encryption: imapSsl ? 'ssl' : 'starttls',
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_encryption: smtpSsl ? 'ssl' : 'tls',
        password: pass,
        sync_enabled: true,
      });

      // Se prueba SIEMPRE antes de dar nada por bueno: el alta deja la cuenta en
      // «sin verificar» y es esta llamada la que abre el socket de verdad.
      const prueba = await emailSvc.testEmailAccount(cuenta.id);
      if (prueba.imap?.status === 'ok') {
        toast.success(`Conectado · ${prueba.imap.folders_found?.length ?? 0} carpetas`);
      } else {
        toast.warning(prueba.imap?.hint ?? 'Guardada, pero la conexión falló', { duration: 8000 });
      }
      onConnected();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo conectar');
    } finally {
      setGuardando(false);
    }
  }, [pass, imapHost, imapPort, imapSsl, smtpHost, smtpPort, smtpSsl, direccion, resultado, onConnected]);

  const queTraemos = useMemo(() => {
    const doms = resultado?.provider?.domains ?? (resultado?.candidate?.dav?.length ? ['mail', 'calendar', 'contacts'] : ['mail']);
    return doms.map((d) => DOMINIO_ES[d] ?? d).join(' · ');
  }, [resultado]);

  // ── Pantalla 1: la caja ───────────────────────────────────────────────────
  if (fase === 'direccion' || fase === 'buscando') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontSize: '0.9375rem' }}>
          <Mail size={18} style={{ color: 'var(--text-dim)' }} />
          ¿Qué cuenta quieres conectar?
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void buscar(direccion); }}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}
        >
          <input
            autoFocus
            type="email"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="tu@dominio.com"
            disabled={fase === 'buscando'}
            style={{ ...campo, textAlign: 'center', fontSize: '0.9375rem' }}
          />
          <Button type="submit" disabled={fase === 'buscando' || !direccion.trim()} style={{ minWidth: 140 }}>
            {fase === 'buscando' ? <><Loader2 size={14} className="animate-spin" /> Buscando…</> : 'Continuar'}
          </Button>
        </form>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
          Buscamos solos la configuración de tu proveedor.<br />
          Si es tu propio servidor, también.
        </div>

        <button
          onClick={() => setVerProveedores((v) => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: '0.8125rem',
            display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)',
          }}
        >
          {verProveedores ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Ver proveedores
        </button>

        {verProveedores && (
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[...proveedores]
              .sort((a, b) => (a.slug === 'generic' ? 1 : 0) - (b.slug === 'generic' ? 1 : 0))
              .map((p) => (
              <button
                key={p.slug}
                onClick={() => void elegirProveedor(p)}
                title={p.verified ? `Probado el ${p.verified}` : 'Todavía no se ha probado contra un servidor real'}
                style={{
                  padding: '10px 6px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', color: 'var(--text)', fontSize: '0.75rem',
                  fontFamily: 'var(--font-sans)', display: 'flex',
                  flexDirection: 'column', alignItems: 'center', gap: 2,
                }}
              >
                {p.label}
                {/* La honestidad del catálogo, visible: un proveedor sin probar no
                    promete nada, y el usuario lo ve antes de meter su contraseña. */}
                {!p.verified && (
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-dim)' }}>sin probar</span>
                )}
              </button>
              ))}
            {proveedores.length === 0 && (
              <div style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                Cargando…
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Pantalla 2: lo que encontró, en llano ─────────────────────────────────
  const encontrado = !!resultado?.candidate && !resultado.manual_required;
  // El catálogo manda: si su primer método es OAuth, no hay campo de contraseña.
  const necesitaOAuth = resultado?.auth_order?.[0] === 'oauth2';
  const mecanismo = resultado?.candidate?.mechanism ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        display: 'flex', gap: 10, padding: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        {encontrado
          ? <ShieldCheck size={18} style={{ color: 'var(--success, #10b981)', flexShrink: 0, marginTop: 2 }} />
          : <TriangleAlert size={18} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 2 }} />}
        <div style={{ fontSize: '0.8125rem', color: 'var(--text)', lineHeight: 1.55 }}>
          {encontrado ? (
            <>
              <strong>Encontrado tu servidor</strong>
              <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
                {MECANISMO_ES[mecanismo] ?? 'Configuración encontrada.'}
              </div>
              <div style={{ color: 'var(--text-dim)' }}>Traeremos: {queTraemos}</div>
            </>
          ) : (
            <>
              <strong>No hemos encontrado tu servidor</strong>
              <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
                Tu dominio no publica su configuración. Escríbela abajo — si es tu
                propio servidor, la tienes en su panel.
              </div>
            </>
          )}
        </div>
      </div>

      {necesitaOAuth ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>
            {resultado?.provider?.label ?? 'Este proveedor'} no acepta una contraseña
            desde aquí: hay que autorizar la conexión en su web.
          </div>
          {onOAuth && resultado?.provider ? (
            <Button onClick={() => onOAuth(resultado.provider!.slug)}>
              Autorizar con {resultado.provider.label}
            </Button>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              La autorización de este proveedor todavía no está disponible en esta
              pantalla.
            </div>
          )}
          {resultado?.provider?.requires_own_oauth_client && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
              Necesita que el dueño del box haya registrado su propia aplicación
              en {resultado.provider.label}.
            </div>
          )}
        </div>
      ) : (
      <div>
        <label style={etiqueta}>
          {resultado?.auth_order?.[0] === 'app_password' ? 'Contraseña de aplicación' : 'Contraseña'}
        </label>
        <input
          autoFocus
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="••••••••"
          style={campo}
        />
        {resultado?.auth_order?.[0] === 'app_password' && (
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 4 }}>
            Este proveedor no acepta tu contraseña normal: necesita una contraseña
            de aplicación, que se genera en su web.
          </div>
        )}
        {(resultado?.provider?.notes ?? []).map((n, i) => (
          <div key={i} style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: 4 }}>{n}</div>
        ))}
      </div>
      )}

      <button
        onClick={() => setVerDetalles((v) => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-dim)', fontSize: '0.8125rem', padding: 0,
          display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)',
        }}
      >
        {verDetalles ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Ver detalles técnicos
      </button>

      {verDetalles && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={etiqueta}>Correo entrante (IMAP)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px 108px', gap: 6 }}>
              <input
                value={imapHost}
                onChange={(e) => { setImapHost(e.target.value); setTocadoAMano(true); }}
                style={campo}
              />
              <input
                type="number"
                value={imapPort}
                onChange={(e) => { setImapPort(Number(e.target.value)); setTocadoAMano(true); }}
                style={campo}
              />
              <select
                value={imapSsl ? 'ssl' : 'starttls'}
                onChange={(e) => { setImapSsl(e.target.value === 'ssl'); setTocadoAMano(true); }}
                style={campo}
              >
                <option value="ssl">SSL</option>
                <option value="starttls">STARTTLS</option>
              </select>
            </div>
          </div>

          <div>
            <label style={etiqueta}>Correo saliente (SMTP)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px 108px', gap: 6 }}>
              <input
                value={smtpHost}
                onChange={(e) => { setSmtpHost(e.target.value); setTocadoAMano(true); }}
                style={campo}
              />
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => { setSmtpPort(Number(e.target.value)); setTocadoAMano(true); }}
                style={campo}
              />
              <select
                value={smtpSsl ? 'ssl' : 'tls'}
                onChange={(e) => { setSmtpSsl(e.target.value === 'ssl'); setTocadoAMano(true); }}
                style={campo}
              >
                <option value="tls">STARTTLS</option>
                <option value="ssl">SSL</option>
              </select>
            </div>
          </div>

          {/*
            La casilla del certificado propio SOLO existe si el host lo escribió
            el usuario. Para un host descubierto el backend se niega a relajar el
            certificado —un dominio hostil que publique un SRV se llevaría la
            credencial— así que ofrecerla aquí sería prometer algo que no pasa.
          */}
          {tocadoAMano && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              <input
                type="checkbox"
                checked={aceptaCertPropio}
                onChange={(e) => setAceptaCertPropio(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                Es mi servidor: acepto su certificado aunque no esté firmado por una
                autoridad conocida.
              </span>
            </label>
          )}

          {(resultado?.attempts?.length ?? 0) > 0 && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Buscamos en {resultado?.attempts.length} sitios ({resultado?.total_ms} ms):{' '}
              {resultado?.attempts.map((a) => `${a.mechanism}=${a.outcome}`).join(', ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <Button variant="ghost" onClick={() => { setFase('direccion'); setResultado(null); }} disabled={guardando}>
          Atrás
        </Button>
        {!encontrado && onManualFallback && (
          <Button variant="ghost" onClick={onManualFallback} disabled={guardando}>
            Formulario completo
          </Button>
        )}
        {!necesitaOAuth && (
          <Button onClick={() => void conectar()} disabled={guardando || !pass}>
            {guardando ? <><Loader2 size={14} className="animate-spin" /> Probando…</> : 'Probar y conectar'}
          </Button>
        )}
      </div>
    </div>
  );
}
