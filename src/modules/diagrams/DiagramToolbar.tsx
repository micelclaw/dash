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

import { useCallback, useState, useEffect } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Save,
  Grid3X3, Magnet, Map, Download, Upload, Sparkles,
  ArrowDown, ArrowRight, ArrowUp, ArrowLeft, Loader2,
  Image as ImageIcon, FileCode, FileText, FileType, CheckCircle2, AlertCircle,
  Network, TreePine, Circle, Zap, GitBranch,
  Lightbulb, History, X, ChevronDown, Edit3, Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { useAutoLayout, type LayoutDirection } from './hooks/use-auto-layout';
import { useElkLayout, type ElkAlgorithm } from './hooks/use-elk-layout';
import { api } from '@/services/api';
import type { DiagramFile } from './types';

// ─── Layout Options ─────────────────────────────────────

const LAYOUT_OPTIONS: { direction: LayoutDirection; label: string; icon: typeof ArrowDown }[] = [
  { direction: 'TB', label: 'Top \u2192 Bottom', icon: ArrowDown },
  { direction: 'LR', label: 'Left \u2192 Right', icon: ArrowRight },
  { direction: 'BT', label: 'Bottom \u2192 Top', icon: ArrowUp },
  { direction: 'RL', label: 'Right \u2192 Left', icon: ArrowLeft },
];

// ─── Template Types ─────────────────────────────────────

const TEMPLATE_TYPES = [
  { type: 'flowchart', label: 'Flowchart' },
  { type: 'orgchart', label: 'Org Chart' },
  { type: 'erd', label: 'Entity Relationship' },
  { type: 'mindmap', label: 'Mind Map' },
  { type: 'architecture', label: 'Architecture' },
];

// ─── Props ──────────────────────────────────────────────

interface DiagramToolbarProps {
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isMobile?: boolean;
}

// ─── Main Toolbar ───────────────────────────────────────

