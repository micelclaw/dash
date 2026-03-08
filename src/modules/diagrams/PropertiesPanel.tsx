import { useState } from 'react';
import { icons, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, RotateCcw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { useDiagramsStore } from '@/stores/diagrams.store';
import { COLOR_PALETTE, SHAPE_DEFAULTS } from './types';
import type { NodeShapeType, EdgeMarkerType } from './types';

// ─── Color Picker (expanded with HEX input) ─────────────

function ColorPicker({
  value,
  onChange,
  label,
}: {
  value?: string;
  onChange: (c: string) => void;
  label?: string;
}) {
  const [hexInput, setHexInput] = useState('');
  const [showHex, setShowHex] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={miniLabelStyle}>{label}</span>}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              background: c,
              border: value === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              padding: 0,
              transition: 'transform 0.1s',
            }}
          />
        ))}
        <button
          onClick={() => setShowHex(!showHex)}
          title="Custom HEX"
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            background: showHex ? 'var(--amber, #d4a017)' : 'var(--surface, #1e1e1e)',
            border: '1px solid var(--border, #333)',
            cursor: 'pointer',
            padding: 0,
            fontSize: 10,
            color: showHex ? '#000' : 'var(--text-dim)',
            lineHeight: 1,
          }}
        >
          #
        </button>
      </div>
      {showHex && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>#</span>
          <input
            type="text"
            value={hexInput || (value?.replace('#', '') ?? '')}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
              setHexInput(v);
              if (v.length === 6 || v.length === 3) onChange(`#${v}`);
            }}
            onBlur={() => setHexInput('')}
            placeholder="3b82f6"
            maxLength={6}
            style={{ ...inputStyle, width: 70, fontFamily: 'var(--font-mono, monospace)', fontSize: 10 }}
          />
          {value && (
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 3,
                background: value,
                border: '1px solid rgba(255,255,255,0.15)',
                flexShrink: 0,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Icon Picker (searchable grid) ──────────────────────

const COMMON_ICONS = [
  'Database', 'Server', 'Cloud', 'Globe', 'Lock', 'Key', 'User', 'Users',
  'Settings', 'Mail', 'File', 'Folder', 'Code', 'Terminal', 'Monitor',
  'Smartphone', 'Wifi', 'Shield', 'Zap', 'Activity',
];

function IconPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (icon: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filteredIcons = search
    ? Object.keys(icons)
        .filter((name) => name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 30)
    : COMMON_ICONS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="text"
          value={search || value || ''}
          onChange={(e) => {
            setSearch(e.target.value);
            setExpanded(true);
          }}
          onFocus={() => setExpanded(true)}
          placeholder="Search icons..."
          style={{ ...inputStyle, flex: 1, fontSize: 10 }}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            style={{ ...removeBtnStyle, fontSize: 11 }}
            title="Clear icon"
          >
            ×
          </button>
        )}
      </div>
      {expanded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 2,
            maxHeight: 120,
            overflowY: 'auto',
          }}
        >
          {filteredIcons.map((name) => {
            const Icon = icons[name as keyof typeof icons];
            if (!Icon) return null;
            return (
              <button
                key={name}
                onClick={() => {
                  onChange(name);
                  setSearch('');
                  setExpanded(false);
                }}
                title={name}
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: value === name ? 'var(--amber, #d4a017)' : 'transparent',
                  border: '1px solid var(--border, #333)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  padding: 0,
                  color: value === name ? '#000' : 'var(--text-dim)',
                }}
              >
                <Icon size={14} />
              </button>
            );
          })}
          {filteredIcons.length === 0 && (
            <span style={{ gridColumn: '1 / -1', fontSize: 10, color: 'var(--text-dim)', padding: 4 }}>
              No icons found
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Text Format Toggles ────────────────────────────────

function TextFormatBar({
  fontWeight,
  fontStyle,
  textDecoration,
  textAlign,
  onChange,
}: {
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: string;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const toggles = [
    { key: 'fontWeight', icon: Bold, active: fontWeight === 'bold', on: 'bold', off: 'normal' },
    { key: 'fontStyle', icon: Italic, active: fontStyle === 'italic', on: 'italic', off: 'normal' },
    { key: 'textDecoration', icon: Underline, active: textDecoration === 'underline', on: 'underline', off: 'none' },
  ] as const;

  const aligns = [
    { value: 'left', icon: AlignLeft },
    { value: 'center', icon: AlignCenter },
    { value: 'right', icon: AlignRight },
  ] as const;

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      <div style={{ display: 'flex', gap: 1, borderRight: '1px solid var(--border, #333)', paddingRight: 4, marginRight: 2 }}>
        {toggles.map(({ key, icon: Icon, active, on, off }) => (
          <button
            key={key}
            onClick={() => onChange({ [key]: active ? off : on })}
            style={{
              ...formatBtnStyle,
              background: active ? 'var(--amber, #d4a017)' : 'transparent',
              color: active ? '#000' : 'var(--text-dim)',
            }}
            title={key}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 1 }}>
        {aligns.map(({ value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onChange({ textAlign: value })}
            style={{
              ...formatBtnStyle,
              background: (textAlign || 'center') === value ? 'var(--amber, #d4a017)' : 'transparent',
              color: (textAlign || 'center') === value ? '#000' : 'var(--text-dim)',
            }}
            title={`Align ${value}`}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Slider Field ───────────────────────────────────────

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={miniLabelStyle}>{label}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text, #e2e8f0)' }}>
          {value}{suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="w-full [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-range]]:bg-amber-500 [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-amber-500"
      />
    </div>
  );
}

// ─── Collapsible Section ────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--border, #333)', paddingBottom: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          color: 'var(--text-dim, #94a3b8)',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          fontFamily: 'var(--font-sans, system-ui)',
        }}
      >
        {title}
        <span style={{ fontSize: 8, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
          ▶
        </span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>{children}</div>}
    </div>
  );
}

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
              <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                {(['solid', 'dashed', 'dotted'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateNodeData(id, { borderStyle: s })}
                    style={{
                      ...segmentStyle,
                      background: (d.borderStyle || 'solid') === s ? 'var(--amber, #d4a017)' : 'var(--surface, #1e1e1e)',
                      color: (d.borderStyle || 'solid') === s ? '#000' : 'var(--text-dim)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
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
        <input
          data-diagram-label-input
          type="text"
          value={node.data.label || ''}
          onChange={(e) => updateNodeData(id, { label: e.target.value })}
          style={inputStyle}
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

      <button onClick={() => removeNode(id)} style={dangerBtnStyle}>
        Delete Node
      </button>
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

      <button
        onClick={() => {
          const defaults = SHAPE_DEFAULTS[node.type as NodeShapeType];
          if (defaults) updateNodeSize(id, defaults.width, defaults.height);
        }}
        style={addBtnStyle}
      >
        <RotateCcw size={10} style={{ marginRight: 4 }} />
        Reset to Default Size
      </button>
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

// ─── Table Rows Editor ──────────────────────────────────

function TableRowsEditor({
  rows,
  onChange,
}: {
  rows: Array<{ key: string; value: string; type?: string }>;
  onChange: (rows: Array<{ key: string; value: string; type?: string }>) => void;
}) {
  const update = (i: number, field: string, val: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r));
    onChange(next);
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { key: '', value: '', type: 'field' }]);

  return (
    <Section title="Columns">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={add} style={addBtnStyle}>+ Add</button>
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <select
            value={row.type || 'field'}
            onChange={(e) => update(i, 'type', e.target.value)}
            style={{ ...inputStyle, width: 42, padding: '2px 2px', fontSize: 10 }}
          >
            <option value="pk">PK</option>
            <option value="fk">FK</option>
            <option value="field">·</option>
          </select>
          <input
            type="text"
            value={row.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder="name"
            style={{ ...inputStyle, flex: 1, fontSize: 10, padding: '2px 4px' }}
          />
          <input
            type="text"
            value={row.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            placeholder="type"
            style={{ ...inputStyle, width: 50, fontSize: 10, padding: '2px 4px' }}
          />
          <button onClick={() => remove(i)} style={removeBtnStyle}>×</button>
        </div>
      ))}
    </Section>
  );
}

// ─── Card Properties Editor ─────────────────────────────

function CardPropertiesEditor({
  properties,
  onChange,
}: {
  properties: Array<{ key: string; value: string }>;
  onChange: (props: Array<{ key: string; value: string }>) => void;
}) {
  const update = (i: number, field: string, val: string) => {
    const next = properties.map((p, idx) => (idx === i ? { ...p, [field]: val } : p));
    onChange(next);
  };
  const remove = (i: number) => onChange(properties.filter((_, idx) => idx !== i));
  const add = () => onChange([...properties, { key: '', value: '' }]);

  return (
    <Section title="Properties">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={add} style={addBtnStyle}>+ Add</button>
      </div>
      {properties.map((prop, i) => (
        <div key={i} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <input
            type="text"
            value={prop.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder="key"
            style={{ ...inputStyle, flex: 1, fontSize: 10, padding: '2px 4px' }}
          />
          <input
            type="text"
            value={prop.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            placeholder="value"
            style={{ ...inputStyle, flex: 1, fontSize: 10, padding: '2px 4px' }}
          />
          <button onClick={() => remove(i)} style={removeBtnStyle}>×</button>
        </div>
      ))}
    </Section>
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
        <input
          type="text"
          value={(edge.label as string) || ''}
          onChange={(e) => updateEdgeData(id, {}, e.target.value)}
          style={inputStyle}
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
          <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
            {(['solid', 'dashed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateEdgeData(id, { dashed: s === 'dashed' })}
                style={{
                  ...segmentStyle,
                  background: (s === 'dashed') === !!edgeData.dashed
                    ? 'var(--amber, #d4a017)'
                    : 'var(--surface, #1e1e1e)',
                  color: (s === 'dashed') === !!edgeData.dashed
                    ? '#000'
                    : 'var(--text-dim)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
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

      <button onClick={() => removeEdge(id)} style={dangerBtnStyle}>
        Delete Edge
      </button>
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

// ─── Selection Statistics ────────────────────────────────

function SelectionStats() {
  const nodes = useDiagramsStore((s) => s.nodes);
  const edges = useDiagramsStore((s) => s.edges);

  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedEdges = edges.filter((e) => e.selected);

  if (selectedNodes.length < 2 && selectedEdges.length === 0) return null;

  // Type distribution
  const typeCounts = new Map<string, number>();
  for (const n of selectedNodes) {
    typeCounts.set(n.type, (typeCounts.get(n.type) || 0) + 1);
  }

  // Bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of selectedNodes) {
    const w = n.width || n.measured?.width || 160;
    const h = n.height || n.measured?.height || 70;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionTitle>Selection</SectionTitle>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={statBoxStyle}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-mono, monospace)' }}>
            {selectedNodes.length}
          </span>
          <span style={miniLabelStyle}>nodes</span>
        </div>
        <div style={statBoxStyle}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-mono, monospace)' }}>
            {selectedEdges.length}
          </span>
          <span style={miniLabelStyle}>edges</span>
        </div>
      </div>

      {typeCounts.size > 0 && (
        <Section title="By Type" defaultOpen={false}>
          {Array.from(typeCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)' }}>{type}</span>
                <span style={{ fontSize: 10, color: 'var(--text, #e2e8f0)', fontFamily: 'var(--font-mono, monospace)' }}>{count}</span>
              </div>
            ))}
        </Section>
      )}

      {selectedNodes.length >= 2 && minX !== Infinity && (
        <Section title="Bounding Box" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <div>
              <span style={miniLabelStyle}>Width</span>
              <span style={{ ...readOnlyValue, fontSize: 10, padding: '2px 6px' }}>{Math.round(maxX - minX)}</span>
            </div>
            <div>
              <span style={miniLabelStyle}>Height</span>
              <span style={{ ...readOnlyValue, fontSize: 10, padding: '2px 6px' }}>{Math.round(maxY - minY)}</span>
            </div>
          </div>
        </Section>
      )}
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

// ─── Shared UI ──────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-dim, #94a3b8)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontFamily: 'var(--font-sans, system-ui)',
        paddingBottom: 4,
        borderBottom: '1px solid var(--border, #333)',
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={miniLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        fontSize: 11,
        color: 'var(--text, #e2e8f0)',
        fontFamily: 'var(--font-sans, system-ui)',
      }}
    >
      {label}
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 32,
          height: 18,
          borderRadius: 9,
          border: 'none',
          background: value ? 'var(--amber, #d4a017)' : 'var(--border, #333)',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.15s',
          padding: 0,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: 2,
            left: value ? 16 : 2,
            transition: 'left 0.15s',
          }}
        />
      </button>
    </label>
  );
}

// ─── Styles ─────────────────────────────────────────────

const miniLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--text-dim, #94a3b8)',
  fontFamily: 'var(--font-sans, system-ui)',
};

const inputStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '4px 8px',
  background: 'var(--background, #111)',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  color: 'var(--text, #e2e8f0)',
  fontFamily: 'var(--font-sans, system-ui)',
  outline: 'none',
  width: '100%',
};

const readOnlyValue: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-mono, monospace)',
  color: 'var(--text, #e2e8f0)',
  background: 'var(--background, #111)',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  padding: '4px 8px',
  display: 'block',
};

const segmentStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '3px 8px',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans, system-ui)',
  textTransform: 'capitalize',
};

const formatBtnStyle: React.CSSProperties = {
  width: 26,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border, #333)',
  borderRadius: 3,
  cursor: 'pointer',
  padding: 0,
  transition: 'background 0.1s',
};

const addBtnStyle: React.CSSProperties = {
  fontSize: 10,
  padding: '3px 8px',
  background: 'transparent',
  border: '1px solid var(--border, #333)',
  borderRadius: 4,
  color: 'var(--text-dim, #94a3b8)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans, system-ui)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const removeBtnStyle: React.CSSProperties = {
  fontSize: 14,
  width: 18,
  height: 18,
  padding: 0,
  background: 'transparent',
  border: 'none',
  color: '#ef4444',
  cursor: 'pointer',
  lineHeight: 1,
  flexShrink: 0,
};

const statBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  padding: '6px 4px',
  background: 'var(--background, #111)',
  border: '1px solid var(--border, #333)',
  borderRadius: 6,
};

const dangerBtnStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '5px 10px',
  background: 'transparent',
  border: '1px solid #ef4444',
  borderRadius: 4,
  color: '#ef4444',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans, system-ui)',
  marginTop: 8,
};
