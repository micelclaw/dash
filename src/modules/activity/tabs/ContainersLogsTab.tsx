/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * Containers logs tab — fetch snapshot per service (or merged across
 * all). No live WS yet: Core doesn't broadcast container log frames
 * — they're written to disk by the collector and read back via
 * REST. A 5s polling refresh keeps the tab fresh without a Wire-
 * format change.
 *
 * Deep-link: `/activity?tab=containers&svc=<name>` preselects the
 * service via the filter facet.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ActivityHeader } from '../ActivityHeader';
import { ActivityTable } from '../ActivityTable';
import { useActivityRows } from '../useActivityRows';
import {
  buildContainerLogsAdapter,
  MERGED_SENTINEL,
  type ContainerLogRow,
} from '../adapters/container-logs.adapter';
import { getActiveTails } from '@/services/activity.service';
import type { ActivityStats } from '@/services/activity.service';

const POLL_MS = 5_000;

interface Props {
  stats: ActivityStats | null;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  paused: boolean;
  onTogglePause: () => void;
}

export function ContainersLogsTab(props: Props) {
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<string[]>([]);

  // Load the list of services currently being tailed (so the dropdown
  // matches reality, not the static service-registry).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await getActiveTails();
        if (!cancelled) {
          setServices(res.tails.map((t) => t.service).sort());
        }
      } catch {
        // collector idle (no Docker) — leave dropdown empty
      }
    }
    void load();
  }, []);

  // Honour ?svc= on first paint.
  useEffect(() => {
    const svc = searchParams.get('svc');
    if (svc && !props.filters.service) {
      props.onFilterChange('service', svc);
    }
    // We only want this once at mount — adding deps would cause a
    // loop with the controlled filter state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adapter = useMemo(() => buildContainerLogsAdapter(services), [services]);

  // Default to merged when the user hasn't picked a service yet.
  const effectiveFilters = useMemo(() => ({
    ...props.filters,
    service: props.filters.service ?? MERGED_SENTINEL,
  }), [props.filters]);

  const { filteredRows, loading, refresh } = useActivityRows<ContainerLogRow>({
    adapter,
    filters: effectiveFilters,
    search: props.search,
    paused: props.paused,
  });

  // Poll while not paused — container log files don't have a WS
  // broadcast yet.
  useEffect(() => {
    if (props.paused) return;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [props.paused, refresh]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ActivityHeader
        adapter={adapter}
        stats={props.stats}
        filters={effectiveFilters}
        onFilterChange={props.onFilterChange}
        search={props.search}
        onSearchChange={props.onSearchChange}
        paused={props.paused}
        onTogglePause={props.onTogglePause}
      />
      <ActivityTable<ContainerLogRow>
        adapter={adapter}
        rows={filteredRows}
        loading={loading}
        emptyMessage={services.length === 0
          ? 'No hay containers en seguimiento. Activa Docker o levanta un servicio.'
          : 'Sin entradas para los filtros actuales.'}
      />
    </div>
  );
}