export function DiagramToolbar({ onSave, saveStatus, isMobile }: DiagramToolbarProps) {
  const title = useDiagramsStore((s) => s.title);
  const isDirty = useDiagramsStore((s) => s.isDirty);
  const setTitle = useDiagramsStore((s) => s.setTitle);
  const undo = useDiagramsStore((s) => s.undo);
  const redo = useDiagramsStore((s) => s.redo);
  const undoStack = useDiagramsStore((s) => s.undoStack);
  const redoStack = useDiagramsStore((s) => s.redoStack);
  const settings = useDiagramsStore((s) => s.settings);
  const updateSettings = useDiagramsStore((s) => s.updateSettings);
  const loadDiagram = useDiagramsStore((s) => s.loadDiagram);
  const toDiagramFile = useDiagramsStore((s) => s.toDiagramFile);
  const aiLoading = useDiagramsStore((s) => s.aiLoading);
  const setAiLoading = useDiagramsStore((s) => s.setAiLoading);
  const selectedCount = useDiagramsStore((s) => s.nodes.filter((n) => n.selected).length);
  const reactFlow = useReactFlow();
  const viewport = useViewport();
  const { applyLayout } = useAutoLayout();
  const { applyElkLayout } = useElkLayout();
  const zoomPercent = Math.round(viewport.zoom * 100);

  const aiPromptHistory = useDiagramsStore((s) => s.aiPromptHistory);
  const addToPromptHistory = useDiagramsStore((s) => s.addToPromptHistory);

  const [aiMode, setAiMode] = useState<'generate' | 'modify' | 'explain' | 'suggest' | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiDiagramType, setAiDiagramType] = useState<string>('flowchart');
  const [aiModifySelected, setAiModifySelected] = useState(false);
  const [aiResult, setAiResult] = useState<{ type: 'explain'; text: string } | { type: 'suggest'; items: Array<{ id: string; type: string; message: string; nodeId?: string }> } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  const handleZoomIn = useCallback(() => reactFlow.zoomIn(), [reactFlow]);
  const handleZoomOut = useCallback(() => reactFlow.zoomOut(), [reactFlow]);
  const handleFitView = useCallback(() => reactFlow.fitView({ padding: 0.2 }), [reactFlow]);

  // ─── Export handlers ────────────────────────────────────

  const handleExportJSON = useCallback(() => {
    const file = toDiagramFile();
    const json = JSON.stringify(file, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.title || 'diagram'}.diagram.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [toDiagramFile]);

  const handleExportPNG = useCallback(async () => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    if (!el) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, {
        backgroundColor: '#111',
        filter: (node) => {
          if (node instanceof HTMLElement) {
            const cls = node.classList;
            if (cls?.contains('react-flow__minimap') || cls?.contains('react-flow__controls')) return false;
          }
          return true;
        },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${useDiagramsStore.getState().title || 'diagram'}.png`;
      a.click();
    } catch {
      // Silently fail if export not available
    }
  }, []);

  const handleExportSVG = useCallback(async () => {
    const el = document.querySelector('.react-flow') as HTMLElement | null;
    if (!el) return;
    try {
      const { toSvg } = await import('html-to-image');
      const dataUrl = await toSvg(el, {
        backgroundColor: '#111',
        filter: (node) => {
          if (node instanceof HTMLElement) {
            const cls = node.classList;
            if (cls?.contains('react-flow__minimap') || cls?.contains('react-flow__controls')) return false;
          }
          return true;
        },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${useDiagramsStore.getState().title || 'diagram'}.svg`;
      a.click();
    } catch {
      // Silently fail
    }
  }, []);

  // ─── PDF export ──────────────────────────────────────────

  const handleExportPDF = useCallback(async () => {
    try {
      const { exportPdf } = await import('./import/pdf-exporter');
      await exportPdf(useDiagramsStore.getState().title);
    } catch {
      // jspdf or html-to-image not available
    }
  }, []);

  // ─── Mermaid export ─────────────────────────────────────

  const handleExportMermaid = useCallback(() => {
    import('./import/mermaid-exporter').then(({ exportMermaid }) => {
      const file = toDiagramFile();
      const mmd = exportMermaid(file);
      const blob = new Blob([mmd], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.title || 'diagram'}.mmd`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [toDiagramFile]);

  // ─── draw.io export ─────────────────────────────────────

  const handleExportDrawio = useCallback(() => {
    import('./import/drawio-exporter').then(({ exportDrawio }) => {
      const file = toDiagramFile();
      const xml = exportDrawio(file);
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.title || 'diagram'}.drawio`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [toDiagramFile]);

  // ─── Import handlers ────────────────────────────────────

  const handleImportFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.diagram,.drawio,.xml,.mmd,.mermaid';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (isDirty && !window.confirm('Current diagram has unsaved changes. Import anyway?')) return;

      const text = await file.text();
      const ext = file.name.split('.').pop()?.toLowerCase();

      try {
        if (ext === 'drawio' || ext === 'xml') {
          const { parseDrawio } = await import('./import/drawio-parser');
          const diagram = parseDrawio(text);
          diagram.title = file.name.replace(/\.[^.]+$/, '');
          loadDiagram(diagram);
        } else if (ext === 'mmd' || ext === 'mermaid') {
          const { parseMermaid } = await import('./import/mermaid-parser');
          const diagram = parseMermaid(text);
          diagram.title = file.name.replace(/\.[^.]+$/, '');
          loadDiagram(diagram);
        } else {
          // JSON / .diagram
          const diagram: DiagramFile = JSON.parse(text);
          loadDiagram(diagram);
        }
      } catch {
        alert('Failed to import file. The format may not be supported.');
      }
    };
    input.click();
  }, [isDirty, loadDiagram]);

  // ─── Template loading ─────────────────────────────────

  const handleLoadTemplate = useCallback(
    async (type: string) => {
      if (isDirty && !window.confirm('Current diagram has unsaved changes. Load template anyway?')) return;
      setTemplateLoading(true);
      try {
        const res = await api.get<{ data: DiagramFile }>(`/diagrams/templates/${type}`);
        loadDiagram(res.data);
      } catch {
        // Template endpoint may not be available yet
      } finally {
        setTemplateLoading(false);
      }
    },
    [isDirty, loadDiagram],
  );

  // ─── AI handlers ──────────────────────────────────────

  const handleAiSubmit = useCallback(async () => {
    if (aiMode === 'explain' || aiMode === 'suggest') {
      // These don't need a prompt
      setAiLoading(true);
      setAiError('');
      setAiResult(null);
      try {
        const current = toDiagramFile();
        if (aiMode === 'explain') {
          const res = await api.post<{ data: { description: string } }>('/diagrams/explain', { diagram: current });
          setAiResult({ type: 'explain', text: res.data.description });
        } else {
          const res = await api.post<{ data: { suggestions: Array<{ id: string; type: string; message: string; nodeId?: string }> } }>('/diagrams/suggest', { diagram: current });
          setAiResult({ type: 'suggest', items: res.data.suggestions });
        }
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'AI request failed');
      } finally {
        setAiLoading(false);
      }
      return;
    }

    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    addToPromptHistory(aiPrompt.trim());
    try {
      if (aiMode === 'generate') {
        const res = await api.post<{ data: DiagramFile }>('/diagrams/generate', {
          description: aiPrompt,
          diagramType: aiDiagramType,
        });
        loadDiagram(res.data);
      } else {
        const current = toDiagramFile();
        // If modifying selected only, filter to selected nodes
        let diagramToSend = current;
        const currentNodes = useDiagramsStore.getState().nodes;
        const selCount = currentNodes.filter((n) => n.selected).length;
        if (aiModifySelected && selCount > 0) {
          const selectedIds = new Set(currentNodes.filter((n) => n.selected).map((n) => n.id));
          diagramToSend = {
            ...current,
            nodes: current.nodes.filter((n) => selectedIds.has(n.id)),
            edges: current.edges.filter((e) => selectedIds.has(e.source) || selectedIds.has(e.target)),
          };
        }
        const res = await api.post<{ data: DiagramFile }>('/diagrams/modify', {
          instruction: aiPrompt,
          currentDiagram: diagramToSend,
        });
        loadDiagram(res.data);
      }
      setAiMode(null);
      setAiPrompt('');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setAiLoading(false);
    }
  }, [aiMode, aiPrompt, aiDiagramType, aiModifySelected, loadDiagram, toDiagramFile, addToPromptHistory]);

  const handleExplainOrSuggest = useCallback(async (mode: 'explain' | 'suggest') => {
    setAiMode(mode);
    setAiError('');
    setAiResult(null);
    setAiLoading(true);
    try {
      const current = toDiagramFile();
      if (mode === 'explain') {
        const res = await api.post<{ data: { description: string } }>('/diagrams/explain', { diagram: current });
        setAiResult({ type: 'explain', text: res.data.description });
      } else {
        const res = await api.post<{ data: { suggestions: Array<{ id: string; type: string; message: string; nodeId?: string }> } }>('/diagrams/suggest', { diagram: current });
        setAiResult({ type: 'suggest', items: res.data.suggestions });
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setAiLoading(false);
    }
  }, [toDiagramFile]);

  // ─── Save status label ────────────────────────────────

  const saveLabel = saveStatus === 'saving' ? 'Saving...'
    : saveStatus === 'saved' ? 'Saved'
    : saveStatus === 'error' ? 'Save failed'
    : isDirty ? 'Unsaved' : null;

  const SaveStatusIcon = saveStatus === 'saving' ? Loader2
    : saveStatus === 'saved' ? CheckCircle2
    : saveStatus === 'error' ? AlertCircle
    : null;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          borderBottom: '1px solid var(--border, #333)',
          background: 'var(--surface, #1a1a1a)',
          flexShrink: 0,
          gap: 4,
          flexWrap: 'wrap',
        }}
      >
        {/* Title + save status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text, #e2e8f0)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-sans, system-ui)',
              minWidth: 80,
              maxWidth: 200,
            }}
          />
          {saveLabel && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              color: saveStatus === 'error' ? '#ef4444'
                : saveStatus === 'saved' ? '#22c55e'
                : 'var(--text-dim, #64748b)',
              whiteSpace: 'nowrap',
            }}>
              {SaveStatusIcon && <SaveStatusIcon size={10} className={saveStatus === 'saving' ? 'animate-spin' : ''} />}
              {saveLabel}
            </span>
          )}
        </div>

        <Divider />

        {/* Save button */}
        <ToolbarButton onClick={onSave} title="Save (Ctrl+S)" disabled={saveStatus === 'saving'}>
          <Save size={14} />
        </ToolbarButton>

        <Divider />

        {/* Undo / Redo */}
        <ToolbarButton onClick={undo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={redo} disabled={redoStack.length === 0} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={14} />
        </ToolbarButton>

        <Divider />

        {/* Layout dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button style={dropdownBtnStyle} title="Auto Layout">
              <ArrowDown size={12} />
              {!isMobile && <span>Layout</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <MenuLabel>Hierarchical (Dagre)</MenuLabel>
            {LAYOUT_OPTIONS.map(({ direction, label, icon: Icon }) => (
              <DropdownMenuItem key={direction} onClick={() => applyLayout(direction)}>
                <Icon size={14} />
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <MenuLabel>ELK Algorithms</MenuLabel>
            <DropdownMenuItem onClick={() => applyElkLayout('layered')}>
              <Network size={14} />
              Layered
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyElkLayout('mrtree')}>
              <TreePine size={14} />
              Tree
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyElkLayout('radial')}>
              <Circle size={14} />
              Radial
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyElkLayout('force')}>
              <Zap size={14} />
              Force-Directed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyElkLayout('stress')}>
              <GitBranch size={14} />
              Stress
            </DropdownMenuItem>
            {selectedCount >= 2 && (
              <>
                <DropdownMenuSeparator />
                <MenuLabel>Selected Only</MenuLabel>
                <DropdownMenuItem onClick={() => applyElkLayout('layered', true)}>
                  <Network size={14} />
                  Layout Selected
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Templates dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button style={dropdownBtnStyle} title="Templates" disabled={templateLoading}>
              {templateLoading ? <Loader2 size={12} className="animate-spin" /> : null}
              {!isMobile && <span>Templates</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {TEMPLATE_TYPES.map(({ type, label }) => (
              <DropdownMenuItem key={type} onClick={() => handleLoadTemplate(type)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Divider />

        {/* Quick toggles */}
        <ToolbarButton
          onClick={() => updateSettings({ showGrid: !settings.showGrid })}
          active={settings.showGrid}
          title="Toggle Grid"
        >
          <Grid3X3 size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => updateSettings({ snapToGrid: !settings.snapToGrid })}
          active={settings.snapToGrid}
          title="Snap to Grid"
        >
          <Magnet size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => updateSettings({ showMinimap: !settings.showMinimap })}
          active={settings.showMinimap}
          title="Toggle Minimap"
        >
          <Map size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => updateSettings({ autoSave: !settings.autoSave })}
          active={settings.autoSave}
          title="Auto-save"
        >
          <Save size={14} />
        </ToolbarButton>

        <Divider />

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button style={dropdownBtnStyle} title="Export">
              <Download size={12} />
              {!isMobile && <span>Export</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <MenuLabel>Image</MenuLabel>
            <DropdownMenuItem onClick={handleExportPNG}>
              <ImageIcon size={14} />
              PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportSVG}>
              <FileCode size={14} />
              SVG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPDF}>
              <FileText size={14} />
              PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <MenuLabel>Data</MenuLabel>
            <DropdownMenuItem onClick={handleExportJSON}>
              <Download size={14} />
              JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportMermaid}>
              <FileType size={14} />
              Mermaid
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportDrawio}>
              <FileCode size={14} />
              draw.io
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Import button */}
        <ToolbarButton onClick={handleImportFile} title="Import (.json, .drawio, .mmd)">
          <Upload size={14} />
        </ToolbarButton>

        <Divider />

        {/* AI dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button style={aiBtnStyle} title="AI Actions">
              <Sparkles size={12} />
              {!isMobile && <span>AI</span>}
              <ChevronDown size={10} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => { setAiMode('generate'); setAiPrompt(''); setAiError(''); setAiResult(null); }}>
              <Sparkles size={14} />
              Generate Diagram
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setAiMode('modify'); setAiPrompt(''); setAiError(''); setAiResult(null); }}>
              <Edit3 size={14} />
              Modify Diagram
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExplainOrSuggest('explain')}>
              <Eye size={14} />
              Explain Diagram
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExplainOrSuggest('suggest')}>
              <Lightbulb size={14} />
              Suggest Improvements
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div style={{ flex: 1 }} />

        {/* Selection indicator */}
        {selectedCount > 0 && (
          <span style={{
            fontSize: 10,
            color: 'var(--amber, #d4a017)',
            fontFamily: 'var(--font-sans, system-ui)',
            whiteSpace: 'nowrap',
            marginRight: 4,
          }}>
            {selectedCount} node{selectedCount !== 1 ? 's' : ''} selected
          </span>
        )}

        {selectedCount > 0 && <Divider />}

        {/* Zoom */}
        <ToolbarButton onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut size={14} />
        </ToolbarButton>
        <button
          onClick={handleFitView}
          onDoubleClick={() => reactFlow.zoomTo(1, { duration: 200 })}
          title="Fit View (double-click for 100%)"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 28,
            padding: '0 6px',
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--text, #e2e8f0)',
            cursor: 'pointer',
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            minWidth: 40,
          }}
        >
          {zoomPercent}%
        </button>
        <ToolbarButton onClick={handleZoomIn} title="Zoom In">
          <ZoomIn size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={handleFitView} title="Fit View">
          <Maximize size={14} />
        </ToolbarButton>
      </div>

      {/* AI prompt panel */}
      {(aiMode === 'generate' || aiMode === 'modify') && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid var(--border, #333)',
            background: 'var(--surface, #1a1a1a)',
          }}
        >
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={14} style={{ color: 'var(--amber, #d4a017)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-sans)', flex: 1 }}>
              {aiMode === 'generate' ? 'AI Generate' : 'AI Modify'}
            </span>
            <button onClick={() => { setAiMode(null); setAiResult(null); }} style={{ ...iconCloseBtnStyle }}>
              <X size={14} />
            </button>
          </div>

          {/* Options row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {aiMode === 'generate' && (
              <select
                value={aiDiagramType}
                onChange={(e) => setAiDiagramType(e.target.value)}
                style={selectStyle}
              >
                <option value="flowchart">Flowchart</option>
                <option value="erd">ERD</option>
                <option value="orgchart">Org Chart</option>
                <option value="mindmap">Mind Map</option>
                <option value="architecture">Architecture</option>
                <option value="custom">Custom</option>
              </select>
            )}
            {aiMode === 'modify' && selectedCount > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim, #94a3b8)', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={aiModifySelected}
                  onChange={(e) => setAiModifySelected(e.target.checked)}
                  style={{ accentColor: 'var(--amber, #d4a017)' }}
                />
                Selected only ({selectedCount})
              </label>
            )}
            {/* History button */}
            {aiPromptHistory.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  style={{ ...dropdownBtnStyle, gap: 3, padding: '0 6px', height: 24 }}
                  title="Prompt history"
                >
                  <History size={11} />
                  <span style={{ fontSize: 10 }}>History</span>
                </button>
                {showHistory && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: 'var(--surface, #1a1a1a)',
                    border: '1px solid var(--border, #333)',
                    borderRadius: 6,
                    padding: 4,
                    zIndex: 30,
                    maxHeight: 200,
                    overflowY: 'auto',
                    minWidth: 250,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  }}>
                    {aiPromptHistory.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => { setAiPrompt(p); setShowHistory(false); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '6px 8px',
                          fontSize: 11,
                          fontFamily: 'var(--font-sans)',
                          color: 'var(--text, #e2e8f0)',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,160,23,0.1)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Textarea + submit */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); }
                if (e.key === 'Escape') setAiMode(null);
              }}
              placeholder={aiMode === 'generate'
                ? 'Describe the diagram you want to create...\ne.g. A microservices architecture with API gateway, 3 services, and a database'
                : 'Describe how to modify the diagram...\ne.g. Add a load balancer between the API gateway and services'}
              autoFocus
              disabled={aiLoading}
              rows={3}
              style={{
                flex: 1,
                fontSize: 12,
                padding: '6px 8px',
                background: 'var(--background, #111)',
                border: '1px solid var(--border, #333)',
                borderRadius: 6,
                color: 'var(--text, #e2e8f0)',
                fontFamily: 'var(--font-sans, system-ui)',
                outline: 'none',
                resize: 'vertical',
                minHeight: 48,
                maxHeight: 150,
                lineHeight: 1.4,
              }}
            />
            <button
              onClick={handleAiSubmit}
              disabled={aiLoading || !aiPrompt.trim()}
              style={{
                ...aiBtnStyle,
                height: 36,
                opacity: aiLoading || !aiPrompt.trim() ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span>{aiLoading ? 'Working...' : aiMode === 'generate' ? 'Generate' : 'Apply'}</span>
            </button>
          </div>

          {aiError && (
            <span style={{ fontSize: 11, color: '#ef4444', fontFamily: 'var(--font-sans)' }}>
              {aiError}
            </span>
          )}
        </div>
      )}

      {/* AI result panel (explain/suggest) */}
      {aiResult && (
        <div
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border, #333)',
            background: 'var(--surface, #1a1a1a)',
            maxHeight: 250,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {aiResult.type === 'explain' ? <Eye size={14} style={{ color: 'var(--amber, #d4a017)' }} /> : <Lightbulb size={14} style={{ color: 'var(--amber, #d4a017)' }} />}
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-sans)', flex: 1 }}>
              {aiResult.type === 'explain' ? 'Diagram Explanation' : `Suggestions (${aiResult.items.length})`}
            </span>
            <button onClick={() => { setAiResult(null); setAiMode(null); }} style={iconCloseBtnStyle}>
              <X size={14} />
            </button>
          </div>

          {aiResult.type === 'explain' && (
            <p style={{ fontSize: 12, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-sans)', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
              {aiResult.text}
            </p>
          )}

          {aiResult.type === 'suggest' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {aiResult.items.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-dim, #94a3b8)', fontFamily: 'var(--font-sans)' }}>
                  No issues found — your diagram looks good!
                </span>
              )}
              {aiResult.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 4,
                    background: 'rgba(212,160,23,0.05)',
                    border: '1px solid var(--border, #333)',
                    cursor: item.nodeId ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (item.nodeId) {
                      useDiagramsStore.getState().selectElement('node', item.nodeId);
                    }
                  }}
                >
                  <span style={{
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: item.type === 'orphan' ? 'rgba(239,68,68,0.2)' : item.type === 'missing-label' ? 'rgba(251,191,36,0.2)' : 'rgba(59,130,246,0.2)',
                    color: item.type === 'orphan' ? '#ef4444' : item.type === 'missing-label' ? '#fbbf24' : '#3b82f6',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-sans)',
                    flexShrink: 0,
                  }}>
                    {item.type.replace('-', ' ')}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-sans)', flex: 1 }}>
                    {item.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI loading overlay */}
      {aiLoading && (aiMode === 'explain' || aiMode === 'suggest') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid var(--border, #333)',
            background: 'var(--surface, #1a1a1a)',
          }}
        >
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--amber, #d4a017)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-dim, #94a3b8)', fontFamily: 'var(--font-sans)' }}>
            {aiMode === 'explain' ? 'Analyzing diagram...' : 'Checking for improvements...'}
          </span>
        </div>
      )}
    </>
  );
}

