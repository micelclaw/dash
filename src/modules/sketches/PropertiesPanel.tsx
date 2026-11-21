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
import { useI18n } from '@/i18n';
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
  const { t } = useI18n();
  const node = useDiagramsStore((s) => s.nodes.find((n) => n.id === id));
  const updateNodeData = useDiagramsStore((s) => s.updateNodeData);
  if (!node) return null;

  const d = node.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Section title={t('sketches.properties.section.fill')}>
        <ColorPicker value={d.color} onChange={(color) => updateNodeData(id, { color })} label={t('sketches.properties.field.shapeColor')} />
        <ColorPicker value={d.bgColor} onChange={(bgColor) => updateNodeData(id, { bgColor })} label={t('sketches.properties.field.background')} />
      </Section>

      <Section title={t('sketches.properties.section.text')}>
        <SliderField
          label={t('sketches.properties.field.fontSize')}
          value={d.fontSize || 12}
          min={8}
          max={48}
          onChange={(fontSize) => updateNodeData(id, { fontSize })}
          suffix="px"
        />
        <ColorPicker value={d.textColor} onChange={(textColor) => updateNodeData(id, { textColor })} label={t('sketches.properties.field.textColor')} />
        <TextFormatBar
          fontWeight={d.fontWeight}
          fontStyle={d.fontStyle}
          textDecoration={d.textDecoration}
          textAlign={d.textAlign}
          onChange={(data) => updateNodeData(id, data)}
        />
      </Section>

      <Section title={t('sketches.properties.section.border')} defaultOpen={false}>
        <SliderField
          label={t('sketches.properties.field.width')}
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
              <span style={miniLabelStyle}>{t('sketches.properties.field.style')}</span>
              <Segmented
                options={['solid', 'dashed', 'dotted'] as const}
                value={d.borderStyle || 'solid'}
                onChange={(borderStyle) => updateNodeData(id, { borderStyle })}
              />
            </div>
          </>
        )}
        <SliderField
          label={t('sketches.properties.field.radius')}
          value={d.borderRadius ?? 0}
          min={0}
          max={50}
          onChange={(borderRadius) => updateNodeData(id, { borderRadius })}
          suffix="px"
        />
      </Section>

      <Section title={t('sketches.properties.section.opacity')} defaultOpen={false}>
        <SliderField
          label={t('sketches.properties.field.opacity')}
          value={d.opacity ?? 100}
          min={0}
          max={100}
          onChange={(opacity) => updateNodeData(id, { opacity })}
          suffix="%"
        />
      </Section>

      <Section title={t('sketches.properties.section.animation')} defaultOpen={false}>
        <Toggle label={t('sketches.properties.field.pulse')} value={!!d.pulse} onChange={(v) => updateNodeData(id, { pulse: v })} />
      </Section>
    </div>
  );
}

// ─── Node Data Tab ──────────────────────────────────────

function NodeDataTab({ id }: { id: string }) {
  const { t } = useI18n();
  const node = useDiagramsStore((s) => s.nodes.find((n) => n.id === id));
  const updateNodeData = useDiagramsStore((s) => s.updateNodeData);
  const removeNode = useDiagramsStore((s) => s.removeNode);
  if (!node) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Field label={t('sketches.properties.field.label')}>
        <PanelInput
          data-diagram-label-input
          type="text"
          value={node.data.label || ''}
          onChange={(e) => updateNodeData(id, { label: e.target.value })}
        />
      </Field>

      <Field label={t('sketches.properties.field.description')}>
        <textarea
          value={node.data.description || ''}
          onChange={(e) => updateNodeData(id, { description: e.target.value })}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      <Section title={t('sketches.properties.section.icon')}>
        <IconPicker
          value={node.data.icon}
          onChange={(icon) => updateNodeData(id, { icon })}
        />
      </Section>

      <Field label={t('sketches.properties.field.type')}>
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

      <DangerButton onClick={() => removeNode(id)}>{t('sketches.properties.action.deleteNode')}</DangerButton>
    </div>
  );
}

// ─── Node Position Tab ──────────────────────────────────

