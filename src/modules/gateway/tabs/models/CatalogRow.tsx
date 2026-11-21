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

import { Star, Cpu, Plus, X, Check, Key, Trash2, Pencil, Download, Undo2 } from 'lucide-react';
import { getProviderIcon } from '@/config/provider-icons';
import { canonicalModelAddKey, findModelAddEntry, useGatewayModelAddStore } from '@/stores/gateway-model-add.store';
import { useGatewayStore } from '@/stores/gateway.store';
import { StatusPill } from '../../components/StatusPill';
import type { CatalogModel, ModelTestResult } from '../../types';
import { PROVIDER_COLORS } from './constants';
import { ActionButton, AaLinkButton, ModelMetaCluster, Slot, TestButton, TestResultPill } from './buttons';

export function CatalogRow({ model, providerHasCredential, isMobile, isHovered, onHover, mutatingModel, isAdding, addProgress, onAdd, onRemove, removalQueued, removalInflight, onUndoRemove, onConfigure, onEdit, onDeleteFromDisk, testResult, isTesting, onTest }: {
  model: CatalogModel;
  /** LA señal de auth del provider (overview.has_credential). Gobierna el gate
   *  +Add vs "Configure provider" y el badge de la fila. NO usar
   *  `model.available` para auth: ese flag significa "modelo destacado". */
  providerHasCredential: boolean;
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
  /** GM3: el Remove del catálogo entra por la MISMA cola con debounce que el de
   *  Configured → la fila se atenúa y ofrece Deshacer hasta el flush. */
  removalQueued?: boolean;
  /** GM3: el batch POST del borrado YA salió (hasta 90 s de vuelo). La fila sigue
   *  atenuada, pero ya NO se puede deshacer: se muestra "Removing…" deshabilitado.
   *  Sin esto la fila volvía a brillar con un «Remove» que `queueRemoveModel`
   *  ignoraba por estar en vuelo — un botón muerto. */
  removalInflight?: boolean;
  onUndoRemove?: (key: string) => void;
  onConfigure: (model: CatalogModel) => void;
  /** Set for user-managed (custom-api-*, ollama, vllm, sglang, lm-studio)
   *  configured models — opens the modal to edit contextWindow / maxTokens. */
  onEdit?: (model: CatalogModel) => void;
  /** Solo Ollama: borrado HARD del modelo en disco (libera espacio). */
  onDeleteFromDisk?: (model: CatalogModel) => void;
  /** Resultado del test de salud para model.key (si ya se testeó). */
  testResult?: ModelTestResult | null;
  /** Test en curso para esta fila → pill azul "Testing…". */
  isTesting?: boolean;
  /** Lanza el test real (POST /gateway/models/test). */
  onTest?: (key: string) => void;
}) {
  const providerColor = PROVIDER_COLORS[model.provider?.toLowerCase()] ?? 'var(--text-dim)';
  const ProviderIcon = getProviderIcon(model.provider);
  const isMutating = mutatingModel === model.key;
  const addOperation = useGatewayModelAddStore((state) => findModelAddEntry(state.modelAddOperations, model.key));
  const checkModelAdd = useGatewayModelAddStore((state) => state.checkModelAdd);
  const removal = useGatewayStore(state => state.removalOperation);
  const checkRemoval = useGatewayStore(state => state.checkRemovalOperation);
  const modelIdentity = canonicalModelAddKey(model.key);
  const queuedForModel = useGatewayStore(state => !!modelIdentity && state.queuedRemovals.some(key => canonicalModelAddKey(key) === modelIdentity));
  const removalForModel = modelIdentity && removal?.models.some(key => canonicalModelAddKey(key) === modelIdentity) ? removal : null;
  const removalPending = removalQueued || queuedForModel || removalInflight || !!removalForModel;
  const configured = !['running', 'uncertain'].includes(addOperation?.state ?? '')
    && (model.configured || addOperation?.state === 'succeeded');

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
        border: `1px solid ${configured ? '#10b98130' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        transition: 'var(--transition-fast)',
        flexWrap: isMobile ? 'wrap' : undefined,
        // Encolado para borrar: atenuada mientras dura la ventana de Deshacer
        // (mismo lenguaje visual que la fila de Configured) y TAMBIÉN mientras
        // el batch está en vuelo (GM3) — si no, la fila revive a media operación.
        opacity: removalQueued || removalInflight ? 0.45 : 1,
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
            // Móvil: el nombre se lee ENTERO (envuelve); desktop: una línea con ellipsis.
            ...(isMobile
              ? { whiteSpace: 'normal' as const, overflowWrap: 'anywhere' as const }
              : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }),
          }}>
            {model.name || model.key}
          </span>
          {configured && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#10b98120', color: '#10b981',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              <Check size={9} /> {addOperation?.state === 'succeeded' ? 'Añadido' : 'Configured'}
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
          {/* Badge de la fila: sin credencial → no_auth; local sin descargar →
              warn. Con credencial ya NO se pinta "available" derivado de auth:
              "Available" ahora significa "respondió a un TEST real" → pill del
              resultado del test (si existe), azul "Testing…" mientras corre. */}
          {!providerHasCredential
            ? <StatusPill status="no_auth" />
            : model.local && !model.available
              // Modelo local (Ollama) configurado pero ausente de `/api/tags` — el
              // usuario lo borró con `ollama rm`. NO es un problema de auth: está sin
              // descargar. (El backend ya lo marca available:false/missing:true.)
              ? <StatusPill status="warn" label="No descargado" />
              : <TestResultPill result={testResult} testing={isTesting} />
          }
        </div>
        {addOperation?.state === 'failed' && (
          <div role="alert" style={{ color: 'var(--red, #ef4444)', fontSize: '0.75rem', marginTop: 4 }}>
            {addOperation.message || 'No se pudo añadir el modelo.'}
          </div>
        )}
        {addOperation?.state === 'uncertain' && (
          <div role="status" style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: 4 }}>
            {addOperation.message || 'Comprobando resultado…'}
          </div>
        )}
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

      {/* Metadata (disco/ctx/capacidades) — columnas FIJAS compartidas con
          Configured: cada chip queda siempre encima del suyo entre filas */}
      <ModelMetaCluster
        isMobile={isMobile}
        sizeBytes={model.provider === 'ollama' ? model.size_bytes : null}
        ctxAssigned={model.context_window}
        ctxMax={model.max_context}
        knowledge={model.knowledge}
        isOllamaUnassigned={model.provider === 'ollama' && !model.context_window}
        caps={model.caps}
      />

      {/* Actions — columnas fijas (desktop): Test encima de Test, Edit encima
          de Edit, la acción principal (Add/Remove/Configure) en su columna… */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, ...(isMobile ? { width: '100%', flexWrap: 'wrap' as const } : {}) }}>
        <Slot w={isMobile ? undefined : 30}>{!removalPending && <AaLinkButton slug={model.aa_slug} />}</Slot>
        {/* Test de salud — solo con credencial (sin ella no hay nada que testear) */}
        <Slot w={isMobile ? undefined : 66}>
          {onTest && providerHasCredential && !removalPending ? (
            <TestButton
              onClick={() => onTest(model.key)}
              loading={!!isTesting}
            />
          ) : null}
        </Slot>
        {/* Edit ctx/maxTokens — only for configured user-managed providers */}
        <Slot w={isMobile ? undefined : 62}>
          {onEdit && model.configured && !removalPending && !['running', 'uncertain'].includes(addOperation?.state ?? '') ? (
            <ActionButton
              icon={<Pencil size={12} />}
              label="Edit"
              loading={false}
              onClick={() => onEdit(model)}
              variant="secondary"
            />
          ) : null}
        </Slot>
        <Slot w={isMobile ? undefined : 148}>
        {removalForModel?.state === 'preparing' && onUndoRemove ? (
          <ActionButton icon={<Undo2 size={12} />} label="Deshacer" loading={false} onClick={() => onUndoRemove(model.key)} variant="secondary" />
        ) : removalForModel?.state === 'running' ? (
          <button type="button" disabled style={{ background: 'transparent', border: 0, color: 'var(--text-dim)' }}>Retirando…</button>
        ) : removalForModel?.state === 'uncertain' && (removalForModel.canReconcile === false || (removalForModel.code === 'MODEL_OPERATION_MODEL_BUSY' && !removalForModel.canonicalId)) ? (
          <span role="status" style={{ fontSize: '0.75rem' }}>{removalForModel.message}</span>
        ) : removalForModel?.state === 'uncertain' ? (
          <ActionButton icon={null} label="Comprobar retirada" loading={false} onClick={() => { void checkRemoval(); }} variant="secondary" />
        ) : addOperation?.state === 'running' ? (
          <button type="button" disabled aria-live="polite" style={{
            background: 'transparent', color: 'var(--text-dim)', border: 0,
            padding: '4px 10px', fontSize: '0.75rem', cursor: 'wait', fontFamily: 'var(--font-sans)',
          }}>Añadiendo…</button>
        ) : addOperation?.state === 'uncertain' && (addOperation.canReconcile === false || (addOperation.errorCode === 'MODEL_OPERATION_MODEL_BUSY' && !addOperation.canonicalId)) ? null
        : addOperation?.state === 'uncertain' ? (
          <ActionButton icon={null} label="Comprobar resultado" loading={false}
            onClick={() => { void checkModelAdd(model.key); }} variant="secondary" />
        ) : addOperation?.state === 'failed' && addOperation.errorCode === 'ACCESS_DENIED' ? (
          <ActionButton icon={null} label="Comprobar permisos" loading={false}
            onClick={() => { void checkModelAdd(model.key); }} variant="secondary" />
        ) : addOperation?.state === 'failed' && addOperation.errorCode === 'CREDENTIAL_REQUIRED' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <ActionButton icon={<Key size={12} />} label="Configure provider" loading={false}
              onClick={() => onConfigure(model)} variant="secondary" />
            <ActionButton icon={null} label="Ya conecté mi cuenta" loading={false}
              onClick={() => { void checkModelAdd(model.key); }} variant="secondary" />
          </div>
        ) : !model.is_default && (
          configured ? (
            removalInflight ? (
              <ActionButton
                icon={<X size={12} />}
                label="Removing…"
                loading
                onClick={() => {}}
                variant="secondary"
                title="Removing… — el borrado ya salió al servidor, no se puede deshacer"
              />
            ) : (removalQueued || queuedForModel) && onUndoRemove ? (
              <ActionButton
                icon={<Undo2 size={12} />}
                label="Deshacer"
                loading={false}
                onClick={() => onUndoRemove(model.key)}
                variant="secondary"
              />
            ) : (
              <ActionButton
                icon={<X size={12} />}
                label="Remove"
                loading={isMutating}
                onClick={() => onRemove(model.key)}
                variant="danger"
              />
            )
          ) : (providerHasCredential || addOperation?.credentialAcknowledged) && !['CREDENTIAL_REQUIRED', 'PROVIDER_NOT_AUTHENTICATED'].includes(addOperation?.errorCode ?? '') ? (
            // Gate por credencial REAL del provider (overview.has_credential),
            // no por model.available: un modelo "destacado" de un provider sin
            // key mostraba +Add y acababa orphan/no-auth en Configured.
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
        </Slot>
        {/* Borrar de disco (hard delete) — solo Ollama. Distinto del Remove
            (que solo quita de la config de chat). */}
        <Slot w={isMobile ? undefined : 34}>
          {onDeleteFromDisk && model.provider === 'ollama' && !removalPending ? (
            <ActionButton
              icon={<Trash2 size={12} />}
              label=""
              title="Borrar del disco (libera espacio; tendrás que volver a descargarlo)"
              loading={isMutating || addOperation?.state === 'running' || addOperation?.state === 'uncertain'}
              onClick={() => onDeleteFromDisk(model)}
              variant="danger"
            />
          ) : null}
        </Slot>
      </div>
    </div>
  );
}
