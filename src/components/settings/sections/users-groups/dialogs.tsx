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

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUsersStore } from '@/stores/users.store';
import { createGroup } from '@/services/groups.service';
import type { UserRole } from '@/types/users';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PW_RULES = [
  { t: '12+ caracteres', ok: (p: string) => p.length >= 12 },
  { t: 'Una mayúscula', ok: (p: string) => /[A-Z]/.test(p) },
  { t: 'Un número', ok: (p: string) => /[0-9]/.test(p) },
  { t: 'Un símbolo', ok: (p: string) => /[^A-Za-z0-9]/.test(p) },
];
const pwStrong = (p: string) => PW_RULES.every((r) => r.ok(p));
const label = 'block text-xs text-[var(--text-dim)] mb-1';

function PwChecklist({ pw }: { pw: string }) {
  return (
    <div className="grid grid-cols-2 gap-1 text-xs">
      {PW_RULES.map((r) => (
        <span key={r.t} className={r.ok(pw) ? 'text-[var(--green,#22c55e)]' : 'text-[var(--text-dim)]'}>
          {r.ok(pw) ? '✓' : '○'} {r.t}
        </span>
      ))}
    </div>
  );
}

export function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const store = useUsersStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!displayName.trim() || !email.trim()) return toast.error('Nombre y correo son obligatorios');
    if (!EMAIL_RE.test(email)) return toast.error('Correo no válido');
    if (!pwStrong(password)) return toast.error('La contraseña no cumple los requisitos');
    setSaving(true);
    try {
      await store.createUser({ display_name: displayName.trim(), email: email.trim(), password, role });
      toast.success(`Usuario "${displayName}" creado`);
      setDisplayName(''); setEmail(''); setPassword(''); setRole('user');
      onCreated(); onOpenChange(false);
    } catch (e) { toast.error((e as Error).message || 'No se pudo crear'); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Crear usuario</DialogTitle>
        <div className="mt-3 flex flex-col gap-3">
          <div><label className={label}>Nombre</label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus /></div>
          <div><label className={label}>Correo electrónico</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className={label}>Contraseña</label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><div className="mt-1.5"><PwChecklist pw={password} /></div></div>
          <div>
            <label className={label}>Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
              className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--bg-input,var(--bg))] px-3 text-sm text-[var(--text)]">
              <option value="user">Usuario</option><option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Creando…' : 'Crear'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SetPasswordDialog({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useUsersStore();
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!pwStrong(password)) return toast.error('La contraseña no cumple los requisitos');
    setSaving(true);
    try { await store.setPassword(userId, password); toast.success('Contraseña actualizada'); setPassword(''); onOpenChange(false); }
    catch (e) { toast.error((e as Error).message || 'Error'); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Cambiar contraseña</DialogTitle>
        <div className="mt-3 flex flex-col gap-2">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nueva contraseña" autoFocus />
          <PwChecklist pw={password} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ResetLinkDialog({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useUsersStore();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const gen = async () => {
    setLoading(true);
    try { const r = await store.generateResetLink(userId); setUrl(r.reset_url); }
    catch (e) { toast.error((e as Error).message || 'Error'); } finally { setLoading(false); }
  };
  const copy = () => { if (url) { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setUrl(null); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Enlace de restablecimiento</DialogTitle>
        <div className="mt-3 flex flex-col gap-3">
          {!url ? (
            <>
              <p className="text-xs text-[var(--text-dim)]">Genera un enlace de un solo uso (1 hora) para que el usuario establezca su contraseña.</p>
              <Button onClick={gen} disabled={loading}>{loading ? 'Generando…' : 'Generar enlace'}</Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-[var(--border)] bg-[var(--bg-input,var(--bg))] px-2 py-1.5 text-xs text-[var(--text)]">{url}</code>
              <Button variant="outline" size="icon" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CreateGroupDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!name.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true);
    try { await createGroup({ name: name.trim(), description: description.trim() || undefined }); toast.success(`Grupo "${name}" creado`); setName(''); setDescription(''); onCreated(); onOpenChange(false); }
    catch (e) { toast.error((e as Error).message || 'No se pudo crear'); } finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Crear grupo</DialogTitle>
        <div className="mt-3 flex flex-col gap-3">
          <div><label className={label}>Nombre</label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div><label className={label}>Descripción (opcional)</label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Creando…' : 'Crear'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { pwStrong };
