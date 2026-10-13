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

// ─── Ventana 2 · DÓNDE está ese dato ────────────────────────────────────────
//
// La regla dura de esta pantalla, decidida por el usuario:
//
//   **Solo aparecen los proveedores que tienen disponible lo que se eligió en la
//   ventana 1. Ninguna ventana 2 es igual a otra.**
//
// No es cosmética. Su razón: *"no cualquier tipo de NAS tiene para conectar
// cualquier tipo de cosa"*. El filtro lo hace el SERVIDOR (`?domain=…`) contra el
// catálogo, no una lista aquí — así no hay dos verdades. Medido: Correo devuelve
// 14 proveedores y Calendario 11, porque Proton, Yahoo y Migadu son solo correo.
//
// Y una consecuencia que se ve a simple vista y es CORRECTA: **Nextcloud no sale
// en Correo.** No aloja buzones; su aplicación de correo es un cliente del
// servidor de otro. La fila del catálogo lo declaraba mal y se corrigió — el
// síntoma habría sido un usuario tecleando la URL de su Nextcloud y no
// encontrando ningún IMAP detrás.
//
// "Otro servidor" es **una baldosa más, no un caso especial** (petición
// explícita), y solo existe donde hay un estándar de verdad: en Notas no
// aparece, porque no hay protocolo común de notas.

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Plus } from 'lucide-react';
import { DataProviderIcon } from '@/config/data-provider-icons';
import type { DataTypeMeta } from '@/config/data-types';
import * as syncSvc from '@/services/sync.service';

/** Cuántos se ven antes de "ver todos". Los primeros son los más usados. */
const COLAPSADOS = 6;

/**
 * Orden de aparición: los que el usuario nombró como "los más usuales" primero,
 * y "Otro servidor" siempre al final de los visibles. El resto por el orden del
 * catálogo (que es el orden de los ciclos del arco).
 */
const PRIMEROS = ['google', 'icloud', 'synology', 'nextcloud', 'yahoo', 'microsoft'];

export interface ProviderChoice {
  provider: syncSvc.DataProvider;
  /** `true` cuando el usuario eligió la baldosa "Otro servidor". */
  ownServer: boolean;
}

interface WhereStepProps {
  dataType: DataTypeMeta;
  onPick: (c: ProviderChoice) => void;
}

