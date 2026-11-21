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

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useEscapeToClose } from '@/hooks/use-escape-to-close';
import { X, Link2, Search, Type, Brain, Lock, Layers } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { resolveEntity } from '@/config/entity-registry';
import type { SearchResult } from '@/types/search';
import { hasMessage, useI18n } from '@/i18n';

interface RelateModalProps {
  open: boolean;
  sourceType: string;
  sourceId: string;
  /** Multi-selección: relaciona TODAS estas fuentes con el destino elegido (default [sourceId]). */
  sourceIds?: string[];
  onClose: () => void;
  onLinked?: () => void;
}

// Conjunto curado de dominios relacionables (value + label de copy). El icono y
// el color salen del SSOT (resolveEntity) — no se duplican aquí.
const DOMAINS: { value: string }[] = [
  { value: 'note' }, { value: 'event' }, { value: 'contact' },
  { value: 'email' }, { value: 'file' }, { value: 'diary' },
];

function getResultTitle(result: SearchResult, t: (key: string) => string): string {
  const r = result.record;
  if (!r) {
    return result.snippet?.split('\n')[0]?.slice(0, 60) || result.domain || t('shared.result.unknown');
  }
  switch (result.domain) {
    case 'note': return String(r.title || t('shared.result.untitled'));
    case 'event': return String(r.title || t('shared.result.untitledEvent'));
    case 'contact': return String(r.display_name || t('shared.result.unknown'));
    case 'email': return String(r.subject || t('shared.result.noSubject'));
    case 'file': return String(r.filename || t('shared.result.untitled'));
    case 'diary': return String(r.entry_date || t('shared.result.diaryEntry'));
    default: return t('shared.result.unknown');
  }
}

