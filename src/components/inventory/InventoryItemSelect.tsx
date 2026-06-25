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

// Selector compacto (popover) para VINCULAR una línea de factura a un artículo
// del inventario. Disparador = icono Package (coloreado cuando hay vínculo); al
// abrir, busca en GET /inventory/items?search=. Reutilizable desde el editor de
// facturas (compra → purchase_in / venta → sale_out al emitir, vía el cruce
// cross-dominio del backend). Estilo inline coherente con FacturaEditorDialog.

import { useEffect, useRef, useState } from 'react';
import { Package, Search, Loader2, Check, Unlink } from 'lucide-react';
import { api } from '@/services/api';
import type { InventoryItem } from '@/modules/inventory/types';

export function InventoryItemSelect({
  value,
  onChange,
  disabled,
}: {
  /** id del artículo vinculado ('' = sin vincular). */
  value: string;
  /** Notifica el id elegido ('' al desvincular) + el nombre para mostrar. */
  onChange: (id: string, name: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Resolver el nombre del artículo vinculado al hidratar (best-effort; si el
  // endpoint falla, mostramos un texto genérico — el vínculo sigue siendo válido).
  useEffect(() => {
    let cancelled = false;
    if (!value) { setLabel(''); return; }
    api
      .get<{ data: InventoryItem }>(`/inventory/items/${value}`)
      .then((r) => { if (!cancelled) setLabel(r.data?.name ?? 'Artículo vinculado'); })
      .catch(() => { if (!cancelled) setLabel('Artículo vinculado'); });
    return () => { cancelled = true; };
  }, [value]);

  // Búsqueda con debounce mientras el popover está abierto.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get<{ data: InventoryItem[] }>('/inventory/items', { search: q || undefined, limit: 20 });
        setResults(r.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  // Cerrar al hacer click fuera.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const linked = !!value;

  return (
    <div ref={boxRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        title={linked ? `Artículo de inventario: ${label || '…'}` : 'Vincular artículo de inventario'}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 6px',
          background: linked ? 'color-mix(in srgb, var(--mod-finance) 14%, var(--bg))' : 'var(--bg)',
          border: `1px solid ${linked ? 'var(--mod-finance)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm, 4px)',
          color: linked ? 'var(--mod-finance)' : 'var(--text-muted)',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <Package size={14} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 20,
            marginTop: 4,
            width: 250,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md, 6px)',
            boxShadow: 'var(--shadow-lg)',
            padding: 8,
          }}
        >
          {linked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', marginBottom: 6, borderBottom: '1px solid var(--border)' }}>
              <Check size={13} style={{ color: 'var(--mod-finance)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label || 'Artículo vinculado'}</span>
              <button
                type="button"
                onClick={() => { onChange('', ''); setLabel(''); setOpen(false); }}
                title="Quitar vínculo"
                style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}
              >
                <Unlink size={12} /> Quitar
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar artículo…"
              style={{ flex: 1, minWidth: 0, padding: '6px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 4px)', color: 'var(--text)', fontSize: 13 }}
            />
          </div>

          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 8, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Buscando…
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                {q.trim() ? 'Sin resultados.' : 'Escribe para buscar un artículo.'}
              </div>
            ) : (
              results.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => { onChange(it.id, it.name); setLabel(it.name); setOpen(false); setQ(''); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    background: it.id === value ? 'var(--card)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm, 4px)',
                    color: 'var(--text)',
                    fontSize: 13,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