export function WhereStep({ dataType, onPick }: WhereStepProps) {
  const [providers, setProviders] = useState<syncSvc.DataProvider[] | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataType.providerDomain) {
      setProviders([]);
      return;
    }
    let vivo = true;
    syncSvc
      .listDataProviders(dataType.providerDomain)
      .then((p) => { if (vivo) setProviders(p); })
      .catch((e: unknown) => {
        if (!vivo) return;
        // Un catálogo que no carga se DICE. Antes un catch silencioso dejaba la
        // rejilla vacía y parecía que no hay proveedores.
        setError(e instanceof Error ? e.message : 'No se pudo cargar la lista de proveedores');
        setProviders([]);
      });
    return () => { vivo = false; };
  }, [dataType.providerDomain]);

  const { generic, marcas } = useMemo(() => {
    const list = providers ?? [];
    // El proveedor `generic` ES la baldosa "Otro servidor": el motor puro.
    const g = list.find((p) => p.slug === 'generic') ?? null;
    const resto = list.filter((p) => p.slug !== 'generic');
    resto.sort((a, b) => {
      const ia = PRIMEROS.indexOf(a.slug);
      const ib = PRIMEROS.indexOf(b.slug);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return 0;
    });
    return { generic: g, marcas: resto };
  }, [providers]);

  if (providers === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '36px 0', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
        <Loader2 size={14} className="animate-spin" /> Cargando proveedores…
      </div>
    );
  }

  // Un tipo de dato sin proveedores todavía dice QUÉ va a haber, en llano. No se
  // apaga el botón ni se deja la rejilla en blanco: eso convierte una feature que
  // llega en una que parece rota.
  if (dataType.pending) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
          {dataType.label} todavía no se puede conectar
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
          {dataType.pending}
        </div>
        {dataType.ownServerProtocol && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Irá por {dataType.ownServerProtocol}.
          </div>
        )}
      </div>
    );
  }

  // Tareas es un catálogo deliberadamente amplio: el usuario pidió ver los
  // proveedores de un vistazo antes de empezar a probar. Con 11 marcas, ocultar
  // cinco detrás de «Ver restantes» hacía que la ampliación pareciera no existir.
  const visibles = verTodos || dataType.id === 'tasks' ? marcas : marcas.slice(0, COLAPSADOS);
  const ocultos = marcas.length - visibles.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {dataType.id === 'notes' && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          Trae tus notas con su contenido y archivos. Tú eliges qué páginas o secciones importar.
          <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            La edición disponible se indica en cada nota según la conexión.
          </div>
        </div>
      )}
      {error && (
        <div style={{ fontSize: '0.75rem', color: 'var(--danger, #f87171)' }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: dataType.id === 'notes' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 8 }}>
        {visibles.map((p) => (
          <ProviderTile key={p.slug} provider={p} onPick={() => onPick({ provider: p, ownServer: false })} />
        ))}

        {/* "Otro servidor": una baldosa más, con la misma forma que las demás. */}
        {generic && dataType.ownServerProtocol && (
          <button
            onClick={() => onPick({ provider: generic, ownServer: true })}
            title={`Tu dominio o la IP de tu servidor · ${dataType.ownServerProtocol}`}
            style={tileStyle}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
          >
            <DataProviderIcon slug="generic" size={26} />
            <span style={{ fontSize: '0.75rem', fontWeight: 500, textAlign: 'center', lineHeight: 1.25 }}>
              Otro servidor
            </span>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
              dominio o IP
            </span>
          </button>
        )}
      </div>

      {dataType.id === 'notes' && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, paddingTop: 4 }}>
          Próximamente: Markdown / Obsidian y otros proveedores.
        </div>
      )}

      {ocultos > 0 && (
        <button
          onClick={() => setVerTodos(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'center',
          }}
        >
          <ChevronRight size={14} /> Ver los {ocultos} restantes
        </button>
      )}
      {verTodos && marcas.length > COLAPSADOS && (
        <button
          onClick={() => setVerTodos(false)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--text-dim)', fontSize: '0.8125rem', fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'center',
          }}
        >
          <ChevronDown size={14} /> Ocultar
        </button>
      )}
    </div>
  );
}

const tileStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '14px 6px 10px',
  minHeight: 92,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  transition: 'all var(--transition-fast)',
};

const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'var(--surface-hover)';
  e.currentTarget.style.borderColor = 'var(--amber)';
};
const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'var(--surface)';
  e.currentTarget.style.borderColor = 'var(--border)';
};

function ProviderTile({ provider, onPick }: { provider: syncSvc.DataProvider; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      title={
        provider.verified
          ? `Probado contra un servidor real el ${provider.verified}`
          : 'Todavía no se ha probado contra un servidor real de este proveedor'
      }
      style={tileStyle}
      onMouseEnter={hoverIn}
      onMouseLeave={hoverOut}
    >
      <DataProviderIcon slug={provider.slug} size={26} />
      <span style={{ fontSize: '0.75rem', fontWeight: 500, textAlign: 'center', lineHeight: 1.25 }}>
        {provider.label}
      </span>
      {!provider.task_capabilities && !provider.verified && (
        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', minHeight: 12 }}>
          sin probar
        </span>
      )}
    </button>
  );
}

/** El botón de la rejilla para el caso de que no haya catálogo (sin uso hoy). */
export function EmptyGridHint() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
      <Plus size={12} /> Sin proveedores para este tipo de dato.
    </div>
  );
}