function NodePositionTab({ id }: { id: string }) {
  const { t } = useI18n();
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
        <Field label={t('sketches.properties.field.x')}>
          <span style={readOnlyValue}>{x}</span>
        </Field>
        <Field label={t('sketches.properties.field.y')}>
          <span style={readOnlyValue}>{y}</span>
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label={t('sketches.properties.field.width')}>
          <span style={readOnlyValue}>{w}</span>
        </Field>
        <Field label={t('sketches.properties.field.height')}>
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
        {t('sketches.properties.action.resetSize')}
      </AddButton>
    </div>
  );
}

// ─── Node Properties Form (with Tabs) ───────────────────

function NodePropertiesForm({ id }: { id: string }) {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionTitle>{t('sketches.properties.tab.nodeProperties')}</SectionTitle>
      <Tabs defaultValue="style" className="w-full">
        <TabsList className="w-full h-7 bg-[var(--background,#111)] p-0.5 rounded-md">
          <TabsTrigger value="style" className="text-[10px] h-6 px-2 data-[state=active]:bg-[var(--amber,#d4a017)] data-[state=active]:text-black rounded">
            {t('sketches.properties.tab.style')}
          </TabsTrigger>
          <TabsTrigger value="data" className="text-[10px] h-6 px-2 data-[state=active]:bg-[var(--amber,#d4a017)] data-[state=active]:text-black rounded">
            {t('sketches.properties.tab.data')}
          </TabsTrigger>
          <TabsTrigger value="position" className="text-[10px] h-6 px-2 data-[state=active]:bg-[var(--amber,#d4a017)] data-[state=active]:text-black rounded">
            {t('sketches.properties.tab.position')}
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
  const { t } = useI18n();
  const edge = useDiagramsStore((s) => s.edges.find((e) => e.id === id));
  const updateEdgeData = useDiagramsStore((s) => s.updateEdgeData);
  const updateEdgeType = useDiagramsStore((s) => s.updateEdgeType);
  const updateEdgeAnimated = useDiagramsStore((s) => s.updateEdgeAnimated);
  const removeEdge = useDiagramsStore((s) => s.removeEdge);

  if (!edge) return null;

  const edgeData = (edge.data || {}) as Record<string, unknown>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionTitle>{t('sketches.properties.tab.edgeProperties')}</SectionTitle>

      <Field label={t('sketches.properties.field.label')}>
        <PanelInput
          type="text"
          value={(edge.label as string) || ''}
          onChange={(e) => updateEdgeData(id, {}, e.target.value)}
        />
      </Field>

      <Field label={t('sketches.properties.field.type')}>
        <select
          value={edge.type || 'smoothstep'}
          onChange={(e) => updateEdgeType(id, e.target.value)}
          style={inputStyle}
        >
          <option value="smoothstep">{t('sketches.properties.edgeType.smoothStep')}</option>
          <option value="step">{t('sketches.properties.edgeType.step')}</option>
          <option value="straight">{t('sketches.properties.edgeType.straight')}</option>
          <option value="default">{t('sketches.properties.edgeType.bezier')}</option>
          <option value="smart">{t('sketches.properties.edgeType.smart')}</option>
          <option value="elbow">{t('sketches.properties.edgeType.elbow')}</option>
          <option value="curved">{t('sketches.properties.edgeType.curved')}</option>
        </select>
      </Field>

      <Section title={t('sketches.properties.section.markers')}>
        <Field label={t('sketches.properties.field.start')}>
          <select
            value={(edgeData.markerStart as string) || 'none'}
            onChange={(e) => updateEdgeData(id, { markerStart: e.target.value as EdgeMarkerType })}
            style={inputStyle}
          >
            <option value="none">{t('sketches.properties.marker.none')}</option>
            <option value="arrow">{t('sketches.properties.marker.arrow')}</option>
            <option value="arrowClosed">{t('sketches.properties.marker.arrowFilled')}</option>
            <option value="diamond">{t('sketches.properties.marker.diamond')}</option>
            <option value="circle">{t('sketches.properties.marker.circle')}</option>
          </select>
        </Field>
        <Field label={t('sketches.properties.field.end')}>
          <select
            value={(edgeData.markerEnd as string) || 'none'}
            onChange={(e) => updateEdgeData(id, { markerEnd: e.target.value as EdgeMarkerType })}
            style={inputStyle}
          >
            <option value="none">{t('sketches.properties.marker.none')}</option>
            <option value="arrow">{t('sketches.properties.marker.arrow')}</option>
            <option value="arrowClosed">{t('sketches.properties.marker.arrowFilled')}</option>
            <option value="diamond">{t('sketches.properties.marker.diamond')}</option>
            <option value="circle">{t('sketches.properties.marker.circle')}</option>
          </select>
        </Field>
      </Section>

      <Section title={t('sketches.properties.section.appearance')}>
        <div>
          <span style={miniLabelStyle}>{t('sketches.properties.field.style')}</span>
          <Segmented
            options={['solid', 'dashed'] as const}
            value={edgeData.dashed ? 'dashed' : 'solid'}
            onChange={(s) => updateEdgeData(id, { dashed: s === 'dashed' })}
          />
        </div>

        <SliderField
          label={t('sketches.properties.field.strokeWidth')}
          value={(edgeData.strokeWidth as number) || 1.5}
          min={0.5}
          max={5}
          step={0.5}
          onChange={(strokeWidth) => updateEdgeData(id, { strokeWidth })}
          suffix="px"
        />

        <Toggle
          label={t('sketches.properties.field.animated')}
          value={!!edge.animated}
          onChange={(v) => updateEdgeAnimated(id, v)}
        />
      </Section>

      <Section title={t('sketches.properties.section.colors')} defaultOpen={false}>
        <ColorPicker
          value={edgeData.color as string | undefined}
          onChange={(color) => updateEdgeData(id, { color })}
          label={t('sketches.properties.field.strokeColor')}
        />
        <ColorPicker
          value={edgeData.labelBgColor as string | undefined}
          onChange={(labelBgColor) => updateEdgeData(id, { labelBgColor })}
          label={t('sketches.properties.field.labelBackground')}
        />
      </Section>

      <Section title={t('sketches.properties.section.animation')} defaultOpen={false}>
        <Toggle
          label={t('sketches.properties.field.dataFlow')}
          value={!!edgeData.dataFlow}
          onChange={(v) => updateEdgeData(id, { dataFlow: v })}
        />
        <Toggle
          label={t('sketches.properties.field.glow')}
          value={!!edgeData.glow}
          onChange={(v) => updateEdgeData(id, { glow: v })}
        />
      </Section>

      <DangerButton onClick={() => removeEdge(id)}>{t('sketches.properties.action.deleteEdge')}</DangerButton>
    </div>
  );
}

