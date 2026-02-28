import { User, Briefcase, MapPin, Hash, Building2, Calendar } from 'lucide-react';
import { entityTypeColor } from './graph-utils';
import type { LucideIcon } from 'lucide-react';

interface GraphCategoryFiltersProps {
  enabled: Record<string, boolean>;
  onToggle: (type: string) => void;
}

const CATEGORIES: { type: string; label: string; icon: LucideIcon }[] = [
  { type: 'person', label: 'People', icon: User },
  { type: 'project', label: 'Projects', icon: Briefcase },
  { type: 'location', label: 'Locations', icon: MapPin },
  { type: 'topic', label: 'Topics', icon: Hash },
  { type: 'organization', label: 'Orgs', icon: Building2 },
  { type: 'event', label: 'Events', icon: Calendar },
];

export function GraphCategoryFilters({ enabled, onToggle }: GraphCategoryFiltersProps) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {CATEGORIES.map(({ type, label, icon: Icon }) => {
        const isOn = enabled[type] !== false; // default true
        const color = entityTypeColor(type);
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            title={`${isOn ? 'Hide' : 'Show'} ${label}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${isOn ? color : 'var(--border)'}`,
              background: isOn ? `${color}15` : 'transparent',
              color: isOn ? color : 'var(--text-muted)',
              fontSize: '0.6875rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              opacity: isOn ? 1 : 0.5,
              transition: 'all var(--transition-fast)',
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
