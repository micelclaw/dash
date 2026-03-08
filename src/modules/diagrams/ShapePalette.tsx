import { useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import type { NodeShapeType } from './types';

interface ShapeEntry {
  type: NodeShapeType;
  label: string;
}

interface ShapeGroup {
  label: string;
  shapes: ShapeEntry[];
}

const SHAPE_GROUPS: ShapeGroup[] = [
  {
    label: 'Basic',
    shapes: [
      { type: 'rectangle', label: 'Rectangle' },
      { type: 'rounded', label: 'Rounded' },
      { type: 'circle', label: 'Circle' },
      { type: 'triangle', label: 'Triangle' },
      { type: 'pentagon', label: 'Pentagon' },
      { type: 'badge', label: 'Badge' },
    ],
  },
  {
    label: 'Flow',
    shapes: [
      { type: 'diamond', label: 'Diamond' },
      { type: 'parallelogram', label: 'Parallelogram' },
      { type: 'trapezoid', label: 'Trapezoid' },
      { type: 'hexagon', label: 'Hexagon' },
      { type: 'banner', label: 'Banner' },
    ],
  },
  {
    label: 'Data',
    shapes: [
      { type: 'cylinder', label: 'Cylinder' },
      { type: 'database3d', label: 'Database 3D' },
      { type: 'table', label: 'Table' },
      { type: 'card', label: 'Card' },
      { type: 'document', label: 'Document' },
      { type: 'queue', label: 'Queue' },
      { type: 'stack', label: 'Stack' },
    ],
  },
  {
    label: 'UML',
    shapes: [
      { type: 'actor', label: 'Actor' },
      { type: 'note', label: 'Note' },
      { type: 'separator', label: 'Separator' },
    ],
  },
  {
    label: 'Network',
    shapes: [
      { type: 'server', label: 'Server' },
      { type: 'desktop', label: 'Desktop' },
      { type: 'mobile', label: 'Mobile' },
      { type: 'router', label: 'Router' },
      { type: 'firewall', label: 'Firewall' },
      { type: 'cloud', label: 'Cloud' },
    ],
  },
  {
    label: 'Content',
    shapes: [
      { type: 'markdown', label: 'Markdown' },
      { type: 'codeblock', label: 'Code Block' },
      { type: 'link', label: 'Link' },
      { type: 'list', label: 'Checklist' },
      { type: 'embed', label: 'Embed' },
    ],
  },
  {
    label: 'Special',
    shapes: [
      { type: 'group', label: 'Group' },
      { type: 'sticky', label: 'Sticky' },
      { type: 'image', label: 'Image' },
    ],
  },
];

// ─── Mini SVG Previews ────────────────────────────────────

function ShapePreview({ type }: { type: NodeShapeType }) {
  const s = 36;
  const common = { fill: 'currentColor', fillOpacity: 0.15, stroke: 'currentColor', strokeWidth: 1.5 };

  switch (type) {
    case 'rectangle':
      return <svg width={s} height={s} viewBox="0 0 28 28"><rect x="2" y="5" width="24" height="18" rx="2" {...common} /></svg>;
    case 'rounded':
      return <svg width={s} height={s} viewBox="0 0 28 28"><rect x="2" y="5" width="24" height="18" rx="8" {...common} /></svg>;
    case 'circle':
      return <svg width={s} height={s} viewBox="0 0 28 28"><ellipse cx="14" cy="14" rx="12" ry="12" {...common} /></svg>;
    case 'triangle':
      return <svg width={s} height={s} viewBox="0 0 28 28"><polygon points="14,3 26,25 2,25" {...common} /></svg>;
    case 'pentagon':
      return <svg width={s} height={s} viewBox="0 0 28 28"><polygon points="14,2 26,11 22,25 6,25 2,11" {...common} /></svg>;
    case 'diamond':
      return <svg width={s} height={s} viewBox="0 0 28 28"><polygon points="14,2 26,14 14,26 2,14" {...common} /></svg>;
    case 'parallelogram':
      return <svg width={s} height={s} viewBox="0 0 28 28"><polygon points="7,5 26,5 21,23 2,23" {...common} /></svg>;
    case 'trapezoid':
      return <svg width={s} height={s} viewBox="0 0 28 28"><polygon points="8,5 20,5 26,23 2,23" {...common} /></svg>;
    case 'hexagon':
      return <svg width={s} height={s} viewBox="0 0 28 28"><polygon points="8,3 20,3 26,14 20,25 8,25 2,14" {...common} /></svg>;
    case 'cylinder':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <path d="M 4,8 Q 4,4 14,4 Q 24,4 24,8 L 24,20 Q 24,24 14,24 Q 4,24 4,20 Z" {...common} />
          <ellipse cx="14" cy="8" rx="10" ry="4" {...common} fillOpacity={0.05} />
        </svg>
      );
    case 'database3d':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <path d="M 4,8 L 4,20 Q 4,24 14,24 Q 24,24 24,20 L 24,8" fill="currentColor" fillOpacity={0.1} stroke="currentColor" strokeWidth="1.5" />
          <ellipse cx="14" cy="8" rx="10" ry="5" {...common} />
          <path d="M 4,14 Q 4,18 14,18 Q 24,18 24,14" fill="none" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.3} />
        </svg>
      );
    case 'cloud':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <path d="M 8,20 Q 2,20 3,15 Q 1,12 5,10 Q 5,5 10,6 Q 13,2 17,5 Q 21,3 23,6 Q 27,6 26,10 Q 28,14 25,16 Q 27,20 21,20 Z" {...common} />
        </svg>
      );
    case 'document':
      return <svg width={s} height={s} viewBox="0 0 28 28"><path d="M 3,4 L 25,4 L 25,21 Q 18,26 14,22 Q 10,18 3,24 Z" {...common} /></svg>;
    case 'group':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="2" y="2" width="24" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
          <rect x="2" y="2" width="24" height="7" rx="3" fill="currentColor" fillOpacity={0.1} />
        </svg>
      );
    case 'sticky':
      return <svg width={s} height={s} viewBox="0 0 28 28"><path d="M 3,3 L 25,3 L 25,21 L 21,25 L 3,25 Z" {...common} /><path d="M 21,25 L 21,21 L 25,21" fill="currentColor" fillOpacity={0.2} stroke="currentColor" strokeWidth="1" /></svg>;
    case 'image':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="3" y="5" width="22" height="18" rx="3" {...common} />
          <circle cx="10" cy="12" r="2.5" fill="currentColor" fillOpacity={0.3} />
          <polyline points="7,20 12,15 17,18 20,16 23,20" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity={0.4} />
        </svg>
      );
    case 'table':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="3" y="3" width="22" height="22" rx="3" {...common} />
          <rect x="3" y="3" width="22" height="7" rx="3" fill="currentColor" fillOpacity={0.15} />
          <line x1="3" y1="10" x2="25" y2="10" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.3} />
          <line x1="3" y1="16" x2="25" y2="16" stroke="currentColor" strokeWidth="0.5" strokeOpacity={0.2} />
        </svg>
      );
    case 'card':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="3" y="4" width="22" height="20" rx="3" {...common} />
          <rect x="3" y="4" width="22" height="3" rx="3" fill="currentColor" fillOpacity={0.4} />
          <line x1="7" y1="13" x2="21" y2="13" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.3} />
          <line x1="7" y1="17" x2="18" y2="17" stroke="currentColor" strokeWidth="0.5" strokeOpacity={0.2} />
        </svg>
      );
    case 'badge':
      return <svg width={s} height={s} viewBox="0 0 28 28"><rect x="2" y="9" width="24" height="10" rx="5" {...common} /></svg>;
    case 'banner':
      return <svg width={s} height={s} viewBox="0 0 28 28"><rect x="1" y="8" width="26" height="12" rx="3" {...common} fillOpacity={0.1} strokeWidth={2} /></svg>;
    case 'queue':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="2" y="6" width="24" height="16" rx="2" {...common} />
          <line x1="10" y1="6" x2="10" y2="22" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.3} />
          <line x1="18" y1="6" x2="18" y2="22" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.3} />
        </svg>
      );
    case 'stack':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="6" y="8" width="20" height="18" rx="2" fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth="1" />
          <rect x="4" y="5" width="20" height="18" rx="2" fill="currentColor" fillOpacity={0.1} stroke="currentColor" strokeWidth="1" />
          <rect x="2" y="2" width="20" height="18" rx="2" {...common} />
        </svg>
      );
    case 'actor':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <circle cx="14" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="14" y1="10" x2="14" y2="19" stroke="currentColor" strokeWidth="1.5" />
          <line x1="6" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="1.5" />
          <line x1="14" y1="19" x2="8" y2="26" stroke="currentColor" strokeWidth="1.5" />
          <line x1="14" y1="19" x2="20" y2="26" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'note':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <path d="M 3,3 L 20,3 L 25,8 L 25,25 L 3,25 Z" {...common} />
          <path d="M 20,3 L 20,8 L 25,8" fill="currentColor" fillOpacity={0.2} stroke="currentColor" strokeWidth="1" />
        </svg>
      );
    case 'separator':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <line x1="2" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="2" strokeOpacity={0.5} />
          <circle cx="14" cy="14" r="2" fill="currentColor" fillOpacity={0.3} />
        </svg>
      );
    case 'server':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="4" y="2" width="20" height="24" rx="2" {...common} />
          <rect x="7" y="5" width="14" height="5" rx="1" fill="currentColor" fillOpacity={0.1} stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.3} />
          <rect x="7" y="13" width="14" height="5" rx="1" fill="currentColor" fillOpacity={0.1} stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.3} />
          <circle cx="10" cy="7.5" r="1.5" fill="currentColor" fillOpacity={0.4} />
          <circle cx="10" cy="15.5" r="1.5" fill="currentColor" fillOpacity={0.4} />
        </svg>
      );
    case 'desktop':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="3" y="3" width="22" height="15" rx="2" {...common} />
          <rect x="10" y="18" width="8" height="3" fill="currentColor" fillOpacity={0.15} />
          <rect x="7" y="21" width="14" height="2" rx="1" fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth="0.8" />
        </svg>
      );
    case 'mobile':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="7" y="2" width="14" height="24" rx="3" {...common} />
          <rect x="9" y="5" width="10" height="16" rx="1" fill="currentColor" fillOpacity={0.05} />
          <rect x="11" y="3" width="6" height="1.5" rx="0.75" fill="currentColor" fillOpacity={0.2} />
        </svg>
      );
    case 'router':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="3" y="10" width="22" height="12" rx="2" {...common} />
          <line x1="9" y1="10" x2="7" y2="4" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="4" r="1.5" fill="currentColor" fillOpacity={0.4} />
          <line x1="19" y1="10" x2="21" y2="4" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="21" cy="4" r="1.5" fill="currentColor" fillOpacity={0.4} />
        </svg>
      );
    case 'firewall':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="3" y="3" width="22" height="22" rx="2" {...common} />
          <line x1="3" y1="10" x2="25" y2="10" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.25} />
          <line x1="3" y1="17" x2="25" y2="17" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.25} />
          <line x1="14" y1="3" x2="14" y2="10" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.2} />
          <line x1="9" y1="10" x2="9" y2="17" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.2} />
          <line x1="19" y1="10" x2="19" y2="17" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.2} />
          <line x1="14" y1="17" x2="14" y2="25" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.2} />
        </svg>
      );
    case 'markdown':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="2" y="3" width="24" height="22" rx="3" {...common} />
          <rect x="2" y="3" width="24" height="6" rx="3" fill="currentColor" fillOpacity={0.15} />
          <text x="6" y="16" fontSize="5" fontWeight="bold" fill="currentColor" fillOpacity={0.5}>Md</text>
          <line x1="6" y1="19" x2="22" y2="19" stroke="currentColor" strokeWidth="0.6" strokeOpacity={0.2} />
          <line x1="6" y1="22" x2="17" y2="22" stroke="currentColor" strokeWidth="0.6" strokeOpacity={0.2} />
        </svg>
      );
    case 'codeblock':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="2" y="3" width="24" height="22" rx="3" fill="#0d1117" fillOpacity={0.3} stroke="currentColor" strokeWidth="1.5" />
          <rect x="2" y="3" width="24" height="6" rx="3" fill="currentColor" fillOpacity={0.1} />
          <text x="6" y="16" fontSize="4.5" fontFamily="monospace" fill="currentColor" fillOpacity={0.5}>{'{ }'}</text>
          <line x1="6" y1="19" x2="20" y2="19" stroke="currentColor" strokeWidth="0.6" strokeOpacity={0.2} />
          <line x1="6" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="0.6" strokeOpacity={0.2} />
        </svg>
      );
    case 'link':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="2" y="8" width="24" height="12" rx="6" {...common} />
          <circle cx="9" cy="14" r="3" fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth="0.8" />
          <line x1="14" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.3} />
        </svg>
      );
    case 'list':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="2" y="3" width="24" height="22" rx="3" {...common} />
          <rect x="5" y="7" width="5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity={0.4} />
          <line x1="13" y1="9.5" x2="23" y2="9.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.3} />
          <rect x="5" y="15" width="5" height="5" rx="1" fill="currentColor" fillOpacity={0.2} stroke="currentColor" strokeWidth="1" strokeOpacity={0.4} />
          <polyline points="6,17.5 7.5,19 9.5,16" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity={0.5} />
          <line x1="13" y1="17.5" x2="23" y2="17.5" stroke="currentColor" strokeWidth="0.8" strokeOpacity={0.3} />
        </svg>
      );
    case 'embed':
      return (
        <svg width={s} height={s} viewBox="0 0 28 28">
          <rect x="2" y="3" width="24" height="22" rx="3" {...common} />
          <circle cx="10" cy="11" r="3" fill="currentColor" fillOpacity={0.2} />
          <polyline points="6,21 12,15 17,18 22,14 24,16" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity={0.3} />
        </svg>
      );
    default:
      return <svg width={s} height={s} viewBox="0 0 28 28"><rect x="2" y="2" width="24" height="24" rx="4" {...common} /></svg>;
  }
}

