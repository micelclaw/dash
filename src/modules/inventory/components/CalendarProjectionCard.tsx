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

import { useEffect, useState, type CSSProperties } from 'react';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

/**
 * Checkboxes "PROYECTAR" por kind del calendario espejo "Inventory"
 * (users.settings.inventory.calendar_projection). El backend YA lee este ajuste
 * — `getProjectionSettings` en core/src/services/inventory/calendar-projector.ts,
 * con los cinco kinds en `true` por defecto — pero no había forma de tocarlo
 * desde el dash.
 *
 * Contrato con el backend, dos detalles que importan:
 *  - clave ausente = ACTIVADO (el backend hace `{...DEFAULT_SETTINGS, ...proj}`),
 *    por eso aquí "on" es `!== false` y no `=== true`: así no hay una segunda
 *    copia de los defaults que se pueda desincronizar.
 *  - los espejos ya creados no se borran al apagar un kind: cada artículo aplica
 *    el cambio la próxima vez que se sincroniza (crear/editar/prestar/devolver).
 *    Se dice en la tarjeta en vez de fingir efecto inmediato.
 */

type ProjectionKind = 'purchase' | 'warranty' | 'maintenance' | 'loans' | 'policies';
type Projection = Partial<Record<ProjectionKind, boolean>>;

const KINDS: Array<{ k: ProjectionKind; label: string; hint: string }> = [
  { k: 'purchase', label: 'Purchases', hint: 'Purchase date as a past milestone' },
  { k: 'warranty', label: 'Warranties', hint: 'Expiry date, reminder 30 days before' },
  { k: 'maintenance', label: 'Maintenance', hint: 'Next due date + jobs already done' },
  { k: 'loans', label: 'Loans', hint: 'Expected return date, reminder 1 day before' },
  { k: 'policies', label: 'Policies', hint: 'Renewal and charge dates (insurance category)' },
];

const cardStyle: CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', padding: 16,
};
const titleStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)',
};

export function CalendarProjectionCard() {
  const [proj, setProj] = useState<Projection | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<{ data: { inventory?: { calendar_projection?: Projection } } }>('/settings')
      .then((res) => { if (alive) setProj(res.data?.inventory?.calendar_projection ?? {}); })
      .catch(() => { if (alive) setProj({}); });
    return () => { alive = false; };
  }, []);

  if (proj === null) return null;

  const isOn = (k: ProjectionKind) => proj[k] !== false;

  const toggle = async (k: ProjectionKind) => {
    if (saving) return;
    // Se envían los cinco explícitos: un PATCH parcial funcionaría (deepMerge),
    // pero dejar el objeto completo hace que lo guardado se lea igual que se ve.
    const next: Record<ProjectionKind, boolean> = {
      purchase: isOn('purchase'), warranty: isOn('warranty'), maintenance: isOn('maintenance'),
      loans: isOn('loans'), policies: isOn('policies'),
    };
    next[k] = !isOn(k);
    const prev = proj;
    setProj(next);
    setSaving(true);
    try {
      await api.patch('/settings', { inventory: { calendar_projection: next } });
    } catch {
      setProj(prev);
      toast.error('Could not update the Inventory calendar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={titleStyle}><CalendarDays size={12} /> Inventory calendar</div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text)', marginTop: 6 }}>
        What gets mirrored into the “Inventory” calendar
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2, maxWidth: 620 }}>
        These dates show up in Calendar (and on your phone over CalDAV). Turning one off stops new
        mirrors; each item drops the ones it already has the next time it changes.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        {KINDS.map(({ k, label, hint }) => (
          <label
            key={k}
            title={hint}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, cursor: saving ? 'default' : 'pointer',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '6px 10px', background: 'var(--surface)', minWidth: 190,
            }}
          >
            <input
              type="checkbox"
              checked={isOn(k)}
              disabled={saving}
              onChange={() => void toggle(k)}
            />
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text)', fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
