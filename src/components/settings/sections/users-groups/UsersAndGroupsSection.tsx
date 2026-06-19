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

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SettingSection } from '../../SettingSection';
import { Tabs } from '@/components/shared/Tabs';
import { UsersListView } from './UsersListView';
import { GroupsListView } from './GroupsListView';

type SubTab = 'users' | 'groups';

/**
 * Panel unificado "Usuarios y grupos" (paridad Synology DSM). Sustituye las
 * antiguas secciones separadas UsersSection + GroupsSection. La pestaña inicial
 * viene por prop (rutas legacy `/settings/users` y `/settings/groups`) o por
 * `?tab=users|groups`.
 */
export function UsersAndGroupsSection({ initialTab }: { initialTab?: SubTab } = {}) {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('tab');
  const [tab, setTab] = useState<SubTab>(
    fromUrl === 'groups' || fromUrl === 'users' ? fromUrl : initialTab ?? 'users',
  );

  // Mantener la URL en sync con la sub-pestaña (deep-link + back/forward).
  useEffect(() => {
    if (params.get('tab') !== tab) {
      const next = new URLSearchParams(params);
      next.set('tab', tab);
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <SettingSection
      title="Usuarios y grupos"
      description="Administra cuentas, grupos, permisos de apps y carpetas, cuotas y límites de velocidad."
    >
      <div className="mb-4">
        <Tabs
          tabs={[{ id: 'users', label: 'Usuario' }, { id: 'groups', label: 'Grupo' }]}
          activeTab={tab}
          onChange={(id) => setTab(id as SubTab)}
        />
      </div>
      {tab === 'users' ? <UsersListView /> : <GroupsListView />}
    </SettingSection>
  );
}
