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
import { Star, Cpu, RefreshCw, Search as SearchIcon, Image } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-media-query';
import { useGatewayStore } from '@/stores/gateway.store';
import * as gwService from '@/services/gateway.service';
import { StatusPill } from '../components/StatusPill';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GatewayModel } from '../types';

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#d4a017',
  openai: '#10b981',
  openrouter: '#6366f1',
  gemini: '#4285F4',
  mistral: '#f97316',
  ollama: '#0ea5e9',
};

export function ModelsTab() {
  const isMobile = useIsMobile();
  const { models, modelsLoading, modelsError, fetchModels } = useGatewayStore();
  const [search, setSearch] = useState('');
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [refreshHover, setRefreshHover] = useState(false);

  useEffect(() => {
    if (models.length === 0) fetchModels();
  }, [models.length, fetchModels]);

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

  const filtered = models.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.model?.toLowerCase().includes(q) ||
           m.provider?.toLowerCase().includes(q) ||
           m.id?.toLowerCase().includes(q);
  });

  if (modelsLoading && models.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-dim)', fontSize: '0.875rem',
      }}>
        Loading models...
      </div>
    );
  }

  if (modelsError) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--error)', fontSize: '0.875rem',
      }}>
        {modelsError}
      </div>
    );
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <div style={{ padding: isMobile ? 12 : 20, maxWidth: 1100 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, gap: 12, flexWrap: 'wrap',
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

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              fontSize: '0.8125rem', color: 'var(--text-dim)',
              fontFamily: 'var(--font-sans)',
            }}>
              {filtered.length} model{filtered.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => fetchModels()}
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

        {/* Model list */}
        {filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 60, gap: 12,
          }}>
            <Cpu size={40} style={{ color: 'var(--text-dim)', opacity: 0.4 }} />
            <span style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              {search ? 'No models match your search' : 'No models configured'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((model) => {
              const providerColor = PROVIDER_COLORS[model.provider?.toLowerCase()] ?? 'var(--text-dim)';
              const isHovered = hoveredRow === model.id;

              return (
                <div
                  key={model.id || model.model}
                  onMouseEnter={() => setHoveredRow(model.id)}
                  onMouseLeave={() => setHoveredRow(null)}
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
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-sm)',
                    background: `${providerColor}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Cpu size={16} style={{ color: providerColor }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    }}>
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

                  {/* Set default button */}
                  {!model.is_default && (
                    <SetDefaultButton
                      onClick={() => handleSetDefault(model)}
                      loading={settingDefault === model.id}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

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