// ─── ShapePalette Component ────────────────────────────────

export function ShapePalette() {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleDragStart = useCallback((event: React.DragEvent, type: NodeShapeType) => {
    event.dataTransfer.setData('application/diagram-shape', type);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const toggleGroup = useCallback((label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  const query = search.trim().toLowerCase();

  // Filter groups based on search
  const filteredGroups = query
    ? SHAPE_GROUPS.map((g) => ({
        ...g,
        shapes: g.shapes.filter(
          (s) =>
            s.label.toLowerCase().includes(query) ||
            s.type.toLowerCase().includes(query),
        ),
      })).filter((g) => g.shapes.length > 0)
    : SHAPE_GROUPS;

  return (
    <div
      style={{
        width: 180,
        borderRight: '1px solid var(--border, #333)',
        background: 'var(--surface, #1a1a1a)',
        overflowY: 'auto',
        flexShrink: 0,
        padding: '8px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* Search field */}
      <div style={{ padding: '0 8px 6px', position: 'relative' }}>
        <Search
          size={13}
          style={{
            position: 'absolute',
            left: 14,
            top: 7,
            color: 'var(--text-dim, #64748b)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder="Search shapes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            fontSize: 11,
            padding: '5px 8px 5px 26px',
            background: 'var(--background, #111)',
            border: '1px solid var(--border, #333)',
            borderRadius: 6,
            color: 'var(--text, #e2e8f0)',
            fontFamily: 'var(--font-sans, system-ui)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {filteredGroups.length === 0 && (
        <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: 'var(--text-dim, #64748b)', fontFamily: 'var(--font-sans)' }}>
          No shapes found
        </div>
      )}

      {filteredGroups.map((group) => {
        const isCollapsed = !query && collapsed[group.label];

        return (
          <div key={group.label}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group.label)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                width: '100%',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-dim, #64748b)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '5px 12px',
                fontFamily: 'var(--font-sans, system-ui)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{
                display: 'inline-block',
                transition: 'transform 0.15s',
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                fontSize: 8,
              }}>
                ▼
              </span>
              {group.label}
              <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.5 }}>
                {group.shapes.length}
              </span>
            </button>

            {/* Shape grid */}
            {!isCollapsed && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 3,
                  padding: '0 6px 4px',
                }}
              >
                {group.shapes.map(({ type, label }) => (
                  <div
                    key={type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, type)}
                    title={label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      padding: '5px 2px',
                      borderRadius: 6,
                      cursor: 'grab',
                      color: 'var(--text-dim, #94a3b8)',
                      transition: 'background 0.15s, color 0.15s',
                      border: '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--surface-hover, #2a2a2a)';
                      e.currentTarget.style.color = 'var(--text, #e2e8f0)';
                      e.currentTarget.style.borderColor = 'var(--amber, #d4a017)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-dim, #94a3b8)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    <ShapePreview type={type} />
                    <span
                      style={{
                        fontSize: 8,
                        fontFamily: 'var(--font-sans, system-ui)',
                        textAlign: 'center',
                        lineHeight: 1,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
