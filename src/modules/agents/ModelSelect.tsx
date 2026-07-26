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

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Cpu, Loader2, Search } from 'lucide-react';
import { api } from '@/services/api';
import { getProviderIcon } from '@/config/provider-icons';
import { PROVIDER_COLORS, PROVIDER_LABELS } from '@/modules/gateway/tabs/models/constants';

interface ModelOption { id: string; provider: string; name: string }

/**
 * Selector de modelo de la tarjeta del agente (extraído del inline de
 * AgentDetail). Cada opción lleva el icono de su proveedor (los mismos de
 * Gateway → Models) + nombre legible grande, con el path completo en el
 * tooltip. Ordenado por proveedor (agrupación visual sin cabeceras).
 */
export function ModelSelect({ value, saving, onSelect }: {
  /** Modelo actual del agente (fully-qualified, `provider/modelId`). */
  value: string;
  /** Mutación en vuelo (POST set-model) → spinner en el trigger. */
  saving: boolean;
  onSelect: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Fetch lazy al abrir — conservamos los objetos {id, provider, name}
  // completos (antes se descartaban provider/name y no había forma de pintar
  // el icono sin otra llamada).
  useEffect(() => {
    if (!open || models.length > 0) return;
    setLoading(true);
    api.get<{ data: ModelOption[] }>('/managed-agents/models')
      .then(res => setModels(
        [...res.data].sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name)),
      ))
      .catch(() => setModels([
        { id: 'anthropic/claude-haiku-4-5', provider: 'anthropic', name: 'claude-haiku-4-5' },
        { id: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', name: 'claude-sonnet-4-6' },
        { id: 'anthropic/claude-opus-4-6', provider: 'anthropic', name: 'claude-opus-4-6' },
      ]))
      .finally(() => setLoading(false));
  }, [open, models.length]);

  // Cierre por click-fuera y Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const fq = filter.trim().toLowerCase();
  const shown = fq
    ? models.filter(m =>
        m.id.toLowerCase().includes(fq) ||
        m.provider.toLowerCase().includes(fq) ||
        m.name.toLowerCase().includes(fq))
    : models;

  // Trigger con el MISMO lenguaje visual que las opciones y que el badge de
  // la tarjeta del tree (fuera la píldora ámbar): icono del proveedor en
  // cuadro tintado + nombre + label del proveedor.
  const valueSlash = value.indexOf('/');
  const valueProvider = valueSlash > 0 ? value.slice(0, valueSlash) : '';
  const valueRest = valueSlash > 0 ? value.slice(valueSlash + 1) : value;
  const ValueIcon = valueProvider ? getProviderIcon(valueProvider) : null;
  const valueColor = PROVIDER_COLORS[valueProvider?.toLowerCase()] ?? 'var(--text-dim)';

  return (
    <div ref={ref} style={{ position: 'relative', marginTop: 6 }}>
      <button
        onClick={() => { setFilter(''); setOpen(!open); }}
        disabled={saving}
        title={value}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 240,
          maxWidth: '100%',
          background: 'var(--surface)',
          border: `1px solid ${open ? 'var(--amber)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          padding: '7px 10px',
          cursor: saving ? 'wait' : 'pointer',
          fontFamily: 'var(--font-sans)',
          transition: 'var(--transition-fast)',
          textAlign: 'left',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        <span style={{
          width: 28, height: 28,
          borderRadius: 'var(--radius-sm)',
          background: `${valueColor}15`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {saving
            ? <Loader2 size={15} className="animate-spin" style={{ color: valueColor }} />
            : ValueIcon ? <ValueIcon size={20} style={{ color: valueColor }} /> : <Cpu size={15} style={{ color: valueColor }} />}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{
            fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {valueRest}
          </span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
            {PROVIDER_LABELS[valueProvider] ?? valueProvider}
          </span>
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-dim)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          background: 'rgba(24, 24, 27, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 50,
          minWidth: 320,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 400,
        }}>
          {/* Buscador: filtra por id, proveedor y nombre. */}
          <div style={{ position: 'relative', padding: 6, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <Search size={13} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              autoFocus
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Buscar modelo…"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '6px 8px 6px 28px', fontSize: '0.8125rem',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '10px 14px', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                Cargando modelos...
              </div>
            ) : shown.length === 0 ? (
              <div style={{ padding: '10px 14px', fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Sin coincidencias
              </div>
            ) : shown.map(m => {
              const Icon = getProviderIcon(m.provider);
              const color = PROVIDER_COLORS[m.provider?.toLowerCase()] ?? 'var(--text-dim)';
              const current = m.id === value;
              return (
                <button
                  key={m.id}
                  onClick={() => { onSelect(m.id); setOpen(false); }}
                  title={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '9px 14px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    transition: 'var(--transition-fast)',
                    textAlign: 'left',
                    gap: 10,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Icono del proveedor — mismo mapa que Gateway → Models. */}
                  <span style={{ width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {Icon ? <Icon size={16} style={{ color }} /> : <Cpu size={14} style={{ color }} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{
                      fontSize: '0.875rem',
                      fontWeight: current ? 600 : 400,
                      color: current ? 'var(--amber)' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {m.name}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                      {PROVIDER_LABELS[m.provider] ?? m.provider}
                    </span>
                  </span>
                  {current && <span style={{ fontSize: '0.625rem', color: 'var(--amber)', opacity: 0.8, flexShrink: 0 }}>actual</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
