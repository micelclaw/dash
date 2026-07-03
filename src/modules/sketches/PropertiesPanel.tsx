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

// ─── Panel de propiedades del editor de diagramas ───────
// Formularios de nodo/arista/canvas. Las primitivas (pickers, toolbars,
// segmentos, editores de filas, stats) viven en components/properties/*.

import { RotateCcw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { SHAPE_DEFAULTS } from './types';
import type { NodeShapeType, EdgeMarkerType } from './types';
import {
  AddButton, DangerButton, Field, PanelInput, Section, SectionTitle, Toggle,
  inputStyle, miniLabelStyle, readOnlyValue,
} from './components/properties/shared';
import { ColorPicker } from './components/properties/ColorPicker';
import { IconPicker } from './components/properties/IconPicker';
import { TextFormatBar } from './components/properties/TextFormatBar';
import { SliderField } from './components/properties/SliderField';
import { Segmented } from './components/properties/Segmented';
import { TableRowsEditor, CardPropertiesEditor } from './components/properties/RowEditors';
import { SelectionStats } from './components/properties/SelectionStats';

// ─── Node Style Tab ─────────────────────────────────────

function NodeStyleTab({ id }: { id: string }) {
  const node = useDiagramsStore((s) => s.nodes.find((n) => n.id === id));
  const updateNodeData = useDiagramsStore((s) => s.updateNodeData);
  if (!node) return null;

  const d = node.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Section title="Fill">
        <ColorPicker value={d.color} onChange={(color) => updateNodeData(id, { color })} label="Shape Color" />
        <ColorPicker value={d.bgColor} onChange={(bgColor) => updateNodeData(id, { bgColor })} label="Background" />
      </Section>

      <Section title="Text">
        <SliderField
          label="Font Size"
          value={d.fontSize || 12}
          min={8}
          max={48}
          onChange={(fontSize) => updateNodeData(id, { fontSize })}
          suffix="px"
        />
        <ColorPicker value={d.textColor} onChange={(textColor) => updateNodeData(id, { textColor })} label="Text Color" />
        <TextFormatBar
          fontWeight={d.fontWeight}
          fontStyle={d.fontStyle}
          textDecoration={d.textDecoration}
          textAlign={d.textAlign}
          onChange={(data) => updateNodeData(id, data)}
        />
      </Section>

      <Section title="Border" defaultOpen={false}>
        <SliderField
          label="Width"
          value={d.borderWidth ?? 0}
          min={0}
          max={8}
          step={0.5}
          onChange={(borderWidth) => updateNodeData(id, { borderWidth })}
          suffix="px"
        />
        {(d.borderWidth ?? 0) > 0 && (
          <>
            <ColorPicker value={d.borderColor} onChange={(borderColor) => updateNodeData(id, { borderColor })} />
            <div>
              <span style={miniLabelStyle}>Style</span>
              <Segmented
                options={['solid', 'dashed', 'dotted'] as const}
                value={d.borderStyle || 'solid'}
                onChange={(borderStyle) => updateNodeData(id, { borderStyle })}
              />
            </div>
          </>
        )}
        <SliderField
          label="Radius"
          value={d.borderRadius ?? 0}
          min={0}
          max={50}
          onChange={(borderRadius) => updateNodeData(id, { borderRadius })}
          suffix="px"
        />
      </Section>

      <Section title="Opacity" defaultOpen={false}>
        <SliderField
          label="Opacity"
          value={d.opacity ?? 100}
          min={0}
          max={100}
          onChange={(opacity) => updateNodeData(id, { opacity })}
          suffix="%"
        />
      </Section>

      <Section title="Animation" defaultOpen={false}>
        <Toggle label="Pulse" value={!!d.pulse} onChange={(v) => updateNodeData(id, { pulse: v })} />
      </Section>
    </div>
  );
}

// ─── Node Data Tab ──────────────────────────────────────

function NodeDataTab({ id }: { id: string }) {
  const node = useDiagramsStore((s) => s.nodes.find((n) => n.id === id));
  const updateNodeData = useDiagramsStore((s) => s.updateNodeData);
  const removeNode = useDiagramsStore((s) => s.removeNode);
  if (!node) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Field label="Label">
        <PanelInput
          data-diagram-label-input
          type="text"
          value={node.data.label || ''}
          onChange={(e) => updateNodeData(id, { label: e.target.value })}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={node.data.description || ''}
          onChange={(e) => updateNodeData(id, { description: e.target.value })}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      <Section title="Icon">
        <IconPicker
          value={node.data.icon}
          onChange={(icon) => updateNodeData(id, { icon })}
        />
      </Section>

      <Field label="Type">
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
          {node.type}
        </span>
      </Field>

      {node.type === 'table' && (
        <TableRowsEditor
          rows={(node.data.rows || []) as Array<{ key: string; value: string; type?: string }>}
          onChange={(rows) => updateNodeData(id, { rows })}
        />
      )}

      {node.type === 'card' && (
        <CardPropertiesEditor
          properties={(node.data.properties || []) as Array<{ key: string; value: string }>}
          onChange={(properties) => updateNodeData(id, { properties })}
        />
      )}

      <DangerButton onClick={() => removeNode(id)}>Delete Node</DangerButton>
    </div>
  );
}

