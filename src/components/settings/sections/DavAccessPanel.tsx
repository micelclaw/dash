/**
 * Cómo sacar calendarios, contactos y tareas DE Micelclaw hacia aplicaciones
 * DAV. Es deliberadamente distinto del asistente de integraciones, que trae
 * datos HACIA Micelclaw.
 */
import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import * as syncSvc from '@/services/sync.service';
import { SettingSection } from '../SettingSection';

export function DavAccessPanel() {
  const [info, setInfo] = useState<syncSvc.DavAccessInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    syncSvc.getDavAccess().then((v) => { if (live) setInfo(v); }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function generate() {
    setBusy(true);
    try {
      const stamp = new Date().toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
      setToken(await syncSvc.createDavCredential(`DAV · ${stamp}`));
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, value: string) => (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 8, alignItems: 'center' }}>
      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{label}</span>
      <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)', fontSize: 12 }}>{value}</code>
      <Button variant="ghost" size="sm" onClick={() => void copy(label, value)} aria-label={`Copiar ${label}`}>
        {copied === label ? <Check size={13} /> : <Copy size={13} />}
      </Button>
    </div>
  );

  return (
    <div id="dav-access">
      <SettingSection
        title="Conecta tus aplicaciones a Micelclaw"
        description="Usa calendarios, contactos y tareas de Micelclaw desde clientes compatibles con CalDAV o CardDAV."
      >
        {!info ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
            <Loader2 size={14} className="animate-spin" /> Calculando las direcciones de esta instalación…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {row('CalDAV', info.caldav_url)}
            {row('CardDAV', info.carddav_url)}
            {row('Usuario', info.username)}

            <div style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.55 }}>
              Usa el token como contraseña. Sirve para DAVx5, Tasks.org, jtx Board y Thunderbird.
              Apple Calendar y Contactos admiten DAV; Apple Reminders no admite servidores CalDAV externos.
              {!info.password_login_supported && ' Tienes 2FA: la contraseña normal no puede usarse aquí.'}
            </div>

            {token ? (
              <div style={{ padding: 10, border: '1px solid var(--warning, #f59e0b)', borderRadius: 8, background: 'var(--surface)' }}>
                <div style={{ fontSize: 12, color: 'var(--warning, #f59e0b)', marginBottom: 6 }}>
                  Guárdalo ahora: no volverá a mostrarse.
                </div>
                {row('Token', token)}
              </div>
            ) : (
              <Button variant="secondary" onClick={() => void generate()} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                Generar credencial DAV
              </Button>
            )}

            <Link to="/settings/devices" style={{ color: 'var(--text-dim)', fontSize: 12, textDecoration: 'underline' }}>
              Ver o revocar credenciales en Dispositivos
            </Link>
          </div>
        )}
      </SettingSection>
    </div>
  );
}
