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

// ─── Provider brand icons ───────────────────────────────────────────
//
// Brand-recognizable SVG logos for each model provider, sourced from
// `@lobehub/icons`. Renders the `Mono` variant (currentColor) so the
// glyph inherits whatever `color` style the parent sets — usually
// `PROVIDER_COLORS[id]` from `ModelsTab.tsx`. This way we get brand
// SHAPE (Google's G, OpenAI's flower, Anthropic's spiral, NVIDIA's
// eye) tinted with the brand HUE, without the inconsistency of some
// providers being multi-color SVGs and others being mono.
//
// Fallback: caller renders its own generic icon (Lucide `Cpu`) when
// `getProviderIcon` returns null. This avoids forcing every provider
// in the 1127-model OpenClaw catalog to have a brand mapping — only
// the ones in our `PROVIDER_ICONS` table override the default.
//
// Adding a new provider: import its component from `@lobehub/icons`
// and add the lowercased OpenClaw provider id as a key. Variants like
// `byteplus-plan` or `moonshotai-cn` collapse to the base brand.

import type { ComponentType, CSSProperties } from 'react';

// Brand SVGs (Mono variant, currentColor). Tree-shaken automatically.
import Alibaba from '@lobehub/icons/es/Alibaba';
import Anthropic from '@lobehub/icons/es/Anthropic';
import Arcee from '@lobehub/icons/es/Arcee';
import Baidu from '@lobehub/icons/es/Baidu';
import Bedrock from '@lobehub/icons/es/Bedrock';
import ByteDance from '@lobehub/icons/es/ByteDance';
import Cerebras from '@lobehub/icons/es/Cerebras';
import Cloudflare from '@lobehub/icons/es/Cloudflare';
import Cohere from '@lobehub/icons/es/Cohere';
import DeepInfra from '@lobehub/icons/es/DeepInfra';
import DeepSeek from '@lobehub/icons/es/DeepSeek';
import ElevenLabs from '@lobehub/icons/es/ElevenLabs';
import Exa from '@lobehub/icons/es/Exa';
import Fal from '@lobehub/icons/es/Fal';
import Fireworks from '@lobehub/icons/es/Fireworks';
import GithubCopilot from '@lobehub/icons/es/GithubCopilot';
import Google from '@lobehub/icons/es/Google';
import Groq from '@lobehub/icons/es/Groq';
import HuggingFace from '@lobehub/icons/es/HuggingFace';
import KiloCode from '@lobehub/icons/es/KiloCode';
import LmStudio from '@lobehub/icons/es/LmStudio';
import Microsoft from '@lobehub/icons/es/Microsoft';
import Minimax from '@lobehub/icons/es/Minimax';
import Mistral from '@lobehub/icons/es/Mistral';
import Moonshot from '@lobehub/icons/es/Moonshot';
import Nvidia from '@lobehub/icons/es/Nvidia';
import Ollama from '@lobehub/icons/es/Ollama';
import OpenAI from '@lobehub/icons/es/OpenAI';
import OpenCode from '@lobehub/icons/es/OpenCode';
import OpenRouter from '@lobehub/icons/es/OpenRouter';
import Perplexity from '@lobehub/icons/es/Perplexity';
import Qwen from '@lobehub/icons/es/Qwen';
import Runway from '@lobehub/icons/es/Runway';
import SenseNova from '@lobehub/icons/es/SenseNova';
import Stepfun from '@lobehub/icons/es/Stepfun';
import Tavily from '@lobehub/icons/es/Tavily';
import Tencent from '@lobehub/icons/es/Tencent';
import Together from '@lobehub/icons/es/Together';
import Venice from '@lobehub/icons/es/Venice';
import Vercel from '@lobehub/icons/es/Vercel';
import VertexAI from '@lobehub/icons/es/VertexAI';
import Vllm from '@lobehub/icons/es/Vllm';
import Volcengine from '@lobehub/icons/es/Volcengine';
import Voyage from '@lobehub/icons/es/Voyage';
import XAI from '@lobehub/icons/es/XAI';
import XiaomiMiMo from '@lobehub/icons/es/XiaomiMiMo';
import ZAI from '@lobehub/icons/es/ZAI';

export interface ProviderIconProps {
  size: number;
  style?: CSSProperties;
  className?: string;
}