// ─── Node Position Tab ──────────────────────────────────

function NodePositionTab({ id }: { id: string }) {
  const node = useDiagramsStore((s) => s.nodes.find((n) => n.id === id));
  const updateNodeSize = useDiagramsStore((s) => s.updateNodeSize);
  if (!node) return null;

  const w = Math.round(node.width || node.measured?.width || 160);
  const h = Math.round(node.height || node.measured?.height || 70);
  const x = Math.round(node.position.x);
  const y = Math.round(node.position.y);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="X">
          <span style={readOnlyValue}>{x}</span>
        </Field>
        <Field label="Y">
          <span style={readOnlyValue}>{y}</span>
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="Width">
          <span style={readOnlyValue}>{w}</span>
        </Field>
        <Field label="Height">
          <span style={readOnlyValue}>{h}</span>
        </Field>
      </div>

      <AddButton
        className="gap-1"
        onClick={() => {
          const defaults = SHAPE_DEFAULTS[node.type as NodeShapeType];
          if (defaults) updateNodeSize(id, defaults.width, defaults.height);
        }}
      >
        <RotateCcw size={10} />
        Reset to Default Size
      </AddButton>
    </div>
  );
}

// ─── Node Properties Form (with Tabs) ───────────────────

function NodePropertiesForm({ id }: { id: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionTitle>Node Properties</SectionTitle>
      <Tabs defaultValue="style" className="w-full">
        <TabsList className="w-full h-7 bg-[var(--background,#111)] p-0.5 rounded-md">
          <TabsTrigger value="style" className="text-[10px] h-6 px-2 data-[state=active]:bg-[var(--amber,#d4a017)] data-[state=active]:text-black rounded">
            Style
          </TabsTrigger>
          <TabsTrigger value="data" className="text-[10px] h-6 px-2 data-[state=active]:bg-[var(--amber,#d4a017)] data-[state=active]:text-black rounded">
            Data
          </TabsTrigger>
          <TabsTrigger value="position" className="text-[10px] h-6 px-2 data-[state=active]:bg-[var(--amber,#d4a017)] data-[state=active]:text-black rounded">
            Position
          </TabsTrigger>
        </TabsList>
        <TabsContent value="style" className="mt-2">
          <NodeStyleTab id={id} />
        </TabsContent>
        <TabsContent value="data" className="mt-2">
          <NodeDataTab id={id} />
        </TabsContent>
        <TabsContent value="position" className="mt-2">
          <NodePositionTab id={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Edge Properties Form ───────────────────────────────

function EdgePropertiesForm({ id }: { id: string }) {
  const edge = useDiagramsStore((s) => s.edges.find((e) => e.id === id));
  const updateEdgeData = useDiagramsStore((s) => s.updateEdgeData);
  const updateEdgeType = useDiagramsStore((s) => s.updateEdgeType);
  const updateEdgeAnimated = useDiagramsStore((s) => s.updateEdgeAnimated);
  const removeEdge = useDiagramsStore((s) => s.removeEdge);

  if (!edge) return null;

  const edgeData = (edge.data || {}) as Record<string, unknown>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionTitle>Edge Properties</SectionTitle>

      <Field label="Label">
        <PanelInput
          type="text"
          value={(edge.label as string) || ''}
          onChange={(e) => updateEdgeData(id, {}, e.target.value)}
        />
      </Field>

      <Field label="Type">
        <select
          value={edge.type || 'smoothstep'}
          onChange={(e) => updateEdgeType(id, e.target.value)}
          style={inputStyle}
        >
          <option value="smoothstep">Smooth Step</option>
          <option value="step">Step</option>
          <option value="straight">Straight</option>
          <option value="default">Bezier</option>
          <option value="smart">Smart (avoid nodes)</option>
          <option value="elbow">Elbow (90°)</option>
          <option value="curved">Curved</option>
        </select>
      </Field>

      <Section title="Markers">
        <Field label="Start">
          <select
            value={(edgeData.markerStart as string) || 'none'}
            onChange={(e) => updateEdgeData(id, { markerStart: e.target.value as EdgeMarkerType })}
            style={inputStyle}
          >
            <option value="none">None</option>
            <option value="arrow">Arrow</option>
            <option value="arrowClosed">Arrow (filled)</option>
            <option value="diamond">Diamond</option>
            <option value="circle">Circle</option>
          </select>
        </Field>
        <Field label="End">
          <select
            value={(edgeData.markerEnd as string) || 'none'}
            onChange={(e) => updateEdgeData(id, { markerEnd: e.target.value as EdgeMarkerType })}
            style={inputStyle}
          >
            <option value="none">None</option>
            <option value="arrow">Arrow</option>
            <option value="arrowClosed">Arrow (filled)</option>
            <option value="diamond">Diamond</option>
            <option value="circle">Circle</option>
          </select>
        </Field>
      </Section>

      <Section title="Appearance">
        <div>
          <span style={miniLabelStyle}>Style</span>
          <Segmented
            options={['solid', 'dashed'] as const}
            value={edgeData.dashed ? 'dashed' : 'solid'}
            onChange={(s) => updateEdgeData(id, { dashed: s === 'dashed' })}
          />
        </div>

        <SliderField
          label="Stroke Width"
          value={(edgeData.strokeWidth as number) || 1.5}
          min={0.5}
          max={5}
          step={0.5}
          onChange={(strokeWidth) => updateEdgeData(id, { strokeWidth })}
          suffix="px"
        />

        <Toggle
          label="Animated"
          value={!!edge.animated}
          onChange={(v) => updateEdgeAnimated(id, v)}
        />
      </Section>

      <Section title="Colors" defaultOpen={false}>
        <ColorPicker
          value={edgeData.color as string | undefined}
          onChange={(color) => updateEdgeData(id, { color })}
          label="Stroke Color"
        />
        <ColorPicker
          value={edgeData.labelBgColor as string | undefined}
          onChange={(labelBgColor) => updateEdgeData(id, { labelBgColor })}
          label="Label Background"
        />
      </Section>

      <Section title="Animation" defaultOpen={false}>
        <Toggle
          label="Data Flow"
          value={!!edgeData.dataFlow}
          onChange={(v) => updateEdgeData(id, { dataFlow: v })}
        />
        <Toggle
          label="Glow"
          value={!!edgeData.glow}
          onChange={(v) => updateEdgeData(id, { glow: v })}
        />
      </Section>

      <DangerButton onClick={() => removeEdge(id)}>Delete Edge</DangerButton>
    </div>
  );
}

// ─── Canvas Settings Form ───────────────────────────────

function CanvasSettingsForm() {
  const settings = useDiagramsStore((s) => s.settings);
  const updateSettings = useDiagramsStore((s) => s.updateSettings);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionTitle>Canvas Settings</SectionTitle>

      <Section title="Grid">
        <Toggle label="Show Grid" value={settings.showGrid} onChange={(v) => updateSettings({ showGrid: v })} />
        <Toggle label="Snap to Grid" value={settings.snapToGrid} onChange={(v) => updateSettings({ snapToGrid: v })} />
        <SliderField
          label="Grid Size"
          value={settings.gridSize}
          min={5}
          max={50}
          step={5}
          onChange={(gridSize) => updateSettings({ gridSize })}
          suffix="px"
        />
      </Section>

      <Section title="Guides">
        <Toggle label="Snap to Guides" value={settings.snapToGuides} onChange={(v) => updateSettings({ snapToGuides: v })} />
      </Section>

      <Section title="View">
        <Toggle label="Show Minimap" value={settings.showMinimap} onChange={(v) => updateSettings({ showMinimap: v })} />
      </Section>
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────

export function PropertiesPanel({ embedded }: { embedded?: boolean } = {}) {
  const selectedElement = useDiagramsStore((s) => s.selectedElement);
  const nodes = useDiagramsStore((s) => s.nodes);
  const multiSelected = nodes.filter((n) => n.selected).length > 1;

  return (
    <div
      style={{
        width: embedded ? '100%' : 256,
        borderLeft: embedded ? 'none' : '1px solid var(--border, #333)',
        background: embedded ? 'transparent' : 'var(--surface, #1a1a1a)',
        overflowY: 'auto',
        flexShrink: 0,
        padding: 10,
      }}
    >
      {multiSelected && <SelectionStats />}
      {!multiSelected && selectedElement?.type === 'node' && <NodePropertiesForm id={selectedElement.id} />}
      {!multiSelected && selectedElement?.type === 'edge' && <EdgePropertiesForm id={selectedElement.id} />}
      {!multiSelected && !selectedElement && <CanvasSettingsForm />}
    </div>
  );
}
