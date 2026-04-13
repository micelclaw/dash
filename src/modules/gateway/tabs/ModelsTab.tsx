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

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Star, Cpu, RefreshCw, Search as SearchIcon, Image, Plus, X, Check, Key } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import * as gwService from '@/services/gateway.service';
import { StatusPill } from '../components/StatusPill';
import { ModelSetupWizard } from '../components/ModelSetupWizard';
import { ModelsAdvancedView } from '../components/ModelsAdvancedView';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GatewayModel, CatalogModel } from '../types';

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#d4a017',
  openai: '#10b981',
  openrouter: '#6366f1',
  gemini: '#4285F4',
  mistral: '#f97316',
  ollama: '#0ea5e9',
  deepseek: '#5b6ee1',
  'amazon-bedrock': '#ff9900',
  google: '#4285F4',
  groq: '#f55036',
  together: '#6366f1',
  fireworks: '#ff6b35',
  cerebras: '#00d4aa',
  xai: '#999999',
  cohere: '#39594d',
};

type View = 'configured' | 'catalog' | 'advanced';

export function ModelsTab() {
  const isMobile = useIsMobile();
  const {
    models, modelsLoading, modelsError, fetchModels,
    catalog, catalogLoading, catalogError, fetchCatalog,
    addModel, removeModel,
  } = useGatewayStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = ((searchParams.get('view') as View) === 'catalog' || (searchParams.get('view') as View) === 'advanced')
    ? (searchParams.get('view') as View)
    : 'configured';
  const [view, setViewState] = useState<View>(initialView);
  const setView = (next: View) => {
    setViewState(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'models');
    if (next === 'configured') params.delete('view');
    else params.set('view', next);
    setSearchParams(params, { replace: true });
  };
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [mutatingModel, setMutatingModel] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [refreshHover, setRefreshHover] = useState(false);
  const [wizardModel, setWizardModel] = useState<CatalogModel | null>(null);

  useEffect(() => {
    if (models.length === 0) fetchModels();
  }, [models.length, fetchModels]);

  useEffect(() => {
    if (view === 'catalog' && catalog.length === 0 && !catalogLoading) fetchCatalog();
  }, [view, catalog.length, catalogLoading, fetchCatalog]);

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

  const handleAddModel = async (key: string) => {
    setMutatingModel(key);
    try {
      await addModel(key);
      toast.success(`Added ${key}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add model');
    } finally {
      setMutatingModel(null);
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

  // Provider list derived from catalog
  const providers = useMemo(() => {
    const set = new Set<string>();
    for (const m of catalog) set.add(m.provider);
    return Array.from(set).sort();
  }, [catalog]);

  // Filtered lists
  const filteredModels = useMemo(() => {
    return models.filter(m => {
      if (!search) return true;
      const q = search.toLowerCase();
      return m.model?.toLowerCase().includes(q) ||
             m.provider?.toLowerCase().includes(q) ||
             m.id?.toLowerCase().includes(q);
    });
  }, [models, search]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(m => {
      if (providerFilter && m.provider !== providerFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return m.key?.toLowerCase().includes(q) ||
             m.name?.toLowerCase().includes(q) ||
             m.provider?.toLowerCase().includes(q);
    });
  }, [catalog, search, providerFilter]);

  const loading = view === 'advanced' ? false : (view === 'configured' ? modelsLoading : catalogLoading);
  const error = view === 'advanced' ? null : (view === 'configured' ? modelsError : catalogError);
  const isEmpty = view === 'advanced' ? false : (view === 'configured' ? filteredModels.length === 0 : filteredCatalog.length === 0);
  const count = view === 'advanced' ? 0 : (view === 'configured' ? filteredModels.length : filteredCatalog.length);

  if (loading && (view === 'configured' ? models.length === 0 : catalog.length === 0)) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem',
      }}>
        Loading models...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--error)', fontSize: '0.875rem',
      }}>
        {error}
      </div>
    );
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1100 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12, gap: 12, flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            flex: isMobile ? '1 1 100%' : undefined,
            maxWidth: 280,
          }}>
            <SearchIcon size={14} style={{ color: 'var(--text-dim)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)',
                width: '100%',
              }}
            />
          </div>

          {/* View toggle */}
          <ViewToggle view={view} onChange={(v) => { setView(v); setProviderFilter(null); }} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              fontSize: '0.8125rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)',
            }}>
              {count} model{count !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => view === 'configured' ? fetchModels() : fetchCatalog()}
              onMouseEnter={() => setRefreshHover(true)}
              onMouseLeave={() => setRefreshHover(false)}
              style={{
                background: refreshHover ? 'var(--surface-hover)' : 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                cursor: 'pointer',
                color: 'var(--text-dim)',
                transition: 'var(--transition-fast)',
                display: 'flex', alignItems: 'center',
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Provider chips (catalog view only) */}
        {view === 'catalog' && providers.length > 0 && (
          <div style={{
            display: 'flex', gap: 6, marginBottom: 14,
            overflowX: 'auto', paddingBottom: 4,
            scrollbarWidth: 'thin',
          }}>
            <ProviderChip
              label="All"
              active={providerFilter === null}
              onClick={() => setProviderFilter(null)}
            />
            {providers.map(p => (
              <ProviderChip
                key={p}
                label={p}
                color={PROVIDER_COLORS[p]}
                active={providerFilter === p}
                onClick={() => setProviderFilter(providerFilter === p ? null : p)}
              />
            ))}
          </div>
        )}

        {/* Model list */}
        {isEmpty ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 60, gap: 12,
          }}>
            <Cpu size={40} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
            <span style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              {search || providerFilter ? 'No models match your search' : 'No models configured'}
            </span>
          </div>
        ) : view === 'advanced' ? (
          <ModelsAdvancedView />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {view === 'configured'
              ? filteredModels.map((model) => (
                  <ConfiguredRow
                    key={model.id || model.model}
                    model={model}
                    isMobile={isMobile}
                    isHovered={hoveredRow === model.id}
                    onHover={setHoveredRow}
                    settingDefault={settingDefault}
                    onSetDefault={handleSetDefault}
                    mutatingModel={mutatingModel}
                    onRemove={handleRemoveModel}
                  />
                ))
              : filteredCatalog.map((model) => (
                  <CatalogRow
                    key={model.key}
                    model={model}
                    isMobile={isMobile}
                    isHovered={hoveredRow === model.key}
                    onHover={setHoveredRow}
                    mutatingModel={mutatingModel}
                    onAdd={handleAddModel}
                    onRemove={handleRemoveModel}
                    onConfigure={(m) => setWizardModel(m)}
                  />
                ))
            }
          </div>
        )}
      </div>
      {wizardModel && (
        <ModelSetupWizard
          model={wizardModel}
          onClose={() => setWizardModel(null)}
          onSuccess={() => {
            fetchModels();
            fetchCatalog();
          }}
        />
      )}
    </ScrollArea>
  );
}

// ─── View Toggle ────────────────────────────────────────────────────

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div style={{
      display: 'flex',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>
      {(['configured', 'catalog', 'advanced'] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: '5px 14px',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            background: view === v ? 'var(--surface-hover)' : 'transparent',
            color: view === v ? 'var(--text)' : 'var(--text-dim)',
          }}
        >
          {v === 'configured' ? 'Configured' : v === 'catalog' ? 'Catalog' : 'Advanced'}
        </button>
      ))}
    </div>
  );
}

// ─── Provider Chip ──────────────────────────────────────────────────

function ProviderChip({ label, color, active, onClick }: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 10px',
        fontSize: '0.6875rem',
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${active ? (color ?? 'var(--text-dim)') + '60' : 'var(--border)'}`,
        background: active ? (color ?? 'var(--text-dim)') + '15' : hovered ? 'var(--surface-hover)' : 'transparent',
        color: active ? (color ?? 'var(--text)') : 'var(--text-dim)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        whiteSpace: 'nowrap',
        textTransform: 'capitalize',
      }}
    >
      {color && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
      )}
      {label}
    </button>
  );
}

