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

/**
 * Sección "Personas de Micelclaw" del modal unificado (user_shares): picker
 * de destinatarios con avatares + permiso por persona + envío con conteo
 * fino de resultados (ok / ya-compartido / fallo) por persona×registro.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { AvatarInitials } from '@/components/shared/AvatarInitials';
import { shareTargetType } from '@/lib/share-payload';
import {
  listShareRecipients, createShare,
  type ShareRecipient, type SharePermission,
} from '@/services/shares.service';

interface PendingPerson {
  id: string;
  name: string;
  email: string | null;
  avatarPath: string | null;
  permission: SharePermission;
}

interface PeopleSectionProps {
  entityType: string;
  /** Uno o varios registros (batch del Drive/Photos). */
  ids: string[];
  entityTitle: string;
  /** Ids de usuario que YA tienen el registro (se filtran del picker). */
  alreadySharedWith?: string[];
  /** Tras compartir con éxito (refresca "Ya compartido" + indicadores). */
  onShared: () => void;
}

export function PeopleSection({ entityType, ids, entityTitle, alreadySharedWith = [], onShared }: PeopleSectionProps) {
  const [recipients, setRecipients] = useState<ShareRecipient[]>([]);
  const [people, setPeople] = useState<PendingPerson[]>([]);
  const [personInput, setPersonInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listShareRecipients()
      .then(r => { if (!cancelled) setRecipients(r); })
      .catch(() => { if (!cancelled) setRecipients([]); });
    return () => { cancelled = true; };
  }, []);

  const suggestions = (() => {
    const q = personInput.trim().toLowerCase();
    const excluded = new Set([...people.map(p => p.id), ...alreadySharedWith]);
    const pool = recipients.filter(r => !excluded.has(r.id));
    if (!q) return pool.slice(0, 6);
    return pool.filter(r =>
      (r.display_name ?? '').toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q),
    ).slice(0, 6);
  })();

  const addPerson = useCallback((r: ShareRecipient) => {
    setPeople(prev => prev.some(p => p.id === r.id) ? prev : [...prev, {
      id: r.id,
      name: r.display_name || r.email || 'Usuario',
      email: r.email,
      avatarPath: r.avatar_path,
      permission: 'view',
    }]);
    setPersonInput('');
    setShowSuggestions(false);
  }, []);

  const handleShare = useCallback(async () => {
    if (people.length === 0) return;
    setSharing(true);
    const target = shareTargetType(entityType);
    let ok = 0, already = 0, failed = 0;
    for (const person of people) {
      for (const id of ids) {
        try {
          await createShare({
            shared_with_id: person.id,
            target_type: target,
            target_id: id,
            permission: person.permission,
            title: ids.length === 1 ? entityTitle || undefined : undefined,
          });
          ok += 1;
        } catch (err) {
          if ((err as { code?: string })?.code === 'ALREADY_SHARED' || /ALREADY_SHARED|ya está compartido/i.test(String((err as Error)?.message ?? ''))) {
            already += 1;
          } else {
            failed += 1;
          }
        }
      }
    }
    setSharing(false);
    if (ok > 0) {
      toast.success(ok === 1 ? 'Compartido' : `${ok} comparticiones creadas`);
      setPeople([]);
      onShared();
    }
    if (already > 0) toast.info(already === 1 ? 'Ya estaba compartido con esa persona' : `${already} ya estaban compartidos`);
    if (failed > 0) toast.error(`${failed} no se pudieron compartir`);
  }, [people, ids, entityType, entityTitle, onShared]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
        <input
          value={personInput}
          onChange={e => { setPersonInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={e => { if (e.key === 'Enter' && suggestions[0]) addPerson(suggestions[0]); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Escribe un nombre o email…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => { if (suggestions[0]) addPerson(suggestions[0]); }}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '6px 8px', cursor: 'pointer',
            color: 'var(--text)', display: 'flex', alignItems: 'center',
          }}
        >
          <Plus size={14} />
        </button>

      </div>

      {/* Sugerencias EN FLUJO (no absolute): dentro del modal (overflow auto) y de la
          sección colapsable (overflow hidden), un dropdown absoluto se RECORTABA y no
          se veía — en flujo la lista empuja el contenido y el modal crece/scrollea. */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          maxHeight: 160, overflowY: 'auto',
        }}>
          {suggestions.map(r => {
            const name = r.display_name || r.email || 'Usuario';
            return (
              <button
                key={r.id}
                onClick={() => addPerson(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '7px 10px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  textAlign: 'left', color: 'var(--text)', fontSize: '0.8125rem',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <AvatarInitials name={name} src={r.avatar_path ?? undefined} size="sm" />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 500 }}>{name}</span>
                  {r.email && r.display_name && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{r.email}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {recipients.length === 0 && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          No hay otros usuarios en esta instancia con quien compartir.
        </p>
      )}

      {people.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {people.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
            }}>
              <AvatarInitials name={p.name} src={p.avatarPath ?? undefined} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{p.name}</span>
                {p.email && p.email !== p.name && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginLeft: 6 }}>({p.email})</span>
                )}
              </div>
              <select
                value={p.permission}
                onChange={e => setPeople(prev => prev.map(x => x.id === p.id ? { ...x, permission: e.target.value as SharePermission } : x))}
                style={selectStyle}
              >
                <option value="view">Solo lectura</option>
                <option value="edit">Puede editar</option>
              </select>
              <button
                onClick={() => setPeople(prev => prev.filter(x => x.id !== p.id))}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            onClick={() => void handleShare()}
            disabled={sharing}
            style={{
              alignSelf: 'flex-end', marginTop: 2, padding: '6px 14px',
              background: sharing ? 'var(--surface)' : 'var(--amber)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: sharing ? 'var(--text-muted)' : '#000',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: sharing ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            {sharing ? 'Compartiendo…' : 'Compartir'}
          </button>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 10px',
  fontSize: '0.8125rem',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '3px 6px',
  fontSize: '0.6875rem',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
};
