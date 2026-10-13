import { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useProfileStore } from '@/stores/profile.store';
import { btnSecondary, inputStyle, selectStyle } from '@/modules/inventory/ui';
import {
  addCatalogView,
  removeCatalogView,
  viewsForProfile,
  type CatalogSavedView,
  type CatalogViewSnapshot,
} from './saved-views';

export function SavedViewsControl({ snapshot, onApply }: {
  snapshot: CatalogViewSnapshot;
  onApply: (view: CatalogSavedView) => void;
}) {
  const profileId = useProfileStore(state => state.activeProfileId);
  const [allViews, setAllViews] = useState<CatalogSavedView[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const views = useMemo(() => profileId ? viewsForProfile(allViews, profileId) : [], [allViews, profileId]);

  useEffect(() => {
    let active = true;
    void api.get<{ data: { inventory?: { catalog_views?: CatalogSavedView[] } } }>('/settings')
      .then(result => { if (active) setAllViews(Array.isArray(result.data.inventory?.catalog_views) ? result.data.inventory!.catalog_views! : []); })
      .catch(() => { if (active) toast.error('Could not load saved views'); });
    return () => { active = false; };
  }, [profileId]);

  const persist = async (next: CatalogSavedView[]) => {
    setSaving(true);
    try {
      await api.patch('/settings', { inventory: { catalog_views: next } });
      setAllViews(next);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!profileId) return;
    try {
      const next = addCatalogView(allViews, profileId, name, snapshot);
      await persist(next);
      setName('');
      setSelectedId(next.at(-1)?.id ?? '');
      toast.success('Catalog view saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save view');
    }
  };

  const remove = async () => {
    if (!profileId || !selectedId) return;
    try {
      await persist(removeCatalogView(allViews, profileId, selectedId));
      setSelectedId('');
      toast.success('Catalog view deleted');
    } catch { toast.error('Could not delete view'); }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <select
        aria-label="Saved catalog views"
        style={selectStyle}
        value={selectedId}
        onChange={event => {
          const id = event.target.value;
          setSelectedId(id);
          const selected = views.find(view => view.id === id);
          if (selected) onApply(selected);
        }}
      >
        <option value="">Saved views</option>
        {views.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
      </select>
      <input
        aria-label="New saved view name"
        maxLength={40}
        placeholder="View name"
        style={{ ...inputStyle, width: 112, padding: '5px 7px' }}
        value={name}
        onChange={event => setName(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }}
      />
      <button type="button" aria-label="Save current view" title="Save current filters" style={{ ...btnSecondary, padding: 5 }} disabled={saving || !profileId || !name.trim()} onClick={() => void save()}>
        <BookmarkPlus size={14} />
      </button>
      <button type="button" aria-label="Delete selected view" title="Delete selected view" style={{ ...btnSecondary, padding: 5 }} disabled={saving || !selectedId} onClick={() => void remove()}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}
