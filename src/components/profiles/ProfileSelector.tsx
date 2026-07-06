/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved. Proprietary — see LICENSE. https://micelclaw.com
 */

// Selector de perfil ERP (multi-perfil), en la cabecera de Finanzas e Inventario.
// Cambiar de perfil re-scopea SOLO esos dos módulos (el header X-Claw-Profile-Id de
// api.ts + el evento claw:profile-changed). NO vive en la topbar global del SO.

import { useEffect, useState } from 'react';
import { ChevronDown, Check, Plus, Settings2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useProfileStore } from '@/stores/profile.store';
import { profileColorHex } from './constants';
import { CreateProfileDialog, ManageProfilesDialog } from './ProfileDialogs';

export function ProfileSelector() {
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const loaded = useProfileStore((s) => s.loaded);
  const loadProfiles = useProfileStore((s) => s.loadProfiles);
  const setActiveProfile = useProfileStore((s) => s.setActiveProfile);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => { if (!loaded) void loadProfiles(); }, [loaded, loadProfiles]);

  const active = profiles.find((p) => p.id === activeProfileId) ?? null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Perfil ERP activo"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--text)',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: profileColorHex(active?.color), flex: '0 0 auto' }} />
            {active?.icon && <span style={{ fontSize: 14 }}>{active.icon}</span>}
            <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {active?.name ?? 'Perfil'}
            </span>
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" style={{ minWidth: 220 }}>
          {profiles.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => void setActiveProfile(p.id)} style={{ gap: 8 }}>
              <Check size={14} style={{ opacity: p.id === activeProfileId ? 1 : 0, flex: '0 0 auto' }} />
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: profileColorHex(p.color), flex: '0 0 auto' }} />
              {p.icon && <span>{p.icon}</span>}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)} style={{ gap: 8 }}>
            <Plus size={14} /> Crear perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setManageOpen(true)} style={{ gap: 8 }}>
            <Settings2 size={14} /> Gestionar perfiles
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateProfileDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ManageProfilesDialog open={manageOpen} onClose={() => setManageOpen(false)} onCreate={() => setCreateOpen(true)} />
    </>
  );
}