// ─── Shared Components ──────────────────────────────────

function ToolbarButton({
  onClick,
  disabled,
  title,
  active,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 4,
        border: 'none',
        background: active ? 'var(--amber, #d4a017)' : 'transparent',
        color: active ? '#000' : disabled ? 'var(--text-dim, #475569)' : 'var(--text, #e2e8f0)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: 'var(--border, #333)', margin: '0 2px', flexShrink: 0 }} />;
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────

const dropdownBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  height: 28,
  padding: '0 8px',
  borderRadius: 4,
  border: '1px solid var(--border, #333)',
  background: 'transparent',
  color: 'var(--text, #e2e8f0)',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'var(--font-sans, system-ui)',
};

const aiBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  height: 28,
  padding: '0 10px',
  borderRadius: 4,
  border: '1px solid var(--amber, #d4a017)',
  background: 'rgba(212, 160, 23, 0.1)',
  color: 'var(--amber, #d4a017)',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'var(--font-sans, system-ui)',
  fontWeight: 500,
};

const iconCloseBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: 4,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-dim, #94a3b8)',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
};

const selectStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 6px',
  background: 'var(--background, #111)',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  color: 'var(--text, #e2e8f0)',
  fontFamily: 'var(--font-sans, system-ui)',
  outline: 'none',
  height: 24,
};
