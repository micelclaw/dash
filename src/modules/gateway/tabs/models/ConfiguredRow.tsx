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

import { Star, Cpu, Image, Undo2, X, SlidersHorizontal } from 'lucide-react';
import { getProviderIcon } from '@/config/provider-icons';
import { AgentAvatar } from '@/components/shared/AgentAvatar';
import type { ManagedAgent } from '@/modules/agents/types';
import { StatusPill } from '../../components/StatusPill';
import type { CuratedCaps, GatewayModel, ModelTestResult } from '../../types';
import { PROVIDER_COLORS } from './constants';
import { ActionButton, AaLinkButton, ModelMetaCluster, Slot, TestButton, TestResultPill } from './buttons';
import { AssignAgentButton } from './AssignAgentButton';

const MAX_AVATARS = 5;

export function ConfiguredRow({ model, isMobile, isHovered, onHover, agents, assignedAgents, assigning, onAssignAgent, removalQueued, onUndoRemove, onRemove, onEditOllama, contextWindow, sizeBytes, maxContext, caps, knowledge, aaSlug, testResult, isTesting, onTest }: {
  model: GatewayModel;
  isMobile: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  /** Todos los agentes del usuario (para el popover de Asignar). */
  agents: ManagedAgent[];
  /** Agentes cuyo modelo actual ES este — avatares en la tarjeta. */
  assignedAgents: ManagedAgent[];
  /** Asignación en vuelo `{model, agentId}` (spinner en el popover). */
  assigning: { model: string; agentId: string } | null;
  onAssignAgent: (agent: ManagedAgent, model: GatewayModel) => void;
  /** Borrado encolado (ventana de gracia): tarjeta atenuada + Deshacer. */
  removalQueued: boolean;
  onUndoRemove: (key: string) => void;
  onRemove: (key: string) => void;
  onEditOllama?: (m: GatewayModel) => void;
  /** Contexto (ventana) del modelo — se muestra para todos los providers. */
  contextWindow?: number | null;
  /** Tamaño en disco — solo modelos locales (Ollama/LM Studio); null en el resto. */
  sizeBytes?: number | null;
  /** Metadata del catálogo CURADO (vía el cruce catalogByKey de ModelsTab). */
  maxContext?: number | null;
  caps?: CuratedCaps | null;
  knowledge?: string | null;
  aaSlug?: string | null;
  /** Resultado del test de salud para model.id ('provider/modelId'). */
  testResult?: ModelTestResult | null;
  /** Test en curso para esta fila → pill azul "Testing…". */
  isTesting?: boolean;
  /** Lanza el test real (POST /gateway/models/test). */
  onTest?: (key: string) => void;
}) {
  const providerColor = PROVIDER_COLORS[model.provider?.toLowerCase()] ?? 'var(--text-dim)';
  const ProviderIcon = getProviderIcon(model.provider);
  // Sin credencial (no_auth) o provider inexistente (orphan) no hay nada que
  // testear: se conservan esos warnings y se oculta el TestButton.
  const testable = model.status !== 'no_auth' && !model.orphan;
  const modelKey = model.id || `${model.provider}/${model.model}`;
  const assignedIds = new Set(assignedAgents.map((a) => a.id));
  const assignable = !model.orphan && model.status !== 'no_auth';

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
        // Encolado para borrar: atenuada mientras dura la ventana de Deshacer.
        opacity: removalQueued ? 0.45 : 1,
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
            // Móvil: el nombre se lee ENTERO (envuelve); desktop: una línea con ellipsis.
            ...(isMobile
              ? { whiteSpace: 'normal' as const, overflowWrap: 'anywhere' as const }
              : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }),
          }}>
            {model.model || model.id}
          </span>
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
          {/* Warnings de credencial (no_auth/expired/error) se conservan; el
              antiguo pill "available" (= había credencial) se sustituye por el
              resultado del TEST real (si existe) o azul "Testing…" en curso. */}
          {model.status && model.status !== 'available' && <StatusPill status={model.status} />}
          {testable && <TestResultPill result={testResult} testing={isTesting} />}
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
          {/* Avatares de los agentes que usan ESTE modelo (nuevas sesiones). */}
          {assignedAgents.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              {assignedAgents.slice(0, MAX_AVATARS).map((a) => (
                <AgentAvatar key={a.id} avatar={a.avatar} name={a.name} color={a.color} size={36} title={`${a.display_name} usa este modelo`} />
              ))}
              {assignedAgents.length > MAX_AVATARS && (
                <span
                  title={assignedAgents.slice(MAX_AVATARS).map((a) => a.display_name).join(' \u00b7 ')}
                  style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: 'var(--text-dim)', fontFamily: 'var(--font-sans)',
                    background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)',
                    padding: '3px 7px',
                  }}
                >
                  +{assignedAgents.length - MAX_AVATARS}
                </span>
              )}
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

      {/* Metadata (disco/ctx/capacidades) — columnas FIJAS compartidas con
          Catalog: cada chip queda siempre encima del suyo entre filas */}
      <ModelMetaCluster
        isMobile={isMobile}
        sizeBytes={sizeBytes}
        ctxAssigned={contextWindow}
        ctxMax={maxContext}
        knowledge={knowledge}
        caps={caps}
      />

      {/* Actions — también en columnas fijas (desktop): Test encima de Test,
          Editar encima de Editar, Set Default encima de Set Default… */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, ...(isMobile ? { width: '100%', flexWrap: 'wrap' as const } : {}) }}>
        <Slot w={isMobile ? undefined : 30}><AaLinkButton slug={aaSlug} /></Slot>
        <Slot w={isMobile ? undefined : 66}>
          {onTest && testable ? (
            <TestButton
              onClick={() => onTest(model.id || `${model.provider}/${model.model}`)}
              loading={!!isTesting}
            />
          ) : null}
        </Slot>
        <Slot w={isMobile ? undefined : 78}>
          {model.provider === 'ollama' && onEditOllama ? (
            <ActionButton
              icon={<SlidersHorizontal size={12} />}
              label="Editar"
              loading={false}
              onClick={() => onEditOllama(model)}
              variant="secondary"
            />
          ) : null}
        </Slot>
        <Slot w={isMobile ? undefined : 96}>
          <AssignAgentButton
            agents={agents}
            assignedAgentIds={assignedIds}
            disabled={!assignable}
            disabledReason={model.orphan
              ? 'Provider eliminado — no se puede asignar'
              : 'Provider sin credencial — añade su API key primero'}
            assigningAgentId={assigning?.model === modelKey ? assigning.agentId : null}
            onAssign={(agent) => onAssignAgent(agent, model)}
          />
        </Slot>
        <Slot w={isMobile ? undefined : 92}>
          {/* El default no se puede borrar desde aquí (el backend no reasigna
              agents.defaults.model.primary — quedaría un puntero roto). */}
          {model.is_default ? null : removalQueued ? (
            <ActionButton
              icon={<Undo2 size={12} />}
              label="Deshacer"
              loading={false}
              onClick={() => onUndoRemove(model.id)}
              variant="secondary"
            />
          ) : (
            <ActionButton
              icon={<X size={12} />}
              label="Remove"
              loading={false}
              onClick={() => onRemove(model.id)}
              variant="danger"
            />
          )}
        </Slot>
      </div>
    </div>
  );
}
