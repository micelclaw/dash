/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Diálogos del multi-perfil ERP: crear un perfil (libro aislado), gestionar
// (renombrar / predeterminar / borrar) y borrar con confirmación por escrito
// (borra un LIBRO ERP entero → irreversible).

import { useState } from 'react';
import { toast } from 'sonner';
import { Star, Pencil, Trash2, Check, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/services/api';
import { useProfileStore } from '@/stores/profile.store';
import type { ErpProfile } from '@/services/profiles.service';
import { PROFILE_COLORS, PROFILE_ICONS, profileColorHex } from './constants';

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 };

// ─── Crear perfil ────────────────────────────────────────────────────────────
export function CreateProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createProfile = useProfileStore((s) => s.createProfile);
  const setActiveProfile = useProfileStore((s) => s.setActiveProfile);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'business' | 'personal'>('business');
  const [color, setColor] = useState('blue');
  const [icon, setIcon] = useState('🏢');
  const [currency, setCurrency] = useState('EUR');
  const [busy, setBusy] = useState(false);

  const reset = () => { setName(''); setKind('business'); setColor('blue'); setIcon('🏢'); setCurrency('EUR'); };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const created = await createProfile({ name: name.trim(), kind, color, icon, base_currency: currency.toUpperCase().slice(0, 3) || 'EUR' });
      await setActiveProfile(created.id);
      toast.success(`Perfil "${created.name}" creado`);
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo crear el perfil');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent style={{ maxWidth: 460 }}>
        <DialogHeader>
          <DialogTitle>Nuevo perfil ERP</DialogTitle>
          <DialogDescription>Un libro contable + inventario totalmente separado del resto.</DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          <div>
            <label style={lbl}>Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Consultoría SL" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
          </div>
          <div>
            <label style={lbl}>Tipo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['personal', 'business'] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)} type="button"
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    border: `1px solid ${kind === k ? 'var(--mod-finance)' : 'var(--border)'}`,
                    background: kind === k ? 'color-mix(in srgb, var(--mod-finance) 12%, transparent)' : 'var(--surface)',
                    color: kind === k ? 'var(--text)' : 'var(--text-muted)',
                  }}>
                  {k === 'personal' ? 'Personal' : 'Negocio'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <label style={lbl}>Icono</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 200 }}>
                {PROFILE_ICONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => setIcon(ic)}
                    style={{
                      width: 30, height: 30, borderRadius: 7, cursor: 'pointer', fontSize: 15, lineHeight: '30px',
                      border: `1px solid ${icon === ic ? 'var(--mod-finance)' : 'var(--border)'}`,
                      background: icon === ic ? 'color-mix(in srgb, var(--mod-finance) 12%, transparent)' : 'var(--surface)',
                    }}>{ic}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>Color</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 30 }}>
                {PROFILE_COLORS.map((c) => (
                  <button key={c.key} type="button" onClick={() => setColor(c.key)} aria-label={c.key}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', background: c.hex,
                      border: color === c.key ? '2px solid var(--text)' : '2px solid transparent',
                      boxShadow: color === c.key ? '0 0 0 1px var(--surface)' : 'none',
                    }} />
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>Divisa</label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} style={{ width: 80, textTransform: 'uppercase' }} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim() || busy}>{busy ? 'Creando…' : 'Crear perfil'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Borrar perfil (confirmación por escrito) ────────────────────────────────
function DeleteProfileDialog({ profile, onClose }: { profile: ErpProfile | null; onClose: () => void }) {
  const deleteProfile = useProfileStore((s) => s.deleteProfile);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const match = !!profile && typed.trim() === profile.name;

  const submit = async () => {
    if (!profile || !match || busy) return;
    setBusy(true);
    try {
      await deleteProfile(profile.id);
      toast.success(`Perfil "${profile.name}" eliminado`);
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar el perfil');
    } finally {
      setBusy(false);
      setTyped('');
    }
  };

  return (
    <Dialog open={!!profile} onOpenChange={(o) => { if (!o) { setTyped(''); onClose(); } }}>
      <DialogContent style={{ maxWidth: 440 }}>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} style={{ color: 'var(--error)' }} /> Eliminar «{profile?.name}»
          </DialogTitle>
          <DialogDescription>
            Borra un LIBRO ERP COMPLETO: sus cuentas, asientos, facturas, artículos de inventario,
            empresa emisora y numeración. <strong>No se puede deshacer.</strong>
          </DialogDescription>
        </DialogHeader>
        <div style={{ padding: '4px 0' }}>
          <label style={lbl}>Escribe «{profile?.name}» para confirmar</label>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={profile?.name ?? ''}
            onKeyDown={(e) => { if (e.key === 'Enter' && match) submit(); }} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setTyped(''); onClose(); }} disabled={busy}>Cancelar</Button>
          <Button variant="destructive" onClick={submit} disabled={!match || busy}>{busy ? 'Eliminando…' : 'Eliminar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Gestionar perfiles ──────────────────────────────────────────────────────
export function ManageProfilesDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: () => void }) {
  const profiles = useProfileStore((s) => s.profiles);
  const setDefault = useProfileStore((s) => s.setDefault);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [toDelete, setToDelete] = useState<ErpProfile | null>(null);
  const canDeleteAny = profiles.length > 1;

  const startRename = (p: ErpProfile) => { setEditing(p.id); setEditName(p.name); };
  const commitRename = async (p: ErpProfile) => {
    const n = editName.trim();
    setEditing(null);
    if (!n || n === p.name) return;
    try { await updateProfile(p.id, { name: n }); } catch (e) { toast.error(e instanceof ApiError ? e.message : 'No se pudo renombrar'); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent style={{ maxWidth: 560 }}>
          <DialogHeader>
            <DialogTitle>Gestionar perfiles</DialogTitle>
            <DialogDescription>Cada perfil es un libro ERP aislado. Siempre queda al menos uno.</DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0', maxHeight: 360, overflow: 'auto' }}>
            {profiles.map((p) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface)',
              }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: profileColorHex(p.color), flex: '0 0 auto' }} />
                <span style={{ fontSize: 15 }}>{p.icon ?? '📘'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editing === p.id ? (
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                      onBlur={() => commitRename(p)} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(p); if (e.key === 'Escape') setEditing(null); }}
                      style={{ height: 30 }} />
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                        {p.is_default && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--mod-finance)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Star size={11} fill="currentColor" /> Predeterminado
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {p.kind === 'personal' ? 'Personal' : 'Negocio'} · {p.base_currency}
                      </div>
                    </>
                  )}
                </div>
                {editing !== p.id && (
                  <div style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
                    {!p.is_default && (
                      <button title="Predeterminar" onClick={() => setDefault(p.id)}
                        style={iconBtn}><Star size={15} /></button>
                    )}
                    <button title="Renombrar" onClick={() => startRename(p)} style={iconBtn}><Pencil size={15} /></button>
                    {canDeleteAny && !p.is_default && (
                      <button title="Eliminar" onClick={() => setToDelete(p)} style={{ ...iconBtn, color: 'var(--error)' }}><Trash2 size={15} /></button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter style={{ justifyContent: 'space-between' }}>
            <Button variant="ghost" onClick={() => { onClose(); onCreate(); }}>
              <Check size={14} style={{ display: 'none' }} />＋ Crear perfil
            </Button>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteProfileDialog profile={toDelete} onClose={() => setToDelete(null)} />
    </>
  );
}

const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)',
};
