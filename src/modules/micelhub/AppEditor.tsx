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

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Save, FileText, FileJson, FileCode, File } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import type { Extension } from '@codemirror/state';
import { toast } from 'sonner';
import { getAppFiles, getAppFileContent, saveAppFile } from '@/services/apps.service';
import type { AppFile } from '@/services/apps.service';
import type { InstalledApp } from '@/types/apps';
import { clawEditorTheme, clawHighlightStyle } from './editor-theme';

interface AppEditorProps {
  app: InstalledApp;
  onBack: () => void;
}

// Map file extensions to CodeMirror language support
function getLangExtension(filename: string): Extension[] {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'md': return [markdown()];
    case 'json': return [json()];
    case 'yaml': case 'yml': return [yaml()];
    case 'ts': case 'tsx': return [javascript({ typescript: true, jsx: ext === 'tsx' })];
    case 'js': case 'jsx': return [javascript({ jsx: ext === 'jsx' })];
    case 'sql': return [sql()];
    default: return [];
  }
}

// Icon for file type
function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'json') return <FileJson size={20} style={{ color: '#e5c07b' }} />;
  if (ext === 'md') return <FileText size={20} style={{ color: '#61afef' }} />;
  if (ext === 'ts' || ext === 'js' || ext === 'tsx' || ext === 'jsx') return <FileCode size={20} style={{ color: '#98c379' }} />;
  return <File size={20} style={{ color: 'var(--text-muted)' }} />;
}

// Tab state for open files
interface OpenTab {
  filepath: string;
  name: string;
  content: string;
  original: string;
  dirty: boolean;
}

