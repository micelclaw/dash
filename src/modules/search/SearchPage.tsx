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

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSearchStore } from '@/stores/search.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { SEARCHABLE_DOMAINS } from '@/config/search-domains';
import { SearchResultsList } from './SearchResultsList';
import { SearchDiscover } from './SearchDiscover';
import { RankingPanel } from './RankingPanel';
import { readSearchRouteState } from './search-route-state';

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  // En móvil el panel de ranking arranca colapsado para dar protagonismo a los resultados.
  const [rankingOpen, setRankingOpen] = useState(false);

  const query = useSearchStore(s => s.query);
  const setQuery = useSearchStore(s => s.setQuery);
  const domains = useSearchStore(s => s.domains);
  const setDomains = useSearchStore(s => s.setDomains);
  const searchAdvanced = useSearchStore(s => s.searchAdvanced);
  const loading = useSearchStore(s => s.loading);
  const results = useSearchStore(s => s.results);
  const error = useSearchStore(s => s.error);
  // The URL owns deep-links from Drive. Apply both q and domains on mount and
  // navigation so a persisted Zustand session cannot widen a file-only search.
  const routeStateKey = searchParams.toString();
  useEffect(() => {
    const next = readSearchRouteState(searchParams);
    setQuery(next.query);
    setDomains(next.domains);
  // URL changes, not local filter edits, own deep-link hydration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeStateKey]);

  // Búsqueda EN VIVO con debounce: al teclear o cambiar los filtros de dominio,
  // busca sola tras 350ms (antes solo con Enter → parecía "no busca"). El
  // searchAdvanced cae a `/search` básico en Free (fix TIER_REQUIRED).
  useEffect(() => {
    if (!query.trim()) return;
    const t = setTimeout(() => { void useSearchStore.getState().searchAdvanced(); }, 350);
    return () => clearTimeout(t);
  }, [query, domains]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    const next = new URLSearchParams();
    next.set('q', query);
    if (domains.length) next.set('domains', domains.join(','));
    setSearchParams(next, { replace: true });
    searchAdvanced();
  }, [query, searchAdvanced, setSearchParams]);

  const toggleDomain = useCallback((d: string) => {
    const next = domains.includes(d) ? domains.filter(x => x !== d) : [...domains, d];
    setDomains(next);
    // El debounce de arriba (deps: domains) re-dispara la búsqueda.
  }, [domains, setDomains]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100%',
      fontFamily: 'var(--font-sans)',
      overflowX: 'hidden',
      overflowY: isMobile ? 'auto' : 'hidden',
    }}>
      {/* Left panel — 60% en escritorio, ancho completo en móvil */}
      <div style={{
        flex: isMobile ? '0 0 auto' : '1 1 60%',
        display: 'flex',
        flexDirection: 'column',
        overflow: isMobile ? 'visible' : 'hidden',
        minWidth: 0,
        borderRight: isMobile ? 'none' : '1px solid var(--border)',
        borderBottom: isMobile ? '1px solid var(--border)' : undefined,
      }}>
        {/* Search input */}
        <div style={{
          padding: 16,
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}>
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearch();
                else if (e.key === 'Escape' && query) { setQuery(''); useSearchStore.getState().clear(); }
              }}
              placeholder="Search across all modules..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-sans)',
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); useSearchStore.getState().clear(); }}
                aria-label="Clear search"
                title="Clear search (Esc)"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 2, display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Domain chips */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8,
          }}>
            {/* "All" = domains vacío []; el backend solo filtra si llega ?domains=.
               No seleccionamos cada id (excluiría la federación multimedia y sería redundante). */}
            {(() => {
              const active = domains.length === 0;
              return (
                <button
                  onClick={() => setDomains([])}
                  style={{
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                    background: active ? 'var(--amber-dim)' : 'transparent',
                    color: active ? 'var(--amber)' : 'var(--text-muted)',
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  All
                </button>
              );
            })()}
            {SEARCHABLE_DOMAINS.map(d => {
              const id = d.domains.join(',');
              // Solo resaltado el que está realmente en el filtro. Antes, con
              // `domains` vacío salían TODOS activos y no se distinguía el filtro.
              const active = domains.includes(id);
              return (
                <button
                  key={d.key}
                  onClick={() => toggleDomain(id)}
                  style={{
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                    border: `1px solid ${active ? 'var(--amber)' : 'var(--border)'}`,
                    background: active ? 'var(--amber-dim)' : 'transparent',
                    color: active ? 'var(--amber)' : 'var(--text-muted)',
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, minHeight: 0, overflowY: isMobile ? 'visible' : 'auto', padding: '0 16px 16px' }}>
          {error && (
            <div style={{
              padding: '8px 12px', marginTop: 8,
              background: 'var(--error-dim)', border: '1px solid var(--error)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem', color: 'var(--error)',
            }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.875rem',
            }}>
              <Loader2 size={18} className="animate-spin" />
              Searching…
            </div>
          )}

          {!loading && results.length === 0 && query.trim() && !error && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '48px 16px',
              color: 'var(--text-muted)', fontSize: '0.875rem',
            }}>
              <Search size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              No results found
            </div>
          )}

          {!query.trim() && results.length === 0 && !error && <SearchDiscover />}

          <SearchResultsList />
        </div>
      </div>

      {/* Right panel — 40% ranking en escritorio, apilado/colapsable en móvil */}
      <div style={{
        flex: isMobile ? '0 0 auto' : '0 0 40%',
        width: isMobile ? '100%' : undefined,
        maxWidth: isMobile ? 'none' : 380,
        minWidth: 0,
        overflowY: isMobile ? 'visible' : 'auto',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {isMobile ? (
          <button
            onClick={() => setRankingOpen(o => !o)}
            aria-expanded={rankingOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'transparent',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text)',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            Ranking
            {rankingOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        ) : (
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}>
            Ranking
          </div>
        )}
        {(!isMobile || rankingOpen) && <RankingPanel />}
      </div>
    </div>
  );
}
