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

/**
 * Catálogo curado de modelos de CHAT locales (Ollama) recomendados para usar
 * como modelo del agente. Filtrable por empresa y tamaño en la UI "Add model".
 * `id` = tag de Ollama (lo que recibe `ollama pull`). `sizeGb` = aprox. Q4.
 * `tools` = idoneidad conocida para tool-calling (la fachada MCP depende de ello).
 */

export interface CatalogModel {
  id: string;          // Ollama tag → ollama pull <id>
  name: string;
  company: string;     // para el filtro por empresa
  params: string;      // 4B / 8B / 14B...
  sizeGb: number;      // descarga/VRAM aprox (Q4)
  tools: 'good' | 'ok' | 'weak'; // aptitud para llamar herramientas
  note?: string;
}

export const CHAT_MODEL_CATALOG: CatalogModel[] = [
  // Qwen (Alibaba) — buenos tool-callers
  { id: 'qwen3:4b',   name: 'Qwen3 4B',            company: 'Alibaba',   params: '4B',  sizeGb: 3,  tools: 'ok',   note: 'Ligero, rápido' },
  { id: 'qwen3:8b',   name: 'Qwen3 8B',            company: 'Alibaba',   params: '8B',  sizeGb: 5,  tools: 'good', note: 'Equilibrado, buen tool-calling' },
  { id: 'qwen3:14b',  name: 'Qwen3 14B',           company: 'Alibaba',   params: '14B', sizeGb: 9,  tools: 'good', note: 'Calidad alta; cabe en 16GB GPU' },
  { id: 'hf.co/Ununnilium/Qwen3.6-27B-IQ4_XS-pure-GGUF', name: 'Qwen3.6 27B (IQ4_XS)', company: 'Alibaba', params: '27B', sizeGb: 14, tools: 'good', note: 'GGUF IQ4_XS puro (~14.3GB); entra justo en 16GB GPU' },
  { id: 'qwen3:32b',  name: 'Qwen3 32B',           company: 'Alibaba',   params: '32B', sizeGb: 20, tools: 'good', note: 'Excede 16GB GPU (offload a RAM, lento)' },
  // Meta (Llama)
  { id: 'llama3.1:8b', name: 'Llama 3.1 8B',       company: 'Meta',      params: '8B',  sizeGb: 5,  tools: 'good' },
  { id: 'llama3.3:70b', name: 'Llama 3.3 70B',     company: 'Meta',      params: '70B', sizeGb: 43, tools: 'good', note: 'No cabe en 16GB GPU' },
  // Google (Gemma)
  { id: 'gemma3:4b',  name: 'Gemma 3 4B',          company: 'Google',    params: '4B',  sizeGb: 3,  tools: 'ok' },
  { id: 'gemma3:12b', name: 'Gemma 3 12B',         company: 'Google',    params: '12B', sizeGb: 8,  tools: 'ok' },
  // Mistral
  { id: 'mistral:7b', name: 'Mistral 7B',          company: 'Mistral',   params: '7B',  sizeGb: 4,  tools: 'ok' },
  { id: 'mistral-small:24b', name: 'Mistral Small 24B', company: 'Mistral', params: '24B', sizeGb: 14, tools: 'good' },
  // DeepSeek (reasoning)
  { id: 'deepseek-r1:8b',  name: 'DeepSeek-R1 8B',  company: 'DeepSeek',  params: '8B',  sizeGb: 5,  tools: 'ok',   note: 'Razonamiento' },
  { id: 'deepseek-r1:14b', name: 'DeepSeek-R1 14B', company: 'DeepSeek',  params: '14B', sizeGb: 9,  tools: 'ok',   note: 'Razonamiento; cabe en 16GB' },
  // Microsoft (Phi)
  { id: 'phi4:14b',   name: 'Phi-4 14B',           company: 'Microsoft', params: '14B', sizeGb: 9,  tools: 'ok' },
];

export const CATALOG_COMPANIES = [...new Set(CHAT_MODEL_CATALOG.map((m) => m.company))].sort();

/**
 * Subconjunto curado para los chips "populares" del modal de añadir modelo
 * (AddOllamaModelModal). Modelos pequeños/medianos con buen tool-calling que
 * caben en una GPU típica — pensado para arrancar a un usuario novato.
 */
export const POPULAR_OLLAMA_SUGGESTIONS: CatalogModel[] = (
  ['qwen3:8b', 'qwen3:14b', 'llama3.1:8b', 'mistral:7b', 'gemma3:12b'] as const
)
  .map((id) => CHAT_MODEL_CATALOG.find((m) => m.id === id))
  .filter((m): m is CatalogModel => m != null);

export const SIZE_BUCKETS: Array<{ label: string; test: (gb: number) => boolean }> = [
  { label: '≤4GB',  test: (g) => g <= 4 },
  { label: '5-9GB', test: (g) => g >= 5 && g <= 9 },
  { label: '10-16GB', test: (g) => g >= 10 && g <= 16 },
  { label: '>16GB', test: (g) => g > 16 },
];