export function AppEditor({ app, onBack }: AppEditorProps) {
  const [files, setFiles] = useState<AppFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const appName = app.app_name;

  // Load file list
  useEffect(() => {
    setLoading(true);
    getAppFiles(appName)
      .then(setFiles)
      .catch(() => toast.error('Failed to load files'))
      .finally(() => setLoading(false));
  }, [appName]);

  // Open a file in a tab
  const openFile = useCallback(async (file: AppFile) => {
    if (file.type === 'dir') return;

    // If already open, just focus
    const existing = tabs.find(t => t.filepath === file.path);
    if (existing) {
      setActiveTab(file.path);
      return;
    }

    try {
      const content = await getAppFileContent(appName, file.path);
      const newTab: OpenTab = {
        filepath: file.path,
        name: file.name,
        content,
        original: content,
        dirty: false,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTab(file.path);
    } catch {
      toast.error(`Failed to open ${file.name}`);
    }
  }, [appName, tabs]);

  // Update content in active tab
  const handleChange = useCallback((value: string) => {
    setTabs(prev => prev.map(t =>
      t.filepath === activeTab
        ? { ...t, content: value, dirty: value !== t.original }
        : t
    ));
  }, [activeTab]);

  // Save active file
  const handleSave = useCallback(async () => {
    const tab = tabs.find(t => t.filepath === activeTab);
    if (!tab || !tab.dirty) return;

    setSaving(true);
    try {
      await saveAppFile(appName, tab.filepath, tab.content);
      setTabs(prev => prev.map(t =>
        t.filepath === activeTab
          ? { ...t, original: t.content, dirty: false }
          : t
      ));
      toast.success(`Saved ${tab.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [appName, activeTab, tabs]);

  // Close a tab
  const closeTab = useCallback((filepath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const tab = tabs.find(t => t.filepath === filepath);
    if (tab?.dirty && !confirm('Discard unsaved changes?')) return;

    setTabs(prev => {
      const next = prev.filter(t => t.filepath !== filepath);
      if (activeTab === filepath) {
        setActiveTab(next.length > 0 ? next[next.length - 1].filepath : null);
      }
      return next;
    });
  }, [activeTab, tabs]);

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleSave]);

  // Back with unsaved changes warning
  const handleBack = useCallback(() => {
    const hasDirty = tabs.some(t => t.dirty);
    if (hasDirty && !confirm('You have unsaved changes. Leave anyway?')) return;
    onBack();
  }, [tabs, onBack]);

  const currentTab = tabs.find(t => t.filepath === activeTab);
  const onlyFiles = files.filter(f => f.type === 'file');

  return (
    <div ref={containerRef} style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button onClick={handleBack} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', color: 'var(--text-dim)',
          cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
        }}>
          <ArrowLeft size={16} /> Back
        </button>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
          {app.manifest?.icon || '📦'} {app.manifest?.name || appName}
        </span>
        <div style={{ flex: 1 }} />
        {currentTab && (
          <button
            onClick={handleSave}
            disabled={saving || !currentTab.dirty}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 12px', borderRadius: 'var(--radius-sm)',
              background: currentTab.dirty ? 'var(--amber)' : 'var(--surface)',
              border: currentTab.dirty ? 'none' : '1px solid var(--border)',
              color: currentTab.dirty ? '#06060a' : 'var(--text-dim)',
              fontSize: '0.75rem', fontWeight: 600, cursor: currentTab.dirty ? 'pointer' : 'default',
              fontFamily: 'var(--font-sans)', opacity: saving ? 0.6 : 1,
            }}
          >
            <Save size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {/* File tabs or file grid */}
      {tabs.length === 0 ? (
        // File browser grid
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading files...</p>
          ) : onlyFiles.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No files found</p>
          ) : (
            <>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', margin: '0 0 12px' }}>
                Double-click a file to edit
              </p>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8,
              }}>
                {onlyFiles.map(file => (
                  <button
                    key={file.path}
                    onDoubleClick={() => openFile(file)}
                    onClick={() => openFile(file)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 6, padding: '14px 8px',
                      background: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', color: 'var(--text)',
                      transition: 'border-color var(--transition-fast)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <FileIcon name={file.name} />
                    <span style={{
                      fontSize: '0.6875rem', color: 'var(--text-dim)',
                      textAlign: 'center', wordBreak: 'break-all',
                      lineHeight: 1.3,
                    }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                      {file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        // Editor with tabs
        <>
          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
            overflow: 'auto', flexShrink: 0,
          }}>
            {tabs.map(tab => (
              <button
                key={tab.filepath}
                onClick={() => setActiveTab(tab.filepath)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRight: '1px solid var(--border)',
                  background: activeTab === tab.filepath ? 'var(--surface)' : 'var(--card)',
                  border: 'none', borderBottom: activeTab === tab.filepath ? '2px solid var(--amber)' : '2px solid transparent',
                  color: activeTab === tab.filepath ? 'var(--text)' : 'var(--text-dim)',
                  fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.dirty && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
                )}
                {tab.name}
                <span
                  onClick={(e) => closeTab(tab.filepath, e)}
                  style={{
                    marginLeft: 4, cursor: 'pointer', color: 'var(--text-muted)',
                    fontSize: '0.875rem', lineHeight: 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  ×
                </span>
              </button>
            ))}
            {/* Button to go back to file grid */}
            <button
              onClick={() => { setTabs([]); setActiveTab(null); }}
              style={{
                padding: '6px 10px', background: 'none', border: 'none',
                color: 'var(--text-muted)', fontSize: '0.6875rem', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', marginLeft: 'auto',
              }}
            >
              All files
            </button>
          </div>

          {/* Editor area */}
          {currentTab && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <CodeMirror
                value={currentTab.content}
                onChange={handleChange}
                extensions={[
                  clawEditorTheme,
                  clawHighlightStyle,
                  ...getLangExtension(currentTab.name),
                ]}
                theme="none"
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightActiveLine: true,
                  foldGutter: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  indentOnInput: true,
                  tabSize: 2,
                }}
                height="100%"
                style={{ height: '100%', overflow: 'auto' }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
