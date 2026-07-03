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

import { Star, Cpu, Image, X, SlidersHorizontal, HardDrive } from 'lucide-react';
import { getProviderIcon } from '@/config/provider-icons';
import { StatusPill } from '../../components/StatusPill';
import type { GatewayModel } from '../../types';
import { PROVIDER_COLORS, formatCtx, formatBytes } from './constants';
import { ActionButton, SetDefaultButton } from './buttons';

export function ConfiguredRow({ model, isMobile, isHovered, onHover, settingDefault, onSetDefault, mutatingModel, onRemove, onEditOllama, contextWindow, sizeBytes }: {
  model: GatewayModel;
  isMobile: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  settingDefault: string | null;
  onSetDefault: (m: GatewayModel) => void;
  mutatingModel: string | null;
  onRemove: (key: string) => void;
  onEditOllama?: (m: GatewayModel) => void;
  /** Contexto (ventana) del modelo — se muestra para todos los providers. */
  contextWindow?: number | null;
  /** Tamaño en disco — solo modelos locales (Ollama/LM Studio); null en el resto. */
  sizeBytes?: number | null;
}) {
  const providerColor = PROVIDER_COLORS[model.provider?.toLowerCase()] ?? 'var(--text-dim)';
  const ProviderIcon = getProviderIcon(model.provider);

  return (
    <div
      onMouseEnter={() => onHover(model.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px',
        background: isHovered ? 'var(--surface-hover)' : 'var(--card)',
        border: `1px solid ${model.is_default ? 'var(--amber)40' : 'var(--border)'}`,
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
            fontSize: '0.875rem', fontWeight: 500,
            color: 'var(--text)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {model.model || model.id}
          </span>
          {/* Tamaño en disco — solo local (Ollama/LM Studio; sizeBytes null en el resto) */}
          {sizeBytes != null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: '0.625rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              background: 'var(--surface)', padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
            }} title="Espacio en disco">
              <HardDrive size={9} /> {formatBytes(sizeBytes)}
            </span>
          )}
          {/* Contexto — para todos los providers */}
          {contextWindow != null && (
            <span style={{
              fontSize: '0.625rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              background: 'var(--surface)', padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
            }} title="Contexto (ventana del modelo)">
              {formatCtx(contextWindow)}
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
          {model.is_image && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#8b5cf620', color: '#8b5cf6',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              <Image size={9} /> IMAGE
            </span>
          )}
          {model.status && <StatusPill status={model.status} />}
          {model.orphan && (
            <span title="Provider no existe en openclaw.json. Esta entrada es basura residual: b\u00f3rrala o configura el provider." style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#ef444420', color: '#ef4444',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              \u26a0 ORPHAN
            </span>
          )}
        </div>
        <div style={{
          fontSize: '0.75rem', color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)', marginTop: 2,
          textTransform: 'capitalize',
        }}>
          {model.provider}
          {model.is_fallback && ' · fallback'}
          {model.orphan && ' · provider eliminado'}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {model.provider === 'ollama' && onEditOllama && (
          <ActionButton
            icon={<SlidersHorizontal size={12} />}
            label="Editar"
            loading={false}
            onClick={() => onEditOllama(model)}
            variant="secondary"
          />
        )}
        {!model.is_default && (
          <SetDefaultButton
            onClick={() => onSetDefault(model)}
            loading={settingDefault === model.id}
          />
        )}
        <ActionButton
          icon={<X size={12} />}
          label="Remove"
          loading={mutatingModel === model.id}
          onClick={() => onRemove(model.id)}
          variant="danger"
        />
      </div>
    </div>
  );
}
