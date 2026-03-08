import { useState, useEffect } from 'react';
import { LayoutGrid, ChevronRight } from 'lucide-react';
import { api } from '@/services/api';
import { PRIORITY_COLORS } from '../utils/design-tokens';

interface LinkedCard {
  id: string;
  title: string;
  card_number: number | null;
  priority: string | null;
  column_title?: string;
  board_title?: string;
  relationship: string;
}

/**
 * Reusable component for showing linked kanban cards in other modules
 * (notes, events, contacts, etc.)
 */
export function LinkedCardsSection({ entityType, entityId }: {
  entityType: string;
  entityId: string;
}) {
  const [cards, setCards] = useState<LinkedCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ data: LinkedCard[] }>(`/entity-links/${entityType}/${entityId}/kanban-cards`);
        setCards(res.data);
      } catch {
        // Endpoint might not exist yet, that's ok
        setCards([]);
      }
      setLoading(false);
    })();
  }, [entityType, entityId]);

  if (loading || cards.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
        color: 'var(--text-dim)',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        <LayoutGrid size={12} />
        Linked Cards ({cards.length})
      </div>
      {cards.map((card) => (
        <div
          key={card.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 4,
            marginBottom: 4,
            background: 'var(--surface)',
            fontSize: 12,
          }}
        >
          {card.priority && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: PRIORITY_COLORS[card.priority] ?? PRIORITY_COLORS.none,
              flexShrink: 0,
            }} />
          )}
          <span style={{ color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card.card_number != null && <span style={{ color: 'var(--text-muted)', marginRight: 3 }}>#{card.card_number}</span>}
            {card.title}
          </span>
          {card.column_title && (
            <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>
              {card.column_title}
            </span>
          )}
          <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}
