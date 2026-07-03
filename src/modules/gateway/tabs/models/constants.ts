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

export const PROVIDER_COLORS: Record<string, string> = {
  // Mainstream
  anthropic: '#d4a017',
  openai: '#10b981',
  'openai-codex': '#10b981',
  openrouter: '#6366f1',
  gemini: '#4285F4',
  google: '#4285F4',
  'google-vertex': '#4285F4',
  vertexai: '#4285F4',
  mistral: '#f97316',
  ollama: '#0ea5e9',
  deepseek: '#5b6ee1',
  'amazon-bedrock': '#ff9900',
  bedrock: '#ff9900',
  groq: '#f55036',
  together: '#6366f1',
  fireworks: '#ff6b35',
  cerebras: '#00d4aa',
  xai: '#999999',
  cohere: '#39594d',
  // New (2026.5.7 + brand-recognised)
  nvidia: '#76B900',
  deepinfra: '#2563eb',
  arcee: '#7c3aed',
  'github-copilot': '#9CA3AF',
  copilot: '#9CA3AF',
  huggingface: '#FF9D00',
  byteplus: '#1d4ed8',
  'byteplus-plan': '#1d4ed8',
  cloudflare: '#f6821f',
  'cloudflare-ai-gateway': '#f6821f',
  'cloudflare-workers-ai': '#f6821f',
  microsoft: '#0078d4',
  azure: '#0078d4',
  'azure-openai-responses': '#0078d4',
  minimax: '#0066ff',
  'minimax-cn': '#0066ff',
  moonshot: '#16a085',
  moonshotai: '#16a085',
  'moonshotai-cn': '#16a085',
  'kimi-coding': '#16a085',
  voyage: '#7c3aed',
  'lm-studio': '#374151',
  lmstudio: '#374151',
  vllm: '#0ea5e9',
  opencode: '#9CA3AF',
  'opencode-go': '#9CA3AF',
  xiaomi: '#ff6900',
  'xiaomi-mimo': '#ff6900',
  // Round 2 (extra logos)
  alibaba: '#ff6a00',
  qwen: '#615ced',
  baidu: '#2932e1',
  qianfan: '#2932e1',
  elevenlabs: '#9CA3AF',
  exa: '#1e40af',
  fal: '#ec4899',
  kilocode: '#6366f1',
  perplexity: '#1f7a8c',
  runway: '#9CA3AF',
  senseaudio: '#ff6b6b',
  sensenova: '#ff6b6b',
  stepfun: '#00b1ff',
  tavily: '#4b5cf3',
  tencent: '#1d61ff',
  venice: '#d4af37',
  vercel: '#9CA3AF',
  'vercel-ai-gateway': '#9CA3AF',
  volcengine: '#1664ff',
  zai: '#6366f1',
  'anthropic-vertex': '#d4a017',
  'amazon-bedrock-mantle': '#ff9900',
  'azure-speech': '#0078d4',
  'microsoft-foundry': '#0078d4',
  // Round 3 (custom abstract glyphs — no lobehub coverage)
  chutes: '#3b82f6',
  deepgram: '#13ef93',
  firecrawl: '#fa5d19',
  gradium: '#a855f7',
  inworld: '#0ea5e9',
  litellm: '#22c55e',
  searxng: '#3050ff',
  sglang: '#475569',
  synthetic: '#10b981',
  tokenjuice: '#84cc16',
  vydra: '#ec4899',
};

export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  xai: 'xAI (Grok)',
  mistral: 'Mistral',
  cohere: 'Cohere',
  together: 'Together AI',
  fireworks: 'Fireworks',
  cerebras: 'Cerebras',
  ollama: 'Ollama',
  'amazon-bedrock': 'Amazon Bedrock',
  'hugging-face': 'Hugging Face',
  'venice-ai': 'Venice AI',
  litellm: 'LiteLLM',
  chutes: 'Chutes',
  minimax: 'MiniMax',
  qwen: 'Qwen',
};

// Providers that the user installs/configures from the dash wizard.
// Custom providers follow the `custom-api-*` convention; the local-server
// providers have fixed IDs aligned with the OpenClaw CLI.
export const USER_MANAGED_FIXED_PROVIDERS = new Set(['ollama', 'vllm', 'sglang', 'lm-studio']);
export function isUserManagedProvider(id: string): boolean {
  return id.startsWith('custom-api-') || USER_MANAGED_FIXED_PROVIDERS.has(id);
}

// Solo los modelos locales (Ollama) cargan en VRAM al añadirlos → barra de
// progreso "Cargando en VRAM…" en toda la tarjeta. Los proveedores cloud
// (openrouter, anthropic, custom-api-*…) solo escriben config: spinner simple
// en el botón, sin animación de carga.
export function loadsIntoVram(provider: string): boolean {
  return provider === 'ollama';
}

export function formatCtx(ctx: number | null): string {
  if (!ctx) return '';
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(ctx % 1_000_000 === 0 ? 0 : 1)}M ctx`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}K ctx`;
  return `${ctx} ctx`;
}

export function formatBytes(b: number): string {
  return b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`;
}
