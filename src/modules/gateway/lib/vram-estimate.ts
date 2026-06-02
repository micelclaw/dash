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

// Estimación de VRAM/RAM de un modelo Ollama según contexto Y offload (num_gpu).
// Función PURA. Modela el REPARTO por capas: las capas en GPU consumen VRAM, el
// resto (weights+KV) cae a RAM. Marca 🔴 'over' si las capas forzadas no caben en
// VRAM o si la parte en RAM supera la RAM disponible (no arrancará).
//
// KV (f16): bytes/token = block_count × head_count_kv × (key_length + value_length) × 2.
// Aproximado: no modela cuantización del KV ni flash-attention; weights tratados
// como repartidos uniformemente por capa (embeddings/output se aproximan).
// Snapshot: vram_total_mb / ram_available_mb se leen UNA vez al abrir el modal.

import type { OllamaModelInfo } from '@/services/gateway.service';

const COMPUTE_BUFFER_GB = 0.5; // buffer de cómputo en GPU cuando hay ≥1 capa en GPU

export interface VramEstimate {
  weightsGb: number;
  kvGb: number;
  computeBufferGb: number;
  totalGb: number;
  vramTotalGb: number | null;
  ramAvailGb: number | null;
  blockCount: number;
  gpuLayers: number;     // capas resueltas en GPU (auto o forzado)
  vramUsedGb: number;    // lo que va a VRAM
  ramUsedGb: number;     // lo que va a RAM/CPU
  status: 'fits' | 'spill' | 'over' | 'unknown';
  reason: string;
  partial: boolean;      // faltan metadatos para una estimación fiable
}

/** numGpu: nº de capas a GPU; null = auto (las que quepan en VRAM). */
export function estimateVram(info: OllamaModelInfo, numCtx: number, numGpu: number | null): VramEstimate {
  const weightsGb = (info.size_bytes ?? 0) / 1e9;
  const bc = info.block_count ?? 0;
  const kvh = info.head_count_kv ?? 0;
  const kl = info.key_length ?? 0;
  const vl = info.value_length ?? 0;
  const kvGb = (bc * kvh * (kl + vl) * 2 * Math.max(0, numCtx)) / 1e9;
  const modelGb = weightsGb + kvGb; // parte repartible por capas
  const totalGb = modelGb + COMPUTE_BUFFER_GB;

  const vramTotalGb = info.vram_total_mb != null ? info.vram_total_mb / 1024 : null;
  const ramAvailGb = info.ram_available_mb != null ? info.ram_available_mb / 1024 : null;
  const partial = info.size_bytes == null || bc === 0 || kvh === 0;

  // Sin metadatos de capas → no se puede repartir; estimación simple (todo-o-nada).
  if (bc === 0) {
    const vramUsedGb = vramTotalGb != null ? Math.min(totalGb, vramTotalGb) : 0;
    const ramUsedGb = Math.max(0, totalGb - vramUsedGb);
    const over = ramAvailGb != null && ramUsedGb > ramAvailGb;
    return {
      weightsGb, kvGb, computeBufferGb: COMPUTE_BUFFER_GB, totalGb, vramTotalGb, ramAvailGb,
      blockCount: 0, gpuLayers: 0, vramUsedGb, ramUsedGb,
      status: over ? 'over' : ramUsedGb > 0.3 ? 'spill' : 'fits',
      reason: over ? 'Excede la RAM disponible — no arrancará.' : 'Estimación aproximada (sin metadatos de capas).',
      partial: true,
    };
  }

  const perLayerGb = modelGb / bc;

  // Capas en GPU: forzadas (numGpu) o auto (las que quepan en VRAM).
  let gpuLayers: number;
  if (numGpu != null) {
    gpuLayers = Math.max(0, Math.min(bc, Math.floor(numGpu)));
  } else if (vramTotalGb != null) {
    gpuLayers = Math.max(0, Math.min(bc, Math.floor((vramTotalGb - COMPUTE_BUFFER_GB) / perLayerGb)));
  } else {
    gpuLayers = 0; // sin GPU detectada
  }

  const vramUsedGb = gpuLayers > 0 ? perLayerGb * gpuLayers + COMPUTE_BUFFER_GB : 0;
  const ramUsedGb = perLayerGb * (bc - gpuLayers);

  const vramOver = vramTotalGb != null && vramUsedGb > vramTotalGb + 0.05;
  const ramOver = ramAvailGb != null && ramUsedGb > ramAvailGb;

  let status: VramEstimate['status'];
  let reason: string;
  if (vramOver) {
    status = 'over';
    reason = `${gpuLayers} capas en GPU necesitan ${vramUsedGb.toFixed(1)} GB pero la VRAM es ${vramTotalGb!.toFixed(1)} GB. Baja el offload o el contexto.`;
  } else if (ramOver) {
    status = 'over';
    reason = `Faltan ${(ramUsedGb - ramAvailGb!).toFixed(1)} GB: la parte en RAM (${ramUsedGb.toFixed(1)} GB) supera la RAM disponible (${ramAvailGb!.toFixed(1)} GB). NO va a funcionar — demasiado.`;
  } else if (ramUsedGb > 0.3) {
    status = 'spill';
    reason = vramTotalGb == null
      ? 'Sin GPU: todo en CPU/RAM (muy lento).'
      : `${gpuLayers}/${bc} capas en GPU, resto en RAM (más lento).`;
  } else {
    status = 'fits';
    reason = 'Todo en GPU.';
  }

  return {
    weightsGb, kvGb, computeBufferGb: COMPUTE_BUFFER_GB, totalGb, vramTotalGb, ramAvailGb,
    blockCount: bc, gpuLayers, vramUsedGb, ramUsedGb, status, reason, partial,
  };
}

/** Formatea GB a 1 decimal. */
export function fmtGb(gb: number): string {
  return gb.toFixed(1);
}
