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

import { Star, Cpu, Plus, X, Check, Key, Trash2, Pencil, Download, HardDrive } from 'lucide-react';
import { getProviderIcon } from '@/config/provider-icons';
import { StatusPill } from '../../components/StatusPill';
import type { CatalogModel } from '../../types';
import { PROVIDER_COLORS, formatCtx, formatBytes } from './constants';
import { ActionButton } from './buttons';

export function CatalogRow({ model, isMobile, isHovered, onHover, mutatingModel, isAdding, addProgress, onAdd, onRemove, onConfigure, onEdit, onDeleteFromDisk }: {
  model: CatalogModel;
  isMobile: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  mutatingModel: string | null;
  /** El +Add está en curso y carga el modelo en VRAM → la tarjeta entera se vuelve barra de carga. */
  isAdding: boolean;
  /** 0..100 — progreso (fake-progress por tiempo) de esa barra. */
  addProgress: number;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onConfigure: (model: CatalogModel) => void;
  /** Set for user-managed (custom-api-*, ollama, vllm, sglang, lm-studio)
   *  configured models — opens the modal to edit contextWindow / maxTokens. */
  onEdit?: (model: CatalogModel) => void;
  /** Solo Ollama: borrado HARD del modelo en disco (libera espacio). */
  onDeleteFromDisk?: (model: CatalogModel) => void;
}) {
  const providerColor = PROVIDER_COLORS[model.provider?.toLowerCase()] ?? 'var(--text-dim)';
  const ProviderIcon = getProviderIcon(model.provider);
  const isMutating = mutatingModel === model.key;

  // Mientras se añade (carga en VRAM), la tarjeta ENTERA es una barra de progreso.
  if (isAdding) {
    return (
      <div style={{
        position: 'relative', overflow: 'hidden',
        padding: '10px 14px', minHeight: 56, boxSizing: 'border-box',
        background: 'var(--card)', border: '1px solid var(--amber)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${addProgress}%`, background: 'var(--amber)', opacity: 0.18,
          transition: 'width 0.3s ease',
        }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <Download size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', color: 'var(--text)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Cargando en VRAM… {model.name || model.key}
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--amber)', flexShrink: 0 }}>
            {Math.round(addProgress)}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => onHover(model.key)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        background: isHovered ? 'var(--surface-hover)' : 'var(--card)',
        border: `1px solid ${model.configured ? '#10b98130' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        transition: 'var(--transition-fast)',
        flexWrap: isMobile ? 'wrap' : undefined,
      }}
    >
      {/* Provider icon */}
      <div style={{
        width: 34, height: 34,
        borderRadius: 'var(--radius-sm)',
        background: `${providerColor}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {ProviderIcon
          ? <ProviderIcon size={26} style={{ color: providerColor }} />
          : <Cpu size={16} style={{ color: providerColor }} />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.8125rem', fontWeight: 500,
            color: 'var(--text)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {model.name || model.key}
          </span>
          {/* Tag 1: espacio en disco (solo Ollama) */}
          {model.provider === 'ollama' && model.size_bytes != null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: '0.625rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              background: 'var(--surface)', padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
            }} title="Espacio en disco">
              <HardDrive size={9} /> {formatBytes(model.size_bytes)}
            </span>
          )}
          {/* Tag 2: contexto. Asignado (num_ctx) o, en Ollama sin configurar, por defecto. */}
          {(model.context_window || model.provider === 'ollama') && (
            <span style={{
              fontSize: '0.625rem',
              color: model.context_window ? 'var(--text-dim)' : 'var(--text-muted)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              background: 'var(--surface)', padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
              fontStyle: model.context_window ? 'normal' : 'italic',
            }} title={model.context_window
              ? 'Contexto asignado (num_ctx)'
              : 'Sin asignar — Ollama usaría su contexto por defecto. Añádelo y ajústalo con ⚙ Editar.'}>
              {model.context_window ? formatCtx(model.context_window) : 'ctx def'}
            </span>
          )}
          {model.configured && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#10b98120', color: '#10b981',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              <Check size={9} /> Configured
            </span>
          )}
          {model.is_default && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: 'var(--amber-dim)', color: 'var(--amber)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              <Star size={9} /> DEFAULT
            </span>
          )}
          {model.available
            ? <StatusPill status="available" />
            : model.local
              // Modelo local (Ollama) configurado pero ausente de `/api/tags` — el
              // usuario lo borró con `ollama rm`. NO es un problema de auth: está sin
              // descargar. (El backend ya lo marca available:false/missing:true.)
              ? <StatusPill status="warn" label="No descargado" />
              : <StatusPill status="no_auth" />
          }
        </div>
        <div style={{
          fontSize: '0.75rem', color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)', marginTop: 2,
        }}>
          <span style={{ textTransform: 'capitalize' }}>{model.provider}</span>
          {model.input_type && model.input_type !== 'text' && (
            <span> &middot; {model.input_type}</span>
          )}
          {model.local && <span> &middot; local</span>}
        </div>
      </div>

      {/* Action */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Edit ctx/maxTokens — only for configured user-managed providers */}
        {onEdit && model.configured && (
          <ActionButton
            icon={<Pencil size={12} />}
            label="Edit"
            loading={false}
            onClick={() => onEdit(model)}
            variant="secondary"
          />
        )}
        {!model.is_default && (
          model.configured ? (
            <ActionButton
              icon={<X size={12} />}
              label="Remove"
              loading={isMutating}
              onClick={() => onRemove(model.key)}
              variant="danger"
            />
          ) : model.available ? (
            <ActionButton
              icon={<Plus size={12} />}
              label="Add"
              loading={isMutating}
              onClick={() => onAdd(model.key)}
              variant="primary"
            />
          ) : (
            // Provider has no credentials yet — open the wizard so the user
            // can paste an API key (standard providers) or set up a custom
            // base URL + key (custom-api-* providers). After success the
            // wizard adds the model automatically.
            <ActionButton
              icon={<Key size={12} />}
              label="Configure provider"
              loading={isMutating}
              onClick={() => onConfigure(model)}
              variant="secondary"
            />
          )
        )}
        {/* Borrar de disco (hard delete) — solo Ollama. Distinto del Remove
            (que solo quita de la config de chat). */}
        {onDeleteFromDisk && model.provider === 'ollama' && (
          <ActionButton
            icon={<Trash2 size={12} />}
            label=""
            title="Borrar del disco (libera espacio; tendrás que volver a descargarlo)"
            loading={isMutating}
            onClick={() => onDeleteFromDisk(model)}
            variant="danger"
          />
        )}
      </div>
    </div>
  );
}
