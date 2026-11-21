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

import { useState, useRef } from 'react';
import { X, Upload, Download, FileText, Loader2, Check, AlertCircle } from 'lucide-react';
import { useFeedsStore } from '@/stores/feeds.store';
import { useI18n } from '@/i18n';

interface OpmlImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function OpmlDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'import' | 'export'>('import');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<OpmlImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fetchFeeds = useFeedsStore(s => s.fetchFeeds);
  const fetchUnreadCounts = useFeedsStore(s => s.fetchUnreadCounts);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = (await import('@/stores/auth.store')).useAuthStore.getState().tokens?.accessToken;
      const baseUrl = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${baseUrl}/api/v1/feeds/import/opml`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || t('feeds.importFailed'));
      setResult(json.data);

      // Refresh feeds
      fetchFeeds();
      fetchUnreadCounts();
    } catch (err: any) {
      setError(err.message || t('feeds.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = (await import('@/stores/auth.store')).useAuthStore.getState().tokens?.accessToken;
      const baseUrl = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${baseUrl}/api/v1/feeds/export/opml`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (!res.ok) throw new Error(t('feeds.exportFailed'));
      const xml = await res.text();
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'micelclaw-feeds.opml';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || t('feeds.exportFailed'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-medium text-[var(--text)]">{t('feeds.opmlTitle')}</h3>
          <button onClick={onClose} aria-label={t('feeds.closeDialog')} className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-dim)]">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border)]">
          <button
            className={`flex-1 px-4 py-2 text-xs font-medium ${mode === 'import' ? 'text-[var(--amber)] border-b-2 border-[var(--amber)]' : 'text-[var(--text-dim)]'}`}
            onClick={() => { setMode('import'); setResult(null); setError(null); }}
          >
            <Upload size={14} className="inline mr-1" /> {t('feeds.import')}
          </button>
          <button
            className={`flex-1 px-4 py-2 text-xs font-medium ${mode === 'export' ? 'text-[var(--amber)] border-b-2 border-[var(--amber)]' : 'text-[var(--text-dim)]'}`}
            onClick={() => { setMode('export'); setResult(null); setError(null); }}
          >
            <Download size={14} className="inline mr-1" /> {t('feeds.export')}
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {mode === 'import' ? (
            <>
              {/* File drop zone */}
              <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--amber)] transition-colors">
                <FileText size={24} className="text-[var(--text-dim)]" />
                <span className="text-xs text-[var(--text-dim)]">
                  {fileName || t('feeds.pickOpml')}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".opml,.xml"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>

              <button
                onClick={handleImport}
                disabled={importing || !fileName}
                className="w-full py-2 text-sm bg-[var(--amber)] text-black rounded font-medium hover:bg-[var(--amber-hover)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {importing ? t('feeds.importing') : t('feeds.import')}
              </button>

              {/* Result */}
              {result && (
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <p className="text-xs text-[var(--success)] flex items-center gap-1">
                    <Check size={12} /> {t('feeds.imported', { count: result.imported })}
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-xs text-[var(--text-dim)]">{t('feeds.skipped', { count: result.skipped })}</p>
                  )}
                  {result.errors.length > 0 && (
                    <div className="text-xs text-[var(--error)]">
                      <p className="flex items-center gap-1"><AlertCircle size={12} /> {t('feeds.importErrors', { count: result.errors.length })}</p>
                      {result.errors.slice(0, 3).map((err, i) => (
                        <p key={i} className="ml-4 truncate">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--text-dim)]">
                {t('feeds.exportDescription')}
              </p>
              <button
                onClick={handleExport}
                className="w-full py-2 text-sm bg-[var(--amber)] text-black rounded font-medium hover:bg-[var(--amber-hover)] flex items-center justify-center gap-2"
              >
                <Download size={14} /> {t('feeds.downloadOpml')}
              </button>
            </>
          )}

          {error && <p className="text-xs text-[var(--error)]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