export function RelateModal({ open, sourceType, sourceId, sourceIds, onClose, onLinked }: RelateModalProps) {
  const { t } = useI18n();
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [searchMode, setSearchMode] = useState<'auto' | 'fulltext' | 'semantic'>(() => {
    try { return (localStorage.getItem('claw-search-mode') as 'auto' | 'fulltext' | 'semantic') || 'fulltext'; } catch { return 'fulltext'; }
  });
  const [lastSearchType, setLastSearchType] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEscapeToClose(onClose, { enabled: open });

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedId(null);
      setSelectedDomain(null);
      setLastSearchType(null);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params: Record<string, string | number> = {
          q: query.trim(),
          limit: 15,
        };
        if (selectedDomain) params.domains = selectedDomain;
        if (searchMode !== 'auto') params.mode = searchMode;
        const res = await api.get<{ data: SearchResult[]; meta?: { search_type?: string } }>('/search', params);
        setResults(res.data || []);
        setLastSearchType((res as any).meta?.search_type || null);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedDomain, searchMode]);

  // Group results by domain
  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    for (const r of results) {
      const existing = groups.get(r.domain) ?? [];
      groups.set(r.domain, [...existing, r]);
    }
    return groups;
  }, [results]);

  // Find the selected result for linking
  const selectedResult = useMemo(() => {
    return results.find(r => r.record_id === selectedId) ?? null;
  }, [results, selectedId]);

  const handleLink = useCallback(async () => {
    if (!selectedResult) return;
    setLinking(true);
    try {
      const ids = sourceIds && sourceIds.length > 0 ? sourceIds : [sourceId];
      for (const id of ids) {
        await api.post('/links', {
          source_type: sourceType,
          source_id: id,
          target_type: selectedResult.domain,
          target_id: selectedResult.record_id,
          link_type: 'manual',
          created_by: 'user',
        });
      }
      toast.success(ids.length > 1 ? t('shared.relate.createdMany', { count: ids.length }) : t('shared.relate.createdOne'));
      window.dispatchEvent(new CustomEvent('links-changed'));
      onLinked?.();
      onClose();
    } catch {
      toast.error(t('shared.relate.createError'));
    }
    setLinking(false);
  }, [selectedResult, sourceType, sourceId, sourceIds, onLinked, onClose, t]);

  if (!open) return null;

  const showSemanticScore = searchMode === 'semantic' || lastSearchType === 'hybrid_rrf';
  const placeholder = selectedDomain
    ? t('shared.relate.searchDomain', { domain: t(hasMessage(`shared.domain.${selectedDomain}`) ? `shared.domain.${selectedDomain}` : 'shared.result.unknown').toLowerCase() })
    : t('shared.relate.searchAll');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          width: 520,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            {t('shared.relate.title')}
          </h3>
          <button onClick={onClose} title={t('shared.action.close')} aria-label={t('shared.action.close')} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2,
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'hidden' }}>
          {/* Domain selector */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {/* All domains button */}
            <button
              onClick={() => { setSelectedDomain(null); setSelectedId(null); setResults([]); }}
              aria-pressed={selectedDomain === null}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px',
                background: selectedDomain === null ? 'color-mix(in srgb, var(--amber) 15%, transparent)' : 'transparent',
                border: selectedDomain === null ? '1px solid var(--amber)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-full)',
                color: selectedDomain === null ? 'var(--amber)' : 'var(--text-dim)',
                fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Layers size={12} />
              {t('shared.domain.all')}
            </button>
            {DOMAINS.map(d => {
              const ent = resolveEntity(d.value);
              const Icon = ent.Icon;
              const dColor = ent.color;
              const active = selectedDomain === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => { setSelectedDomain(d.value); setSelectedId(null); setResults([]); }}
                  aria-pressed={active}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px',
                    background: active ? `color-mix(in srgb, ${dColor} 15%, transparent)` : 'transparent',
                    border: active ? `1px solid ${dColor}` : '1px solid var(--border)',
                    borderRadius: 'var(--radius-full)',
                    color: active ? dColor : 'var(--text-dim)',
                    fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <Icon size={12} />
                  {t(`shared.domain.${d.value}`)}
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedId(null); }}
              placeholder={placeholder}
              aria-label={placeholder}
              autoFocus
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px 8px 30px',
                fontSize: '0.8125rem',
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Results — grouped by domain */}
          <div style={{
            flex: 1, overflowY: 'auto',
            border: results.length > 0 ? '1px solid var(--border)' : 'none',
            borderRadius: 'var(--radius-sm)',
            maxHeight: 300,
          }}>
            {searching && (
              <div style={{ padding: 16, fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                {t('shared.relate.searching')}
              </div>
            )}
            {!searching && query.length >= 2 && results.length === 0 && (
              <div style={{ padding: 16, fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                {t('shared.relate.noResults')}
              </div>
            )}
            {results.length > 0 && Array.from(groupedResults.entries()).map(([domain, items]) => {
              const domainEnt = resolveEntity(domain);
              const DomainIcon = domainEnt.Icon;
              const domainColor = domainEnt.color;
              const label = t(hasMessage(`shared.domain.${domain}`) ? `shared.domain.${domain}` : 'shared.result.unknown');

              return (
                <div key={domain}>
                  {/* Domain group header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px 4px',
                    fontSize: '0.6875rem', color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    <DomainIcon size={12} style={{ color: domainColor }} />
                    {label}
                  </div>
                  {/* Results in this domain */}
                  {items.map(result => {
                    const isSelected = selectedId === result.record_id;
                    const RIcon = DomainIcon;
                    return (
                      <button
                        key={result.record_id}
                        onClick={() => setSelectedId(isSelected ? null : result.record_id)}
                        aria-pressed={isSelected}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          width: '100%', padding: '6px 12px 6px 24px',
                          background: isSelected ? 'var(--amber-dim)' : 'transparent',
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer', textAlign: 'left',
                          fontSize: '0.8125rem',
                          fontFamily: 'var(--font-sans)',
                          transition: 'background var(--transition-fast)',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'var(--amber-dim)' : 'transparent'; }}
                      >
                        <RIcon size={14} style={{ color: domainColor, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: 'var(--text)', fontWeight: 500,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {getResultTitle(result, t)}
                          </div>
                          {result.snippet && (
                            <div style={{
                              fontSize: '0.75rem', color: 'var(--text-dim)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {result.snippet}
                            </div>
                          )}
                        </div>
                        {showSemanticScore && result.score > 0 && (
                          <span style={{
                            fontSize: '0.625rem', color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono, monospace)', flexShrink: 0,
                          }}>
                            {result.score.toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Search mode toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 20px',
          borderTop: '1px solid var(--border)',
        }}>
          {(['fulltext', 'semantic'] as const).map(sm => {
            const isActive = searchMode === sm;
            return (
              <button
                key={sm}
                onClick={() => {
                  const next = sm === searchMode ? 'auto' : sm;
                  setSearchMode(next);
                  try { localStorage.setItem('claw-search-mode', next); } catch { /* */ }
                }}
                aria-pressed={isActive}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  height: 24,
                  padding: '0 10px',
                  background: isActive ? 'var(--amber)' : 'var(--surface)',
                  color: isActive ? '#06060a' : 'var(--text-muted)',
                  border: isActive ? 'none' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.6875rem',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {sm === 'fulltext' ? <Type size={10} /> : <Brain size={10} />}
                {sm === 'fulltext' ? t('shared.relate.keywords') : t('shared.relate.semantic')}
                {sm === 'semantic' && searchMode !== 'semantic' && <Lock size={8} style={{ opacity: 0.6 }} />}
              </button>
            );
          })}
          {lastSearchType === 'hybrid_rrf' && searchMode === 'auto' && results.length > 0 && (
            <span style={{ marginLeft: 4, fontSize: '0.625rem', color: 'var(--amber)', fontFamily: 'var(--font-sans)' }}>
              {t('shared.relate.semantic')}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {searchMode === 'auto' ? t('shared.relate.auto') : searchMode === 'fulltext' ? t('shared.relate.keywords') : t('shared.relate.semantic')}
          </span>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-dim)', fontSize: '0.8125rem', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {t('shared.action.cancel')}
          </button>
          <button
            onClick={handleLink}
            disabled={!selectedResult || linking}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: (!selectedResult || linking) ? 'var(--surface)' : 'var(--amber)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: (!selectedResult || linking) ? 'var(--text-muted)' : '#000',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: (!selectedResult || linking) ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Link2 size={14} />
            {linking ? t('shared.relate.linking') : t('shared.relate.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
