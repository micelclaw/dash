import { useState } from 'react';
import type { ActionItem } from '../types';

interface ActionItemsProps {
  items: ActionItem[];
}

function statusColor(status: ActionItem['status']): string {
  switch (status) {
    case 'complete': return 'var(--success)';
    case 'in_progress': return 'var(--amber)';
    case 'pending': return 'var(--text-dim)';
  }
}

function statusBg(status: ActionItem['status']): string {
  switch (status) {
    case 'complete': return 'rgba(34,197,94,0.1)';
    case 'in_progress': return 'var(--amber-dim)';
    case 'pending': return 'var(--surface)';
  }
}

function statusLabel(status: ActionItem['status']): string {
  switch (status) {
    case 'complete': return 'Complete';
    case 'in_progress': return 'In Progress';
    case 'pending': return 'Pending';
  }
}

function statusIcon(status: ActionItem['status']): string {
  switch (status) {
    case 'complete': return '\u2713';
    case 'in_progress': return '\u25B6';
    case 'pending': return '\u25CB';
  }
}

export function ActionItems({ items }: ActionItemsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    items.length > 0 ? items[0]!.id : null
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const completedCount = items.filter(i => i.status === 'complete').length;
  const allComplete = completedCount === items.length;
  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '20px 24px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: 'var(--text)',
          }}>
            Action Items
          </h3>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: allComplete ? 'var(--success)' : 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
          }}>
            {completedCount}/{items.length}
          </span>
        </div>
        {allComplete && (
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--success)',
            background: 'rgba(34,197,94,0.1)',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
          }}>
            All Tasks Complete
          </span>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr',
        gap: 16,
        minHeight: 120,
      }}>
        {/* Left: numbered list */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflowY: 'auto',
          maxHeight: 320,
        }}>
          {items.map((item, index) => {
            const isSelected = selectedId === item.id;
            const isHovered = hoveredId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  background: isSelected
                    ? 'var(--surface-hover)'
                    : isHovered
                      ? 'var(--surface)'
                      : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'var(--transition-fast)',
                  fontFamily: 'var(--font-sans)',
                  width: '100%',
                }}
              >
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: statusColor(item.status),
                  minWidth: 20,
                  flexShrink: 0,
                }}>
                  {index + 1}.
                </span>
                <span style={{
                  fontSize: '0.8125rem',
                  color: isSelected ? 'var(--text)' : 'var(--text-dim)',
                  fontWeight: isSelected ? 600 : 400,
                  lineHeight: 1.4,
                  textDecoration: item.status === 'complete' ? 'line-through' : 'none',
                }}>
                  {item.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: selected item detail */}
        <div style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-sm)',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {selectedItem ? (
            <>
              <h4 style={{
                margin: 0,
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text)',
                lineHeight: 1.4,
              }}>
                {selectedItem.title}
              </h4>

              {selectedItem.description && (
                <p style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  color: 'var(--text-dim)',
                  lineHeight: 1.5,
                }}>
                  {selectedItem.description}
                </p>
              )}

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                {/* Assigned to */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                  }}>
                    Assigned to:
                  </span>
                  <span style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text)',
                    fontWeight: 500,
                  }}>
                    {selectedItem.assigned_to}
                  </span>
                </div>

                {/* Status badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                  }}>
                    Status:
                  </span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: statusColor(selectedItem.status),
                    background: statusBg(selectedItem.status),
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                  }}>
                    <span>{statusIcon(selectedItem.status)}</span>
                    {statusLabel(selectedItem.status)}
                  </span>
                </div>

                {/* Deliverable URL */}
                {selectedItem.deliverable_url && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <span style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                    }}>
                      Deliverable:
                    </span>
                    <a
                      href={selectedItem.deliverable_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--amber)',
                        textDecoration: 'underline',
                        wordBreak: 'break-all',
                      }}
                    >
                      {selectedItem.deliverable_url}
                    </a>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
            }}>
              Select an action item to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
