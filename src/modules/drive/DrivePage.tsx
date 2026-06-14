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

import { useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import {
  HardDrive, Clock, Star, Users, Trash2, Copy, Settings,
} from 'lucide-react';
import { Tabs } from '@/components/shared/Tabs';
import { useDriveStore, isDriveTab, type DriveTab } from '@/stores/drive.store';
import { QuotaChip } from './components/QuotaChip';
import { MyDriveView } from './views/MyDriveView';
import { RecentView } from './views/RecentView';
import { StarredView } from './views/StarredView';
import { SharedView } from './views/SharedView';
import { TrashView } from './views/TrashView';
import { DuplicatesView } from './views/DuplicatesView';

/**
 * Drive module shell (D3) — tab row (My Drive / Recent / Starred / Shared /
 * Trash / Duplicates) + quota chip + a settings gear, with the active view
 * below.
 *
 * Tab state lives in `useDriveStore` (persisted); `?tab=` in the URL wins on
 * mount and stays in sync afterwards. Legacy deep-links `?id=` / `?path=`
 * (entity chips, search) keep working: they force the My Drive tab, which
 * consumes them. The old `?tab=devices` deep-link now redirects to settings.
 */
export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = useDriveStore(s => s.activeTab);
  const setActiveTab = useDriveStore(s => s.setActiveTab);

  // URL → store. Runs on mount AND on later param changes (e.g. a view
  // navigating to /drive?tab=my-drive&id=…).
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    // Legacy deep-links a la antigua tab/sección de settings del Drive
    // (devices = la Devices tab retirada; settings = la vista interna ya movida)
    // → ahora las settings del Drive viven en Settings → System → Drive.
    if (tabParam === 'devices' || tabParam === 'settings') {
      navigate('/settings/drive', { replace: true });
      return;
    }
    if (isDriveTab(tabParam)) {
      if (tabParam !== activeTab) setActiveTab(tabParam);
      return;
    }
    // Legacy deep-links without ?tab= open My Drive (which consumes id/path).
    if ((searchParams.has('id') || searchParams.has('path')) && activeTab !== 'my-drive') {
      setActiveTab('my-drive');
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (id: string) => {
    setActiveTab(id as DriveTab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    }, { replace: true });
  };

  const tabs = useMemo(() => [
    { id: 'my-drive', label: 'My Drive', icon: HardDrive },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'shared', label: 'Shared', icon: Users },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'duplicates', label: 'Duplicates', icon: Copy },
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Tab row + quota chip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          padding: '8px 16px 0',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflowX: 'auto',
            // Scoped override: the shared Tabs underline picks up the Drive
            // module identity color without forking the component.
            ['--amber' as string]: 'var(--mod-drive)',
          } as React.CSSProperties}
        >
          <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} variant="underline" />
        </div>
        <QuotaChip />
        <button
          onClick={() => navigate('/settings/drive')}
          title="Drive settings"
          aria-label="Drive settings"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, marginBottom: 6, flexShrink: 0,
            background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-dim)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--mod-drive)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Active view */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'my-drive' && <MyDriveView />}
        {activeTab === 'recent' && <RecentView />}
        {activeTab === 'starred' && <StarredView />}
        {activeTab === 'shared' && <SharedView />}
        {activeTab === 'trash' && <TrashView />}
        {activeTab === 'duplicates' && <DuplicatesView />}
      </div>
    </div>
  );
}
