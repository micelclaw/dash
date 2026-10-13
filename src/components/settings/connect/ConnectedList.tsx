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

// ─── Lo conectado, agrupado por proveedor ───────────────────────────────────
//
// Tres decisiones del usuario que se ven aquí y que van juntas:
//
//  1. **Una tarjeta por (proveedor × tipo de dato).** Gmail para correo y Gmail
//     para calendario son DOS, no una. Su motivo: *"cada tipo de tarjeta tendrá
//     luego unas opciones; cuando se le dé a editar tendrá unas opciones tipo
//     calendario o tipo notas, por eso quiero que estén separadas"*. Un calendario
//     no se configura como una carpeta de correo.
//
//  2. **Agrupadas bajo una cabecera del proveedor**, para que tres tarjetas de
//     Google no se conviertan en una sopa entre las demás.
//
//  3. **La cabecera se pinta SIEMPRE, aunque el grupo tenga una sola tarjeta.**
//     Decisión revisada: el logo del proveedor sigue siendo información útil
//     con una sola tarjeta (de qué es, de un vistazo), así que ya no se
//     esconde por debajo de dos.
//
// El proveedor de cada tarjeta sale primero del CONNECTOR INDIVIDUAL
// (`provider_slug`, lo que persistió el alta en `config.provider` para un
// proveedor ambiguo por protocolo — CalDAV/CardDAV/IMAP genérico) y, si no lo
// declara, del CATÁLOGO (`connector_types`, determinista para gmail/microsoft-*/
// google-*). Nunca de adivinarlo por el nombre del tipo — que es lo que hacía
// la pantalla vieja y fallaba justo donde importaba: `gmail` no contiene
// "google".

import { useEffect, useMemo, useState } from 'react';
import { DataProviderIcon } from '@/config/data-provider-icons';
import * as syncSvc from '@/services/sync.service';
import { ConnectorCard } from '../ConnectorCard';

interface ConnectedListProps {
  connectors: syncSvc.ConnectorInfo[];
  onRefresh: () => void;
  onConfigure: (id: string) => void;
}

/** Proveedor de un tipo de conector cuando el catálogo no lo declara. */
const SIN_PROVEEDOR = { slug: 'generic', label: 'Tu servidor' };

export function ConnectedList({ connectors, onRefresh, onConfigure }: ConnectedListProps) {
  const [types, setTypes] = useState<syncSvc.ConnectorTypeMeta[]>([]);
  const [providers, setProviders] = useState<syncSvc.DataProvider[]>([]);

  useEffect(() => {
    let vivo = true;
    syncSvc
      .listDataCatalog()
      .then((c) => {
        if (!vivo) return;
        setTypes(c.connectorTypes);
        setProviders(c.providers);
      })
      .catch(() => { /* sin catálogo se agrupa por tipo; no es un error que mostrar */ });
    return () => { vivo = false; };
  }, []);

  const grupos = useMemo(() => {
    const porTipo = new Map(types.map((t) => [t.type, t]));
    const porSlug = new Map(providers.map((p) => [p.slug, p]));

    const mapa = new Map<string, { slug: string; label: string; items: syncSvc.ConnectorInfo[] }>();
    for (const c of connectors) {
      const t = porTipo.get(c.connector_type);
      const slug = c.provider_slug ?? t?.provider_slug ?? SIN_PROVEEDOR.slug;
      const label = porSlug.get(slug)?.label ?? (slug === SIN_PROVEEDOR.slug ? SIN_PROVEEDOR.label : slug);
      const g = mapa.get(slug) ?? { slug, label, items: [] };
      g.items.push(c);
      mapa.set(slug, g);
    }

    // Los grupos con más integraciones primero; dentro, por tipo de dato para que
    // el orden no baile entre recargas.
    return [...mapa.values()]
      .map((g) => ({
        ...g,
        items: [...g.items].sort((a, b) => a.connector_type.localeCompare(b.connector_type)),
      }))
      .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  }, [connectors, types, providers]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {grupos.map((g) => (
        <div key={g.slug} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* La cabecera se pinta SIEMPRE (decisión revisada): el logo del
              proveedor es información útil de un vistazo aunque el grupo
              tenga una sola tarjeta. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 2 }}>
            <DataProviderIcon slug={g.slug} size={15} />
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {g.label}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {g.items.map((c) => (
              <ConnectorCard key={c.id} connector={c} onRefresh={onRefresh} onConfigure={onConfigure} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
