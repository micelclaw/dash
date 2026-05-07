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

import { useState, useEffect, useCallback } from 'react';
import { Copy, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as syncSvc from '@/services/sync.service';
import type { DuplicatePair } from '@/services/sync.service';
import { SettingSection } from '../SettingSection';

type LoadState = 'loading' | 'ok' | 'error';

export function DuplicatesSection() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [dismissing, setDismissing] = useState<string | null>(null);

  const loadDuplicates = useCallback(async () => {
    setLoadState('loading');
    setErrorMessage('');
    try {
      setPairs(await syncSvc.listDuplicates());
      setLoadState('ok');
    } catch (err) {
      // Distinguish a real failure from "endpoint returned []".
      // Without this, a 500/timeout looked identical to "no duplicates".
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMessage(msg);
      setLoadState('error');
      toast.error(`Failed to load duplicates: ${msg}`);
    }
  }, []);

  useEffect(() => { loadDuplicates(); }, [loadDuplicates]);

  const handleDismiss = async (pair: DuplicatePair) => {
    const key = `${pair.recordA.id}-${pair.recordB.id}`;
    setDismissing(key);
    try {
      await syncSvc.dismissDuplicate({
        record_a_id: pair.recordA.id,
        record_b_id: pair.recordB.id,
        domain: pair.domain,
      });
      setPairs((prev) =>
        prev.filter((p) => !(p.recordA.id === pair.recordA.id && p.recordB.id === pair.recordB.id)),
      );
      toast.success('Duplicate dismissed');
    } catch {
      toast.error('Failed to dismiss duplicate');
    }
    setDismissing(null);
  };

  return (
    <SettingSection
      title="Duplicates"
      description="Fuzzy duplicate records detected during sync."
      action={
        <button
          onClick={loadDuplicates}
          title="Refresh"
          style={{
            padding: 6,
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <RefreshCw
            size={14}
            style={{
              color: 'var(--text-muted)',
              animation: loadState === 'loading' ? 'spin 1s linear infinite' : undefined,
            }}
          />
        </button>
      }
    >
      {loadState === 'loading' && (
        <div style={{ textAlign: 'center', padding: '32px 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Loading duplicates...
        </div>
      )}

      {loadState === 'error' && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#ef4444', fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 500 }}>Could not load duplicates</div>
            {errorMessage && (
              <div style={{ marginTop: 2, fontSize: '0.6875rem', opacity: 0.85 }}>
                {errorMessage}
              </div>
            )}
            <button
              onClick={loadDuplicates}
              style={{
                marginTop: 8, padding: '4px 10px',
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 'var(--radius-sm)',
                color: '#ef4444', fontSize: '0.75rem',
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {loadState === 'ok' && pairs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <Copy size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
          No duplicates detected
        </div>
      )}

      {loadState === 'ok' && pairs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pairs.map((pair) => {
            const key = `${pair.recordA.id}-${pair.recordB.id}`;
            return (
              <div
                key={key}
                style={{
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span
                    style={{
                      padding: '2px 6px',
                      fontSize: '0.625rem', fontWeight: 500,
                      borderRadius: 'var(--radius-sm)',
                      background: 'color-mix(in srgb, var(--amber) 15%, transparent)',
                      color: 'var(--amber)',
                    }}
                  >
                    {Math.round(pair.similarity * 100)}% match · {pair.domain}
                  </span>
                  <button
                    onClick={() => handleDismiss(pair)}
                    disabled={dismissing === key}
                    title="Dismiss"
                    style={{
                      padding: 4,
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)',
                      cursor: dismissing === key ? 'not-allowed' : 'pointer',
                      opacity: dismissing === key ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (dismissing !== key) {
                        e.currentTarget.style.background = 'var(--surface-hover)';
                        e.currentTarget.style.color = 'var(--text)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <RecordCell record={pair.recordA} />
                  <RecordCell record={pair.recordB} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SettingSection>
  );
}

function RecordCell({ record }: { record: DuplicatePair['recordA'] }) {
  return (
    <div style={{ fontSize: '0.75rem' }}>
      <div
        style={{
          fontWeight: 500,
          color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {record.title}
      </div>
      {record.subtitle && (
        <div
          style={{
            color: 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginTop: 2,
          }}
        >
          {record.subtitle}
        </div>
      )}
    </div>
  );
}
