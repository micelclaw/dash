import { useEffect, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { cancelImported2fa, setupImported2fa, verifyImported2fa, type TwoFactorSetupResult } from '@/services/auth.service';

/** No credentials from this view enter the persisted auth store. Verification
 * finishes enrollment, then the ordinary password + 2FA login starts afresh. */
export function ImportedEnrollmentStep({ token, expiresAt, onDone }: { token: string; expiresAt: string; onDone(): void }) {
  const [setup, setSetup] = useState<TwoFactorSetupResult | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(Date.now() >= Date.parse(expiresAt));
  const generation = useRef(0);
  useEffect(() => { const timer = window.setTimeout(() => setExpired(true), Math.max(0, Date.parse(expiresAt) - Date.now())); return () => { window.clearTimeout(timer); generation.current++; }; }, [expiresAt]);
  async function prepare() {
    const current = generation.current; setLoading(true); setError('');
    try { const result = await setupImported2fa(token); if (current === generation.current) setSetup(result); }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'No se pudo preparar el autenticador.'); }
    finally { if (current === generation.current) setLoading(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); const current = generation.current; setLoading(true); setError('');
    try { const result = await verifyImported2fa(token, code); if (current === generation.current) { setCodes(result.backup_codes); setSetup(null); setCode(''); toast.success('Verificación en dos pasos renovada'); } }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'No se pudo verificar el código.'); }
    finally { if (current === generation.current) setLoading(false); }
  }
  async function cancel() {
    setLoading(true);
    try { if (!expired) await cancelImported2fa(token); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cancelar. Vuelve a iniciar sesión al caducar.'); }
    finally { setLoading(false); }
  }
  return <section aria-labelledby="import-enrollment-title" className="w-full max-w-md space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]/80 p-6 text-[var(--text)] backdrop-blur">
    <h1 id="import-enrollment-title" className="text-xl font-semibold">Renovar verificación en dos pasos</h1>
    {codes ? <>
      <p>Guarda estos códigos de respaldo. Se muestran una sola vez.</p>
      <ul className="grid grid-cols-2 gap-2 font-mono">{codes.map(value => <li key={value}>{value}</li>)}</ul>
      <button type="button" className="w-full rounded border p-2" onClick={onDone}>He guardado los códigos · Volver a iniciar sesión</button>
    </> : <>
      <p>Tu cuenta se ha importado. Configura un nuevo autenticador antes de iniciar sesión.</p>
      {expired ? <p role="alert">La inscripción ha caducado. Vuelve a iniciar sesión para continuar.</p> : !setup ? <button type="button" disabled={loading} className="w-full rounded border p-2" onClick={prepare}>{loading ? 'Preparando…' : 'Configurar nuevo autenticador'}</button> : <form onSubmit={verify} className="space-y-4">
        <img src={setup.qr_data_url} alt="Código QR para el nuevo autenticador" className="mx-auto h-48 w-48" />
        <details><summary>Clave manual</summary><code className="break-all select-all">{setup.secret}</code></details>
        <label className="block">Código del autenticador<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className="mt-2 w-full rounded border bg-transparent p-2" /></label>
        <button disabled={loading || code.length !== 6} className="w-full rounded border p-2">{loading ? 'Verificando…' : 'Verificar'}</button>
      </form>}
      {error && <p role="alert">{error}</p>}
      <button type="button" disabled={loading} className="w-full rounded border p-2" onClick={expired ? onDone : cancel}>{expired ? 'Volver a iniciar sesión' : 'Cancelar'}</button>
    </>}
  </section>;
}
