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

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import { updateAgentModel } from '@/services/agents-admin.service';
import type { ManagedAgent } from '@/modules/agents/types';
import type { GatewayModel, CatalogModel } from '../../types';
import { describeCredentialError, isProviderNotAuthenticated, providerFromAuthError } from '../../lib/credential-errors';
import { useGatewayModelAddStore } from '@/stores/gateway-model-add.store';

// Mutaciones de modelos (asignar a agente, add, remove, borrado en disco) +
// el estado de progreso asociado. La UI del tab solo consume handlers y flags.
export function useModelMutations({ removeModel, queueRemoveModel, fetchModels, fetchCatalog, fetchCustomProviders, onNeedsCredential, onAgentsChanged }: {
  addModel: (key: string) => Promise<void>;
  /** Borrado inmediato (delete-from-disk); el Remove normal va por la cola. */
  removeModel: (key: string) => Promise<void>;
  /** Encola el borrado (batch con debounce + Deshacer) — gateway.store. */
  queueRemoveModel: (key: string) => void;
  fetchModels: () => void;
  fetchCatalog: () => void;
  fetchCustomProviders: () => void;
  /** 409 PROVIDER_NOT_AUTHENTICATED al añadir/asignar un modelo → el tab abre
   *  el formulario de pegar-key de ese provider. */
  onNeedsCredential?: (provider: string) => void;
  /** Tras asignar un modelo a un agente → refetch de agentes (avatares). */
  onAgentsChanged?: () => void;
}) {
  const [mutatingModel, setMutatingModel] = useState<string | null>(null);
  // El progreso de alta pertenece al store y es independiente por modelo.
  const startModelAdd = useGatewayModelAddStore((state) => state.startModelAdd);
  // Props legacy de ProviderModelsView: la fila ahora conserva su forma durante el alta.
  const addingKey: string | null = null;
  const addProgress = 0;
  // Asignación modelo→agente en vuelo (spinner en la fila del popover).
  const [assigning, setAssigning] = useState<{ model: string; agentId: string } | null>(null);

  // El editor custom necesita la definición recién guardada, pero ese
  // enriquecimiento no retrasa la confirmación de la fila.
  useEffect(() => useGatewayModelAddStore.subscribe((state, previous) => {
    for (const [key, operation] of Object.entries(state.modelAddOperations)) {
      if (operation.kind === 'add-with-config' && operation.state === 'succeeded'
        && previous.modelAddOperations[key]?.state !== 'succeeded') fetchCustomProviders();
    }
  }), [fetchCustomProviders]);

  const handleAssignAgent = async (agent: ManagedAgent, model: GatewayModel) => {
    const key = model.id || `${model.provider}/${model.model}`;
    setAssigning({ model: key, agentId: agent.id });
    try {
      await updateAgentModel(agent.id, key);
      toast.success(`${model.model || key} asignado a ${agent.display_name}. Aplica a sesiones nuevas.`);
      onAgentsChanged?.();
    } catch (err) {
      if (isProviderNotAuthenticated(err)) {
        toast.error(describeCredentialError(err, 'Provider not authenticated'));
        onNeedsCredential?.(providerFromAuthError(err) ?? model.provider);
      } else {
        toast.error(describeCredentialError(err, 'No se pudo asignar el modelo'));
      }
    } finally {
      setAssigning(null);
    }
  };

  const handleAddModel = async (key: string) => {
    try {
      await startModelAdd(key);
    } catch (err) {
      // Sólo errores definitivos se notifican aquí. Un transporte incierto
      // conserva su recibo y se consulta en la fila, sin repetir el POST.
      if (isProviderNotAuthenticated(err)) {
        toast.error(describeCredentialError(err, 'Provider not authenticated'));
        onNeedsCredential?.(providerFromAuthError(err) ?? key.split('/')[0] ?? '');
      } else {
        toast.error(describeCredentialError(err, 'Failed to add model'));
      }
    }
  };

  // Remove = encolar (síncrono, sin toast aquí): la tarjeta se atenúa al
  // instante con "Deshacer"; el flush del store agrupa los clicks seguidos en
  // UNA llamada batch y emite el toast único.
  const handleRemoveModel = (key: string) => {
    queueRemoveModel(key);
  };

  // Borrado HARD del modelo Ollama en disco (libera espacio). Recupera
  // gwService.deleteOllamaModel. El tag es el key sin el prefijo 'ollama/'.
  // Si estaba Configured, lo quita además de la config de chat (best-effort).
  const handleDeleteFromDisk = async (model: CatalogModel) => {
    const tag = model.key.replace(/^ollama\//, '');
    // Tamaño para el confirm (best-effort; getOllamaModelInfo lo trae de /api/tags).
    let sizeStr = '';
    try {
      const info = await gwService.getOllamaModelInfo(tag);
      if (info.size_bytes) sizeStr = ` Libera ~${(info.size_bytes / 1e9).toFixed(1)} GB.`;
    } catch { /* tamaño opcional */ }
    if (!window.confirm(`¿Borrar "${model.name || tag}" del disco?${sizeStr}\n\nTendrás que volver a descargarlo para usarlo.`)) return;
    setMutatingModel(model.key);
    try {
      await gwService.deleteOllamaModel(tag);
      if (model.configured) {
        try { await removeModel(model.key); } catch { /* no estaba registrado como modelo de chat */ }
      }
      toast.success(`Borrado del disco: ${model.name || tag}`);
      fetchCatalog();
      fetchModels();
    } catch (err) {
      toast.error(`No se pudo borrar ${model.name || tag}: ${err instanceof Error ? err.message : 'error'}`);
    } finally {
      setMutatingModel(null);
    }
  };

  // Preserva el camino add-with-config para proveedores personalizados.
  // Los metadatos se resuelven en Core; no se inventan valores de contexto.
  const handleAddCustomModelDirect = async (provider: string, modelId: string) => {
    try {
      await startModelAdd(`${provider}/${modelId}`, {
        provider_id: provider,
        model_id: modelId,
        name: modelId,
      });
    } catch (err) {
      if (isProviderNotAuthenticated(err)) {
        toast.error(describeCredentialError(err, 'Provider not authenticated'));
        onNeedsCredential?.(providerFromAuthError(err) ?? provider);
      } else {
        const sample = (err as { available_sample?: string[] }).available_sample;
        const hint = sample?.length ? ` (ej.: ${sample.slice(0, 3).join(', ')})` : '';
        toast.error(describeCredentialError(err, 'Failed to add model') + hint);
      }
    }
  };

  return {
    mutatingModel, addingKey, addProgress, assigning,
    handleAssignAgent, handleAddModel, handleRemoveModel,
    handleDeleteFromDisk, handleAddCustomModelDirect,
  };
}