// ─── Canvas Settings Form ───────────────────────────────

function CanvasSettingsForm() {
  const { t } = useI18n();
  const settings = useDiagramsStore((s) => s.settings);
  const updateSettings = useDiagramsStore((s) => s.updateSettings);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionTitle>{t('sketches.properties.tab.canvasSettings')}</SectionTitle>

      <Section title={t('sketches.properties.section.grid')}>
        <Toggle label={t('sketches.properties.field.showGrid')} value={settings.showGrid} onChange={(v) => updateSettings({ showGrid: v })} />
        <Toggle label={t('sketches.properties.field.snapToGrid')} value={settings.snapToGrid} onChange={(v) => updateSettings({ snapToGrid: v })} />
        <SliderField
          label={t('sketches.properties.field.gridSize')}
          value={settings.gridSize}
          min={5}
          max={50}
          step={5}
          onChange={(gridSize) => updateSettings({ gridSize })}
          suffix="px"
        />
      </Section>

      <Section title={t('sketches.properties.section.guides')}>
        <Toggle label={t('sketches.properties.field.snapToGuides')} value={settings.snapToGuides} onChange={(v) => updateSettings({ snapToGuides: v })} />
      </Section>

      <Section title={t('sketches.properties.section.view')}>
        <Toggle label={t('sketches.properties.field.showMinimap')} value={settings.showMinimap} onChange={(v) => updateSettings({ showMinimap: v })} />
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