// ─── Configured Row ─────────────────────────────────────────────────

function ConfiguredRow({ model, isMobile, isHovered, onHover, settingDefault, onSetDefault, mutatingModel, onRemove }: {
  model: GatewayModel;
  isMobile: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  settingDefault: string | null;
  onSetDefault: (m: GatewayModel) => void;
  mutatingModel: string | null;
  onRemove: (key: string) => void;
}) {
  const providerColor = PROVIDER_COLORS[model.provider?.toLowerCase()] ?? 'var(--text-dim)';

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
        <Cpu size={16} style={{ color: providerColor }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.875rem', fontWeight: 500,
            color: 'var(--text)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
          {model.status && <StatusPill status={model.status} />}
        </div>
        <div style={{
          fontSize: '0.75rem', color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)', marginTop: 2,
          textTransform: 'capitalize',
        }}>
          {model.provider}
          {model.is_fallback && ' \u00b7 fallback'}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {!model.is_default && (
          <SetDefaultButton
            onClick={() => onSetDefault(model)}
            loading={settingDefault === model.id}
          />
        )}
        {!model.is_default && (
          <ActionButton
            icon={<X size={12} />}
            label="Remove"
            loading={mutatingModel === model.id}
            onClick={() => onRemove(model.id)}
            variant="danger"
          />
        )}
      </div>
    </div>
  );
}

