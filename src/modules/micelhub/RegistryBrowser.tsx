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
import { Package, Upload, RefreshCw, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface RegistryApp {
  name: string;
  version: string;
  description?: string;
  icon?: string;
  level?: number;
  source?: string;
}

interface AppVersion {
  version: string;
  changelog?: string;
  created_at: string;
}

export function RegistryBrowser() {
  const [apps, setApps] = useState<RegistryApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: RegistryApp[] }>('/apps/registry');
      setApps(res.data ?? []);
    } catch {
      // registry may not be available
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadVersions = async (name: string) => {
    setSelectedApp(name);
    setVersionsLoading(true);
    try {
      const res = await api.get<{ data: AppVersion[] }>(`/apps/registry/${name}/versions`);
      setVersions(res.data ?? []);
    } catch {
      setVersions([]);
    }
    setVersionsLoading(false);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.claw,.zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        await api.upload('/apps/registry/import', formData);
        toast.success('App imported to registry');
        load();
      } catch {
        toast.error('Failed to import app');
      }
      setImporting(false);
    };
    input.click();
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
        Loading registry...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* App list */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            Local Registry ({apps.length})
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={load} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-dim)' }}>
              <RefreshCw size={12} />
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                background: 'var(--amber)', color: '#06060a', border: 'none',
                borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              <Upload size={12} /> {importing ? 'Importing...' : 'Import .claw'}
            </button>
          </div>
        </div>

        {apps.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Package size={32} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 8px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No apps in local registry</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {apps.map(app => (
              <button
                key={app.name}
                onClick={() => loadVersions(app.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: selectedApp === app.name ? 'var(--surface-hover)' : 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
                }}
              >
                <Package size={20} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {app.name}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    v{app.version}
                    {app.description && ` · ${app.description.slice(0, 40)}`}
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Version detail */}
      {selectedApp && (
        <div style={{ width: 300, borderLeft: '1px solid var(--border)', overflow: 'auto', padding: 16 }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: 12, fontFamily: 'var(--font-sans)' }}>
            {selectedApp}
          </h3>
          {versionsLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading versions...</div>
          ) : versions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No versions found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {versions.map(v => (
                <div key={v.version} style={{ padding: '8px 10px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>v{v.version}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {new Date(v.created_at).toLocaleDateString()}
                  </div>
                  {v.changelog && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                      {v.changelog}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
