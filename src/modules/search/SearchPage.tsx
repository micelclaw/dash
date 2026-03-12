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

import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { Search, X } from 'lucide-react';
import { useSearchStore } from '@/stores/search.store';
import { useAuthStore } from '@/stores/auth.store';
import { SearchResultsList } from './SearchResultsList';
import { RankingPanel } from './RankingPanel';

const ALL_DOMAINS = ['note', 'event', 'email', 'contact', 'diary', 'file', 'photo', 'conversation', 'message'] as const;

const DOMAIN_LABELS: Record<string, string> = {
  note: 'Notes',
  event: 'Events',
  email: 'Emails',
  contact: 'Contacts',
  diary: 'Diary',
  file: 'Files',
  photo: 'Photos',
  conversation: 'Chats',
  message: 'Messages',
};

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const query = useSearchStore(s => s.query);
  const setQuery = useSearchStore(s => s.setQuery);
  const domains = useSearchStore(s => s.domains);
  const setDomains = useSearchStore(s => s.setDomains);
  const searchAdvanced = useSearchStore(s => s.searchAdvanced);
  const loading = useSearchStore(s => s.loading);
  const results = useSearchStore(s => s.results);
  const error = useSearchStore(s => s.error);
  const isPro = useAuthStore(s => s.user?.tier === 'pro');

  // Sync query param → store on mount
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && q !== query) {
      setQuery(q);
      setTimeout(() => {
        useSearchStore.getState().searchAdvanced();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    setSearchParams({ q: query }, { replace: true });
    searchAdvanced();
  }, [query, searchAdvanced, setSearchParams]);

  const toggleDomain = useCallback((d: string) => {
    const next = domains.includes(d) ? domains.filter(x => x !== d) : [...domains, d];
    setDomains(next);
    // Auto-trigger search when filters change and there's an active query
    if (query.trim()) {
      setTimeout(() => useSearchStore.getState().searchAdvanced(), 0);
    }
  }, [domains, setDomains, query]);

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      fontFamily: 'var(--font-sans)',
      overflow: 'hidden',
    }}>
      {/* Left panel — 60% */}
      <div style={{
        flex: '1 1 60%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRight: '1px solid var(--border)',
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
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
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
            {ALL_DOMAINS.map(d => {
              const active = domains.length === 0 || domains.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDomain(d)}
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
                  {DOMAIN_LABELS[d] ?? d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
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

          {!query.trim() && results.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '48px 16px',
              color: 'var(--text-muted)', fontSize: '0.875rem',
            }}>
              <Search size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              Type a query to search across all modules
            </div>
          )}

          <SearchResultsList />
        </div>
      </div>

      {/* Right panel — 40% ranking */}
      <div style={{
        flex: '0 0 40%',
        maxWidth: 380,
        overflowY: 'auto',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text)',
        }}>
          Ranking
        </div>
        <RankingPanel />
      </div>
    </div>
  );
}
