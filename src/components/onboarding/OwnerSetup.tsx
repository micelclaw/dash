import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createOwner, confirmInitialSession } from '@/services/initial-setup.service';
import { useInitialStatus } from '@/hooks/use-initial-status';
import { useAuthStore } from '@/stores/auth.store';
import { emptyProgress, writeProgress } from './progress';

export function OwnerSetup({ onExisting }: { onExisting: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  // Passwords remain only in this mounted form, never in storage or progress.
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [created, setCreated] = useState(false); const [reconciling, setReconciling] = useState(false);
  const check = useInitialStatus(reconciling);

  useEffect(() => {
    if (!reconciling || check.phase !== 'known' || !check.status) return;
    setReconciling(false);
    if (check.status.requires_setup) {
      setError('Core confirma que el propietario todavía no existe. Puedes volver a enviar el formulario.');
    } else {
      setCreated(true);
      setError('El alta ya terminó o existe un propietario. Inicia sesión; no repitas la creación.');
    }
  }, [reconciling, check.phase, check.status]);

  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy || created || reconciling) return;
    if (password !== confirmation) { setError('Las contraseñas no coinciden'); return; }
    setBusy(true); setError('');
    try {
      const result = await createOwner({ display_name: name.trim(), email: email.trim(), password });
      setCreated(true);
      const user = { ...result.data.user, tier: result.tier ?? 'free' as const };
      if (result.data.access_token) useAuthStore.getState().setAuth(user, { accessToken: result.data.access_token, refreshToken: result.data.refresh_token ?? '', refreshTokenId: result.data.refresh_token_id });
      else {
        const login = await useAuthStore.getState().login(email.trim(), password);
        if ('needs2fa' in login) throw new Error('Confirma tu sesión desde el login');
      }
      const confirmed = await confirmInitialSession();
      if (confirmed.id !== user.id || confirmed.role !== 'owner') throw new Error('No se pudo confirmar la sesión del propietario');
      sessionStorage.removeItem('claw-explicit-logout');
      writeProgress(window.location.origin, confirmed.id, emptyProgress());
      setPassword(''); setConfirmation(''); navigate('/onboarding', { replace: true });
    } catch (err) {
      const status = err && typeof err === 'object' && 'status' in err ? err.status : undefined;
      if (status === 400 || status === 422) setError(err instanceof Error ? err.message : 'Revisa los datos del formulario');
      else {
        // Network/5xx/409 and session confirmation can be ambiguous after INSERT.
        // Resolve status first; never automatically repeat the owner's POST.
        setError('No se pudo confirmar el resultado del alta. Comprobando si el propietario ya existe…');
        setReconciling(true); check.retry();
      }
    } finally { setBusy(false); }
  }
  const locked = busy || created || reconciling;
  return <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--text)]">
    <form onSubmit={submit} className="w-full max-w-md space-y-4 border border-[var(--border)] bg-[var(--surface)] rounded-xl p-6">
      <h1 className="text-xl font-semibold">Crear propietario</h1><p>Primera entrada de Micelclaw. Esta cuenta administrará tu instalación.</p>
      <label className="block">Nombre<Input required autoComplete="name" value={name} onChange={e => setName(e.target.value)} disabled={locked}/></label>
      <label className="block">Correo<Input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={locked}/></label>
      <label className="block">Contraseña<Input required type="password" minLength={12} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={locked}/></label>
      <label className="block">Confirmar contraseña<Input required type="password" minLength={12} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={locked}/></label>
      <p className="text-sm">12 caracteres como mínimo, mayúscula, número y símbolo.</p>
      {error && <p role="alert">{error}</p>}
      {reconciling && <div role="status"><p>{check.phase === 'unavailable' ? 'Servicio temporalmente no disponible. El formulario y sus valores se conservan.' : 'Comprobando el estado del alta…'}</p><p>Reintento {check.attempt} de 6</p><Button type="button" variant="outline" onClick={check.retry}>Reintentar comprobación</Button></div>}
      {created ? <><p>Propietario creado o alta ya completada. Falta confirmar tu sesión; no repitas el alta.</p><Button type="button" onClick={onExisting}>Ir al login</Button></> : <Button disabled={locked} type="submit">{busy ? 'Creando y confirmando sesión…' : 'Crear propietario'}</Button>}
    </form>
  </main>;
}
