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

import { useState } from 'react';
import { toast } from 'sonner';
import * as gwService from '@/services/gateway.service';
import type { GatewayModel, CatalogModel } from '../../types';
import { loadsIntoVram } from './constants';

// Mutaciones de modelos (default, add, remove, borrado en disco) + el estado
// de progreso asociado. La UI del tab solo consume handlers y flags.
export function useModelMutations({ addModel, removeModel, fetchModels, fetchCatalog, fetchCustomProviders }: {
  addModel: (key: string) => Promise<void>;
  removeModel: (key: string) => Promise<void>;
  fetchModels: () => void;
  fetchCatalog: () => void;
  fetchCustomProviders: () => void;
}) {
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [mutatingModel, setMutatingModel] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);  // +Add en curso → la tarjeta se vuelve barra de carga (VRAM)
  const [addProgress, setAddProgress] = useState(0);                // 0..100 fake-progress de esa barra

  const handleSetDefault = async (model: GatewayModel) => {
    setSettingDefault(model.id);
    try {
      await gwService.setDefaultModel(model.id || model.model);
      toast.success(`Default model set to ${model.model}`);
      fetchModels();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default model');
    } finally {
      setSettingDefault(null);
    }
  };

  // Barra de carga (tarjeta entera) durante un +Add que carga el modelo en VRAM.
  // Ollama no expone % de carga en VRAM → fake-progress suave 0→90% + remate a 100%.
  const startAddProgress = (key: string): ReturnType<typeof setInterval> => {
    setAddingKey(key);
    setAddProgress(8);
    return setInterval(() => setAddProgress((p) => (p >= 90 ? 90 : p + 6)), 350);
  };
  const stopAddProgress = (iv: ReturnType<typeof setInterval>) => {
    clearInterval(iv);
    setAddProgress(100);
    setTimeout(() => { setAddingKey(null); setAddProgress(0); }, 300);
  };

  const handleAddModel = async (key: string) => {
    const provider = key.split('/')[0] ?? '';
    const vram = loadsIntoVram(provider);
    setMutatingModel(key);
    const iv = vram ? startAddProgress(key) : null;
    try {
      await addModel(key);
      toast.success(`Added ${key}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add model');
    } finally {
      setMutatingModel(null);
      if (iv) stopAddProgress(iv);
    }
  };

  const handleRemoveModel = async (key: string) => {
    setMutatingModel(key);
    try {
      await removeModel(key);
      toast.success(`Removed ${key}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove model');
    } finally {
      setMutatingModel(null);
    }
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

  // Add a model from a custom-provider catalog directly, WITHOUT opening the
  // modal. Uses sensible defaults (200K ctx, 8K maxTokens) — the user can fine-
  // tune via Edit afterwards. Decision recorded in plan 2026-05-23: NVIDIA
  // doesn't expose context_length in /v1/models, so we'd be asking the user
  // for info they don't have. One-click Add + Edit-when-needed is simpler.
  const handleAddCustomModelDirect = async (provider: string, modelId: string) => {
    const key = `${provider}/${modelId}`;
    const vram = loadsIntoVram(provider);
    setMutatingModel(key);
    const iv = vram ? startAddProgress(key) : null;
    try {
      await gwService.addModelWithConfig({
        model: key,
        provider_id: provider,
        model_id: modelId,
        name: modelId,
        context_window: 200_000,
        max_tokens: 8_192,
      });
      toast.success(`Added ${modelId}`);
      // Refresh catalog + providers so the row immediately flips to
      // "Configured" with Edit/Remove actions.
      fetchModels();
      fetchCatalog();
      fetchCustomProviders();
    } catch (err) {
      // Probe errors (MODEL_NOT_IN_CATALOG / MODEL_NOT_SERVING / etc.) come
      // through with a structured shape from the api client. Surface the full
      // message so the user sees what the provider said.
      const sample = (err as { available_sample?: string[] }).available_sample;
      const msg = err instanceof Error ? err.message : String(err);
      const hint = sample?.length ? ` (ej.: ${sample.slice(0, 3).join(', ')})` : '';
      toast.error(msg + hint);
    } finally {
      setMutatingModel(null);
      if (iv) stopAddProgress(iv);
    }
  };

  return {
    settingDefault, mutatingModel, addingKey, addProgress,
    handleSetDefault, handleAddModel, handleRemoveModel,
    handleDeleteFromDisk, handleAddCustomModelDirect,
  };
}