type IconComponent = ComponentType<ProviderIconProps>;

/**
 * OpenClaw provider id (lowercased) → lobehub icon component.
 *
 * Variants and regional clones collapse to their parent brand:
 *   - `byteplus`, `byteplus-plan`           → ByteDance
 *   - `minimax`, `minimax-cn`               → Minimax
 *   - `moonshot`, `moonshotai`, `moonshotai-cn`, `kimi-coding` → Moonshot
 *   - `cloudflare-ai-gateway`, `cloudflare-workers-ai` → Cloudflare
 *   - `azure`, `azure-openai-responses`, `azure-speech`, `microsoft-foundry` → Microsoft
 *   - `openai-codex`                         → OpenAI
 *   - `opencode`, `opencode-go`              → OpenCode
 *   - `google-vertex`, `anthropic-vertex`    → VertexAI / Anthropic
 *   - `amazon-bedrock`, `amazon-bedrock-mantle`, `bedrock` → Bedrock
 *   - `xiaomi`, `xiaomi-mimo`                → XiaomiMiMo
 *   - `qianfan`                              → Baidu (Baidu's LLM platform)
 *   - `senseaudio`                           → SenseNova (SenseTime audio offering)
 *   - `vercel-ai-gateway`                    → Vercel
 *   - `alibaba`, `qwen`                      → Alibaba / Qwen (Qwen is Alibaba's model)
 */
const PROVIDER_ICONS: Record<string, IconComponent> = {
  alibaba: Alibaba,
  anthropic: Anthropic,
  'anthropic-vertex': Anthropic,
  arcee: Arcee,
  azure: Microsoft,
  'azure-openai-responses': Microsoft,
  'azure-speech': Microsoft,
  baidu: Baidu,
  bedrock: Bedrock,
  'amazon-bedrock': Bedrock,
  'amazon-bedrock-mantle': Bedrock,
  byteplus: ByteDance,
  'byteplus-plan': ByteDance,
  cerebras: Cerebras,
  cloudflare: Cloudflare,
  'cloudflare-ai-gateway': Cloudflare,
  'cloudflare-workers-ai': Cloudflare,
  cohere: Cohere,
  deepinfra: DeepInfra,
  deepseek: DeepSeek,
  elevenlabs: ElevenLabs,
  exa: Exa,
  fal: Fal,
  fireworks: Fireworks,
  google: Google,
  'github-copilot': GithubCopilot,
  copilot: GithubCopilot,
  'google-vertex': VertexAI,
  vertexai: VertexAI,
  groq: Groq,
  huggingface: HuggingFace,
  kilocode: KiloCode,
  'kimi-coding': Moonshot,
  'lm-studio': LmStudio,
  lmstudio: LmStudio,
  microsoft: Microsoft,
  'microsoft-foundry': Microsoft,
  minimax: Minimax,
  'minimax-cn': Minimax,
  mistral: Mistral,
  moonshot: Moonshot,
  moonshotai: Moonshot,
  'moonshotai-cn': Moonshot,
  nvidia: Nvidia,
  ollama: Ollama,
  openai: OpenAI,
  'openai-codex': OpenAI,
  opencode: OpenCode,
  'opencode-go': OpenCode,
  openrouter: OpenRouter,
  perplexity: Perplexity,
  qianfan: Baidu,
  qwen: Qwen,
  runway: Runway,
  senseaudio: SenseNova,
  sensenova: SenseNova,
  stepfun: Stepfun,
  tavily: Tavily,
  tencent: Tencent,
  together: Together,
  venice: Venice,
  vercel: Vercel,
  'vercel-ai-gateway': Vercel,
  vllm: Vllm,
  volcengine: Volcengine,
  voyage: Voyage,
  xai: XAI,
  xiaomi: XiaomiMiMo,
  'xiaomi-mimo': XiaomiMiMo,
  zai: ZAI,
};

/**
 * Lookup helper for the provider icon. Returns null when no mapping
 * exists — caller should fall back to a generic icon (Lucide `Cpu` etc.).
 * Matching is case-insensitive on the provider id.
 */
export function getProviderIcon(providerId: string | undefined | null): IconComponent | null {
  if (!providerId) return null;
  return PROVIDER_ICONS[providerId.toLowerCase()] ?? null;
}