// ─── Catalog Row ────────────────────────────────────────────────────

function formatCtx(ctx: number | null): string {
  if (!ctx) return '';
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(ctx % 1_000_000 === 0 ? 0 : 1)}M ctx`;
  if (ctx >= 1_000) return `${Math.round(ctx / 1_000)}K ctx`;
  return `${ctx} ctx`;
}

function CatalogRow({ model, isMobile, isHovered, onHover, mutatingModel, onAdd, onRemove, onConfigure }: {
  model: CatalogModel;
  isMobile: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  mutatingModel: string | null;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onConfigure: (model: CatalogModel) => void;
}) {
  const providerColor = PROVIDER_COLORS[model.provider?.toLowerCase()] ?? 'var(--text-dim)';
  const isMutating = mutatingModel === model.key;

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
        border: `1px solid ${model.configured ? '#10b98130' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        transition: 'var(--transition-fast)',
        flexWrap: isMobile ? 'wrap' : undefined,
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
        <Cpu size={16} style={{ color: providerColor }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.8125rem', fontWeight: 500,
            color: 'var(--text)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {model.name || model.key}
          </span>
          {model.context_window && (
            <span style={{
              fontSize: '0.625rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              background: 'var(--surface)', padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
            }}>
              {formatCtx(model.context_window)}
            </span>
          )}
          {model.configured && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              background: '#10b98120', color: '#10b981',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 6px', fontSize: '0.625rem', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>
              <Check size={9} /> Configured
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
          {model.available
            ? <StatusPill status="available" />
            : <StatusPill status="no_auth" />
          }
        </div>
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

      {/* Action */}
      {!model.is_default && (
        model.configured ? (
          <ActionButton
            icon={<X size={12} />}
            label="Remove"
            loading={isMutating}
            onClick={() => onRemove(model.key)}
            variant="danger"
          />
        ) : model.available ? (
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
    </div>
  );
}

// ─── Shared Buttons ─────────────────────────────────────────────────

function SetDefaultButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--amber-dim)' : 'transparent',
        color: hovered ? 'var(--amber)' : 'var(--text-dim)',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 10px',
        fontSize: '0.75rem',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <Star size={12} />
      {loading ? '...' : 'Set Default'}
    </button>
  );
}

function ActionButton({ icon, label, loading, onClick, variant }: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
  variant: 'primary' | 'danger' | 'secondary';
}) {
  const [hovered, setHovered] = useState(false);
  const colors = variant === 'primary'
    ? { bg: '#10b98120', color: '#10b981' }
    : variant === 'danger'
      ? { bg: '#ef444420', color: '#ef4444' }
      : { bg: 'var(--amber-dim)', color: 'var(--amber)' };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? colors.bg : 'transparent',
        color: hovered ? colors.color : 'var(--text-dim)',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 10px',
        fontSize: '0.75rem',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: loading ? 0.5 : 1,
      }}
    >
      {icon}
      {loading ? '...' : label}
    </button>
  );
}
