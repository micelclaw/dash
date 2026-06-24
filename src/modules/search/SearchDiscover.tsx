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

// Empty-state del módulo Search: cuando la barra está vacía, en vez del
// placeholder "Type a query…" mostramos dos secciones apiladas —
// "Recientes" (10 registros con updated_at más reciente, cross-dominio) y
// "Más accedidos" (los de más heat). Datos del endpoint /search/discover.
// Cada fila reusa el aspecto de los resultados: icono+color por tipo
// (resolveEntity), título (getTitle) y meta a la derecha (tiempo relativo en
// Recientes / HeatBadge en Más accedidos). Clic → navega al registro.

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, Clock, Flame } from 'lucide-react';
import { useSearchStore } from '@/stores/search.store';
import { resolveEntity } from '@/config/entity-registry';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { timeAgo } from '@/lib/time';
import { getTitle } from './result-helpers';
import type { SearchResult } from '@/types/search';

function DiscoverRow({ r, meta }: { r: SearchResult; meta: React.ReactNode }) {
  const navigate = useNavigate();
  const res = resolveEntity(r.domain, r.record_id, r.record);
  const Icon = res.Icon;

  return (
    <button
      onClick={() => { if (res.route) navigate(res.route); }}
      disabled={!res.route}
      title={getTitle(r)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '7px 10px',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        cursor: res.route ? 'pointer' : 'default',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={(e) => { if (res.route) e.currentTarget.style.background = 'var(--surface)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={16} style={{ color: res.color, flexShrink: 0 }} />
      <span style={{
        flex: 1, minWidth: 0, fontSize: '0.8125rem', color: 'var(--text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {getTitle(r)}
      </span>
      <span style={{
        fontSize: '0.625rem', fontFamily: 'var(--font-sans)',
        color: 'var(--text-muted)', flexShrink: 0,
        textTransform: 'uppercase', letterSpacing: '0.03em',
      }}>
        {res.label}
      </span>
      {meta}
    </button>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Clock; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', marginTop: 4,
      fontSize: '0.6875rem', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      color: 'var(--text-muted)',
    }}>
      <Icon size={12} />
      {title}
    </div>
  );
}

export function SearchDiscover() {
  const discover = useSearchStore((s) => s.discover);
  const loading = useSearchStore((s) => s.discoverLoading);
  const error = useSearchStore((s) => s.discoverError);

  useEffect(() => {
    useSearchStore.getState().fetchDiscover();
  }, []);

  if (loading && !discover) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{
            height: 34, background: 'var(--surface)', borderRadius: 'var(--radius-sm)',
            animation: 'pulse 1.5s ease infinite',
          }} />
        ))}
      </div>
    );
  }

  const recent = discover?.recent ?? [];
  const hot = discover?.hot ?? [];
  const hasData = recent.length > 0 || hot.length > 0;

  // Sin datos (o error): caer al placeholder de siempre para no dejar el panel
  // vacío de información ni de contexto.
  if (!hasData) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '48px 16px',
        color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center',
      }}>
        <Search size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
        {error ? 'No se pudieron cargar tus registros' : 'Escribe para buscar en todos los módulos'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
      {recent.length > 0 && (
        <section>
          <SectionHeader icon={Clock} title="Recientes" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {recent.map((r, i) => {
              const rec = r.record as Record<string, unknown> | null;
              const date = (rec?.updated_at as string) || (rec?.created_at as string) || '';
              return (
                <DiscoverRow
                  key={`recent-${r.domain}-${r.record_id}-${i}`}
                  r={r}
                  meta={date ? (
                    <span style={{
                      fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0,
                      minWidth: 56, textAlign: 'right',
                    }}>
                      {timeAgo(date)}
                    </span>
                  ) : null}
                />
              );
            })}
          </div>
        </section>
      )}

      {hot.length > 0 && (
        <section>
          <SectionHeader icon={Flame} title="Más accedidos" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {hot.map((r, i) => (
              <DiscoverRow
                key={`hot-${r.domain}-${r.record_id}-${i}`}
                r={r}
                meta={<HeatBadge score={r.provenance?.heat_score ?? 0} />}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
