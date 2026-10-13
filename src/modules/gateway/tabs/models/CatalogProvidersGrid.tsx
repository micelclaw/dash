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
import { ProviderCard, AddProviderTypeCard, AvailableProviderCard } from './ProviderCards';
import type { InstallableCatalogProvider } from '../../types';

export function CatalogProvidersGrid({
  entries, availableProviders, search, isMobile, customProviderIds, deletingProvider, installingProvider,
  migratingProvider, onProviderClick, onDeleteProvider, onMigrateProvider, onSelectProviderType, onOpenAdvanced, onInstallProvider,
}: {
  entries: ProviderEntry[];
  availableProviders: InstallableCatalogProvider[];
  search: string;
  isMobile: boolean;
  customProviderIds: string[];
  deletingProvider: string | null;
  installingProvider: string | null;
  migratingProvider: string | null;
  onProviderClick: (provider: string) => void;
  onDeleteProvider: (providerId: string, e: React.MouseEvent) => void;
  onMigrateProvider: (providerId: string, e: React.MouseEvent) => void;
  onSelectProviderType: (type: ProviderType) => void;
  onOpenAdvanced: () => void;
  onInstallProvider: (provider: InstallableCatalogProvider) => void;
}) {
  const ollamaStatus = useSettingsStore((s) => s.settings?.ai?.local_models?.ollama_status ?? 'disconnected');
  const ollamaUrl = useSettingsStore((s) => s.settings?.ai?.local_models?.ollama_url ?? 'http://127.0.0.1:11434');

  const matches = (label: string, id: string) => !search
    || label.toLowerCase().includes(search.toLowerCase())
    || id.toLowerCase().includes(search.toLowerCase());
  const filteredEntries = entries.filter((entry) => matches(entry.label, entry.provider));
  const filteredAvailable = availableProviders.filter((provider) => matches(provider.label, provider.id));
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '160px' : '220px'}, 1fr))`,
    gap: 10,
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section>
        <h3 style={{ margin: '0 0 10px', color: 'var(--text-dim)', fontSize: '0.6875rem', letterSpacing: '0.08em', fontWeight: 600 }}>
          INSTALLED PROVIDERS
        </h3>
        <div style={gridStyle}>
      {filteredEntries.map((entry) => (
          <ProviderCard
            key={entry.provider}
            entry={entry}
            onClick={() => onProviderClick(entry.provider)}
            onDelete={customProviderIds.includes(entry.provider) ? (e) => onDeleteProvider(entry.provider, e) : undefined}
            deleting={deletingProvider === entry.provider}
            onMigrate={entry.legacyConfigured ? (e) => onMigrateProvider(entry.provider, e) : undefined}
            migrating={migratingProvider === entry.provider}
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
            description: '', version: null, authMethodCount: 0,
            legacyConfigured: false, enabled: true,
            migrationTarget: null,
          }}
          subtitle={ollamaStatus === 'connected' ? 'No models pulled yet' : `Disconnected · ${ollamaUrl}`}
          onClick={onOpenAdvanced}
        />
      )}

      {/* Las únicas tarjetas Micelclaw (no OpenClaw) son sus extensiones
          explícitas: endpoint compatible custom y gateway local OmniRoute. */}
      <AddProviderTypeCard
        label="Custom Provider"
        description="Any OpenAI or Anthropic-compatible endpoint"
        onClick={() => onSelectProviderType('custom')}
        provider="custom"
      />
      {!entries.some((entry) => entry.provider === 'omniroute') && (
        <AddProviderTypeCard
          label="OmniRoute"
          description="Self-hosted AI gateway managed by Micelclaw"
          onClick={() => onSelectProviderType('omniroute')}
          provider="omniroute"
        />
      )}
        </div>
      </section>

      {filteredAvailable.length > 0 && (
        <section>
          <h3 style={{ margin: '0 0 10px', color: 'var(--text-dim)', fontSize: '0.6875rem', letterSpacing: '0.08em', fontWeight: 600 }}>
            AVAILABLE TO INSTALL
          </h3>
          <div style={gridStyle}>
            {filteredAvailable.map((provider) => (
              <AvailableProviderCard
                key={provider.id}
                provider={provider}
                installing={installingProvider === provider.id}
                onInstall={() => onInstallProvider(provider)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
