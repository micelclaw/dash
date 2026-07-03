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

import { useSettingsStore } from '@/stores/settings.store';
import type { ProviderType } from '../../components/ModelSetupWizard';
import { PROVIDER_COLORS } from './constants';
import type { ProviderEntry } from './types';
import { ProviderCard, AddProviderTypeCard } from './ProviderCards';

// Tarjetas de alta de provider (tipos custom alineados con la CLI de OpenClaw
// + quickstarts cloud U10: el binario ya conoce el baseUrl nativamente, así
// que el usuario solo necesita una API key).
const PROVIDER_TYPE_CARDS: Array<{ type: ProviderType; label: string; description: string }> = [
  { type: 'custom', label: 'Custom Provider', description: 'Any OpenAI or Anthropic-compatible endpoint' },
  { type: 'ollama', label: 'Ollama', description: 'Local or cloud Ollama instance' },
  { type: 'sglang', label: 'SGLang', description: 'Fast self-hosted server' },
  { type: 'vllm', label: 'vLLM', description: 'Local/self-hosted OpenAI-compatible' },
  { type: 'lm-studio', label: 'LM Studio', description: 'Local LM Studio server' },
  { type: 'xai', label: 'xAI', description: 'Grok models (Grok 4, Grok Code) — sign in with X or paste an API key' },
  { type: 'openrouter', label: 'OpenRouter', description: 'One key, hundreds of models from many providers' },
  { type: 'minimax', label: 'MiniMax', description: 'M2 series + the only mainstream Music streaming provider' },
  { type: 'cohere', label: 'Cohere', description: 'Command R+ family + multilingual embeddings' },
  { type: 'fal', label: 'Fal', description: 'Image and video generation (Krea, Flux, SDXL)' },
  { type: 'arcee', label: 'Arcee', description: 'Small/medium specialised models (Trinity, Coder, Spark)' },
];

export function CatalogProvidersGrid({
  entries, search, isMobile, customProviderIds, deletingProvider,
  onProviderClick, onDeleteProvider, onSelectProviderType, onOpenAdvanced,
}: {
  entries: ProviderEntry[];
  search: string;
  isMobile: boolean;
  customProviderIds: string[];
  deletingProvider: string | null;
  onProviderClick: (provider: string) => void;
  onDeleteProvider: (providerId: string, e: React.MouseEvent) => void;
  onSelectProviderType: (type: ProviderType) => void;
  onOpenAdvanced: () => void;
}) {
  const ollamaStatus = useSettingsStore((s) => s.settings?.ai?.local_models?.ollama_status ?? 'disconnected');
  const ollamaUrl = useSettingsStore((s) => s.settings?.ai?.local_models?.ollama_url ?? 'http://127.0.0.1:11434');

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '160px' : '220px'}, 1fr))`,
      gap: 10,
    }}>
      {entries
        .filter(e => !search || e.label.toLowerCase().includes(search.toLowerCase()) || e.provider.toLowerCase().includes(search.toLowerCase()))
        .map((entry) => (
          <ProviderCard
            key={entry.provider}
            entry={entry}
            onClick={() => onProviderClick(entry.provider)}
            onDelete={customProviderIds.includes(entry.provider) ? (e) => onDeleteProvider(entry.provider, e) : undefined}
            deleting={deletingProvider === entry.provider}
          />
        ))}

      {/* Ollama (if not in catalog because disconnected) */}
      {!entries.some(e => e.provider === 'ollama') && (
        <ProviderCard
          entry={{
            provider: 'ollama',
            label: 'Ollama',
            color: PROVIDER_COLORS.ollama ?? '#888',
            modelCount: 0,
            configuredCount: 0,
            hasAuth: false,
          }}
          subtitle={ollamaStatus === 'connected' ? 'No models pulled yet' : `Disconnected · ${ollamaUrl}`}
          onClick={onOpenAdvanced}
        />
      )}

      {PROVIDER_TYPE_CARDS.map((card) => (
        <AddProviderTypeCard
          key={card.type}
          label={card.label}
          description={card.description}
          onClick={() => onSelectProviderType(card.type)}
          provider={card.type}
        />
      ))}
    </div>
  );
}
