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

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as syncSvc from '@/services/sync.service';
import { CollectionsEditor } from './connect/CollectionsEditor';
import { MappingEditor } from './connect/MappingEditor';
import * as emailAccountsSvc from '@/services/email-accounts.service';

interface EditConnectorModalProps {
  connectorId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface ConnectorDetail {
  id: string;
  connector_type: string;
  /** `oauth2_rest` | `imap` | `caldav` | `carddav`. Lo dice el servidor. */
  protocol?: string;
  /** De qué es la integración (`emails`/`events`/`contacts`), del catálogo. */
  domains?: string[];
  display_name: string | null;
  name: string;
  status: string;
  config: Record<string, any>;
  account_id?: string;
}

interface EmailAccountDetail {
  id: string;
  name: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_username: string | null;
  smtp_host: string;
  smtp_port: number;
  sync_interval_minutes: number;
}

export function EditConnectorModal({ connectorId, onClose, onSaved }: EditConnectorModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [connector, setConnector] = useState<ConnectorDetail | null>(null);
  const [emailAccount, setEmailAccount] = useState<EmailAccountDetail | null>(null);

  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(465);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [interval, setInterval] = useState(15);
  const [maxMessages, setMaxMessages] = useState(2000);
  /**
   * La casilla del certificado propio, EDITABLE.
   *
   * Vivía solo en el alta y plegada dentro de «Ver detalles técnicos»: si no la
   * marcabas ahí, no había NINGUNA forma de marcarla después — la integración se
   * quedaba con su error de certificado para siempre y solo se salía borrándola
   * y volviendo a crearla.
   */
  const [allowSelfSigned, setAllowSelfSigned] = useState(false);

  // Load connector detail
  useEffect(() => {
    if (!connectorId) return;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const c = await syncSvc.getConnector<ConnectorDetail & { account_id?: string }>(connectorId);
        setConnector(c);
        setDisplayName(c.display_name ?? c.name);
        setInterval(c.config.sync_interval_minutes ?? 15);
        setAllowSelfSigned(c.config.allow_self_signed === true);

        if (c.connector_type === 'imap-generic' && c.account_id) {
          // Fetch linked email account
          const acc = (await emailAccountsSvc.getEmailAccount(c.account_id)) as unknown as EmailAccountDetail;
          setEmailAccount(acc);
          setEmailAddress(acc.email_address);
          setImapHost(acc.imap_host);
          setImapPort(acc.imap_port);
          setSmtpHost(acc.smtp_host);
          setSmtpPort(acc.smtp_port);
          setUsername(acc.imap_username ?? '');
          setInterval(acc.sync_interval_minutes ?? 5);
          setDisplayName(acc.name);
        } else if (c.connector_type === 'caldav' || c.connector_type === 'carddav' || c.connector_type === 'caldav-tasks') {
          setServerUrl(c.config.server_url ?? '');
          setUsername(c.config.username ?? '');
        } else {
          // Limpiar SIEMPRE lo que no aplica a esta integración.
          //
          // Sin este `else`, abrir la ficha de una integración después de otra
          // mostraba los datos de la ANTERIOR: el estado del formulario vive en
          // el componente y solo se rellenaba en las dos ramas de arriba. Por eso
          // la ficha de Microsoft aparecía con la dirección y el usuario del
          // Synology dentro — no eran sus datos, eran los que quedaban puestos.
          setServerUrl('');
          setUsername('');
          setEmailAccount(null);
          setEmailAddress('');
        }

        // Load max_messages for connectors that support it
        if (c.config.max_initial_messages) {
          setMaxMessages(c.config.max_initial_messages);
        }
      } catch {
        setError('Failed to load connector details');
      } finally {
        setLoading(false);
      }
    })();
  }, [connectorId]);

  const handleSave = async () => {
    if (!connectorId) return;
    setError('');
    setSaving(true);
    try {
      if (connector?.connector_type === 'imap-generic' && emailAccount) {
        // Update email account
        await emailAccountsSvc.updateEmailAccount(emailAccount.id, {
          name: displayName,
          email_address: emailAddress,
          imap_host: imapHost,
          imap_port: imapPort,
          smtp_host: smtpHost || imapHost,
          smtp_port: smtpPort,
          imap_username: username || undefined,
          sync_interval_minutes: interval,
          ...(password ? { password } : {}),
        });
        // Also update connector config
        await syncSvc.updateConnectorConfig(connectorId, {
          display_name: displayName,
          sync_interval_minutes: interval,
          max_initial_messages: maxMessages,
          host: imapHost,
          port: imapPort,
          // Se manda SIEMPRE (también `false`) para que se pueda desmarcar: el
          // PATCH mezcla el cuerpo en la config, así que omitirlo dejaría la
          // casilla imposible de quitar una vez puesta.
          allow_self_signed: allowSelfSigned,
        });
      } else if (isOAuth || isToken) {
        // OAuth connectors (Gmail, Google Calendar, etc.). El tope solo se
        // escribe si es de correo: en calendario y contactos no lo lee nadie y
        // guardarlo era escribir en la configuración una promesa que nada cumple.
        await syncSvc.updateConnectorConfig(connectorId, {
          display_name: displayName,
          sync_interval_minutes: interval,
          ...(esCorreo ? { max_initial_messages: maxMessages } : {}),
        });
      } else {
        // CalDAV/CardDAV
        await syncSvc.updateConnectorConfig(connectorId, {
          display_name: displayName,
          server_url: serverUrl,
          username,
          sync_interval_minutes: interval,
          allow_self_signed: allowSelfSigned,
          ...(password ? { password_encrypted: password } : {}),
        });
      }

      toast.success('Settings saved');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!emailAccount) return;
    setTestResult('testing');
    try {
      const result = await emailAccountsSvc.testEmailAccount(emailAccount.id, { allowSelfSigned });
      const ok = result.imap?.status === 'ok';
      setTestResult(ok ? 'success' : 'failed');
      // Un aspa roja sin causa es lo que dejó 13 conexiones en rojo sin que
      // nadie supiera por qué: si falla, se dice qué pasó y qué hacer.
      if (ok) {
        toast.success(`Conectado · ${result.imap.folders_found?.length ?? 0} carpetas`);
      } else {
        toast.error(result.imap?.hint ?? 'No se pudo conectar', { duration: 8000 });
      }
    } catch (err: unknown) {
      setTestResult('failed');
      toast.error(err instanceof Error ? err.message : 'No se pudo conectar');
    }
  };

  if (!connectorId) return null;

  // Igual que el OAuth de abajo: el PROTOCOLO lo dice el catálogo. Con el nombre
  // del tipo, un segundo proveedor IMAP obligaría a tocar este fichero.
  const isImap = connector?.protocol === 'imap'
    // Respaldo para filas antiguas guardadas sin protocolo.
    || connector?.connector_type === 'imap-generic';
  // El PROTOCOLO lo dice el servidor; aquí no se adivina por el nombre.
  //
  // Antes era `startsWith('google') || === 'gmail'`, y esa lista dejaba fuera a
  // Microsoft: su integración no contaba como OAuth, así que caía en la rama de
  // «servidor DAV» y se le pintaba un formulario con dirección de servidor,
  // usuario y contraseña —los del Synology, por el estado sin limpiar—. Cada
  // proveedor nuevo repetiría el fallo mientras la condición sea una lista.
  const isOAuth = connector?.protocol === 'oauth2_rest'
    // Respaldo para filas antiguas guardadas sin protocolo.
    || connector?.connector_type?.startsWith('google') === true
    || connector?.connector_type === 'gmail'
    || connector?.connector_type?.startsWith('microsoft') === true;
  const isToken = connector?.protocol === 'token_rest';
  // El tope del primer pull es del CORREO y solo del correo. Antes se enseñaba
  // para cualquier integración de Google, así que la tarjeta de Contactos decía
  // «Max Emails (initial sync): 2.000» — un número que no lo lee nadie y que
  // encima habla de correos en una integración de contactos.
  // Y de qué es la integración lo dicen sus DOMINIOS, que también vienen del
  // catálogo: así el tope sale para cualquier integración de correo, incluida la
  // que se añada mañana, y no sale en calendario ni en contactos.
  const esCorreo = connector?.domains?.includes('emails')
    ?? (isImap
      || connector?.connector_type === 'gmail'
      || connector?.connector_type === 'microsoft-mail');

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 32, padding: '0 8px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text)',
    fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-dim)',
    marginBottom: 4, display: 'block',
  };

  const rowStyle: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8,
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', zIndex: 200,
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440, maxHeight: '80vh',
        background: 'var(--glass-modal)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.5)', zIndex: 201,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text)' }}>
            Edit: {displayName || 'Connector'}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-dim)',
            cursor: 'pointer', padding: 4, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Loader2 size={24} style={{ color: 'var(--amber)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Display Name</label>
                <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>

              {isImap && (
                <>
                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <input style={inputStyle} type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} />
                  </div>
                  <div style={rowStyle}>
                    <div>
                      <label style={labelStyle}>IMAP Host</label>
                      <input style={inputStyle} value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Port</label>
                      <input style={{ ...inputStyle, textAlign: 'center' }} type="number" value={imapPort} onChange={(e) => setImapPort(Number(e.target.value))} />
                    </div>
                  </div>
                  <div style={rowStyle}>
                    <div>
                      <label style={labelStyle}>SMTP Host</label>
                      <input style={inputStyle} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Port</label>
                      <input style={{ ...inputStyle, textAlign: 'center' }} type="number" value={smtpPort} onChange={(e) => setSmtpPort(Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Username</label>
                    <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>

                  {/* Test Connection + Folders */}
                  {emailAccount && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={handleTestConnection}
                        disabled={testResult === 'testing'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text-dim)',
                          fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {testResult === 'testing' ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> :
                         testResult === 'success' ? <CheckCircle2 size={12} style={{ color: '#22c55e' }} /> :
                         testResult === 'failed' ? <XCircle size={12} style={{ color: '#ef4444' }} /> : null}
                        {testResult === 'testing' ? 'Testing...' : testResult === 'success' ? 'Connected' : testResult === 'failed' ? 'Failed' : 'Test Connection'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {!isImap && !isOAuth && !isToken && (
                <>
                  <div>
                    <label style={labelStyle}>Server URL</label>
                    <input style={inputStyle} value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Username</label>
                    <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} />
                  </div>
                </>
              )}

              {!isOAuth && !isToken && (
                <div>
                  <label style={labelStyle}>Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave empty to keep current)</span></label>
                  <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
              )}

              {/*
                El certificado. Solo para integraciones con servidor propio
                (correo por IMAP y DAV): en OAuth el certificado lo pone el
                proveedor y no hay nada que aceptar.

                Es el remedio del error más común de un NAS —«el certificado no
                coincide con el nombre»— y hasta ahora solo se podía marcar en el
                alta, dentro de un pliegue.
              */}
              {!isOAuth && !isToken && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  <input
                    type="checkbox"
                    checked={allowSelfSigned}
                    onChange={(e) => setAllowSelfSigned(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    Es mi servidor: acepto su certificado aunque no esté firmado por una
                    autoridad conocida o esté emitido para otro nombre.
                  </span>
                </label>
              )}

              {isOAuth && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0' }}>
                  Authenticated via Google OAuth. To re-authenticate, disconnect and reconnect.
                </div>
              )}
              {isToken && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0' }}>
                  El token está cifrado. Para sustituirlo, desconecta y vuelve a conectar esta integración.
                </div>
              )}

              <div>
                <label style={labelStyle}>Sync Interval</label>
                <select value={interval} onChange={(e) => setInterval(Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value={5}>Every 5 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every hour</option>
                </select>
              </div>

              {esCorreo && (
                <div>
                  <label style={labelStyle}>Correos del primer sync</label>
                  <select value={maxMessages} onChange={(e) => setMaxMessages(Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value={500}>500 emails</option>
                    <option value={1000}>1,000 emails</option>
                    <option value={2000}>2,000 emails</option>
                    <option value={5000}>5,000 emails</option>
                    <option value={10000}>10,000 emails (slow)</option>
                  </select>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Only affects the first sync. Subsequent syncs fetch new emails incrementally.
                  </div>
                </div>
              )}

              {/* Qué se trae esta integración. Vale para las seis (correo,
                  calendario, contactos), y sustituye al viejo «Show Folders»,
                  que solo enseñaba etiquetas grises del correo con contraseña. */}
              {connectorId && <CollectionsEditor connectorId={connectorId} connectorType={connector?.connector_type} />}
              {connectorId && connector && (
                <MappingEditor
                  connectorId={connectorId}
                  connectorType={connector.connector_type}
                  mappings={(connector.config.mappings ?? {}) as Record<string, Record<string, unknown>>}
                />
              )}

              {error && (
                <div style={{ fontSize: '0.75rem', color: 'var(--error)', padding: '4px 0' }}>{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            padding: '12px 16px', borderTop: '1px solid var(--border)',
          }}>
            <button onClick={onClose} style={{
              padding: '6px 14px', background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem',
            }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '6px 14px', background: 'var(--amber)', color: '#000',
              border: 'none', borderRadius: 'var(--radius-md)',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.8125rem', fontWeight: 500,
              opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Save
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
