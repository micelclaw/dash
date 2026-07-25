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

import { StickyNote, Calendar, Users, Mail, BookOpen, Kanban, SquareCheckBig, Boxes, FolderOpen, Bookmark, Rss, Newspaper, Image, Images, FileText, Sheet, Presentation, FileType, Music, Clapperboard, Library, MessageSquare, MessageCircle, Database, Wallet, ArrowLeftRight, PieChart, Receipt, MapPin, Inbox, type LucideIcon } from 'lucide-react';
import { lucideLookup } from './lucide-lookup';
import type { AppEntityType } from '@/services/app-access.service';

// Single source of truth de los tipos de entidad referenciables desde el chat
// (chips cliqueables que navegan al registro). El backend marca cada tool_call
// con `entity_refs: [{ type, id, title }]` y aquí mapeamos `type` → icono/color/
// ruta. Piloto: solo notas. Al ampliar a otros dominios, añadir una fila
// reusando el icono/color de config/modules.ts y el patrón de ruta `?id=`.
//
// Además del set base (de aquí abajo, dominios del core), las apps L3 pueden
// aportar sus propios tipos vía `ui.entities` del manifest — ver
// `registerAppEntityTypes()` al final del fichero, invocada por
// `stores/entity-types.store.ts` al boot.

export interface EntityRefDef {
  Icon: LucideIcon;
  /** Color del icono/borde — variable CSS del módulo (ej. var(--mod-notes)). */
  color: string;
  label: string;
  /** Deep-link al registro concreto (NotesPage lo lee con useSearchParams). */
  route: (id: string) => string;
}

export const ENTITY_REF_MAP: Record<string, EntityRefDef> = {
  note: {
    Icon: StickyNote,
    color: 'var(--mod-notes)',
    label: 'Nota',
    route: (id) => `/notes?id=${encodeURIComponent(id)}`,
  },
  event: {
    Icon: Calendar,
    color: 'var(--mod-calendar)',
    label: 'Evento',
    route: (id) => `/calendar?id=${encodeURIComponent(id)}`,
  },
  calendar: {
    Icon: Calendar,
    color: 'var(--mod-calendar)',
    label: 'Calendario',
    route: (id) => `/calendar?calendar=${encodeURIComponent(id)}`,
  },
  contact: {
    Icon: Users,
    color: 'var(--mod-contacts)',
    label: 'Contacto',
    route: (id) => `/contacts?id=${encodeURIComponent(id)}`,
  },
  email: {
    Icon: Mail,
    color: 'var(--mod-mail)',
    label: 'Email',
    route: (id) => `/mail?id=${encodeURIComponent(id)}`,
  },
  diary: {
    Icon: BookOpen,
    color: 'var(--mod-diary)',
    label: 'Diario',
    route: (id) => `/diary?id=${encodeURIComponent(id)}`,
  },
  file: {
    Icon: FolderOpen,
    color: 'var(--mod-drive)',
    label: 'Archivo',
    // Refs del ÍNDICE (uuid) → módulo Drive por ?id=. Refs del VFS (path, empieza
    // por "/", de files_search/browse) → File Explorer por ?path= (es el navegador
    // por-path; el módulo Drive es por-id).
    route: (id) => id.startsWith('/')
      ? `/explorer?path=${encodeURIComponent(id)}`
      : `/drive?id=${encodeURIComponent(id)}`,
  },
  // Tablero kanban: el id de la chip ES el boardId → ruta directa a BoardView
  // (/projects/:boardId), no al listado.
  kanban_board: {
    Icon: Kanban,
    color: 'var(--mod-projects)',
    label: 'Tablero',
    route: (id) => `/projects/${encodeURIComponent(id)}`,
  },
  // Tarjeta kanban: abrir el CardDetailPanel requiere el boardId (BoardView lee
  // `?card=`). La chip codifica el id como "<boardId>/<cardId>" (lo provee el
  // search, ver mention-suggestion.tsx). Fallback degradado si llega sin board.
  kanban_card: {
    Icon: SquareCheckBig,
    color: 'var(--mod-projects)',
    label: 'Tarjeta',
    route: (id) => {
      const slash = id.indexOf('/');
      if (slash > 0) {
        const boardId = id.slice(0, slash);
        const cardId = id.slice(slash + 1);
        return `/projects/${encodeURIComponent(boardId)}?card=${encodeURIComponent(cardId)}`;
      }
      return `/projects?card=${encodeURIComponent(id)}`;
    },
  },
  inventory: {
    Icon: Boxes,
    color: 'var(--mod-inventory)',
    label: 'Inventario',
    route: (id) => `/inventory?id=${encodeURIComponent(id)}`,
  },
  // inventory — sub-tipos del dominio (el default `inventory` de arriba es el ITEM).
  // Ubicación (árbol de bins/estantes): InventoryPage lee ?location_id= → fuerza la tab
  // Locations con ese id.
  inventory_location: {
    Icon: MapPin,
    color: 'var(--mod-inventory)',
    label: 'Ubicación',
    route: (id) => `/inventory?location_id=${encodeURIComponent(id)}`,
  },
  // Movimiento del ledger de stock: no hay deep-link por id en v1 (patrón firefly_*) →
  // abre la tab Stock (kardex), ignorando el id.
  inventory_move: {
    Icon: ArrowLeftRight,
    color: 'var(--mod-inventory)',
    label: 'Movimiento',
    route: () => `/inventory?tab=stock`,
  },
  // Propuesta de la cola de intake: se revisa/aprueba en el Panel → abre esa tab (v1
  // ignora el id).
  inventory_proposal: {
    Icon: Inbox,
    color: 'var(--mod-inventory)',
    label: 'Propuesta',
    route: () => `/inventory?tab=panel`,
  },
  bookmark: {
    Icon: Bookmark,
    color: 'var(--mod-bookmarks)',
    label: 'Bookmark',
    route: (id) => `/bookmarks?id=${encodeURIComponent(id)}`,
  },
  // feeds: dos tipos. La suscripción (feed) abre su lista; el artículo abre el
  // lector. FeedsPage lee `?feed=`/`?article=` en el effect de montaje.
  feed: {
    Icon: Rss,
    color: 'var(--mod-feeds)',
    label: 'Feed',
    route: (id) => `/feeds?feed=${encodeURIComponent(id)}`,
  },
  article: {
    Icon: Newspaper,
    color: 'var(--mod-feeds)',
    label: 'Artículo',
    route: (id) => `/feeds?article=${encodeURIComponent(id)}`,
  },
  // photos: dos tipos. El álbum abre su detalle (?album=); la foto abre el lightbox
  // (?id=, deep-link que PhotosPage ya soporta).
  album: {
    Icon: Images,
    color: 'var(--mod-photos)',
    label: 'Álbum',
    route: (id) => `/photos?album=${encodeURIComponent(id)}`,
  },
  photo: {
    Icon: Image,
    color: 'var(--mod-photos)',
    label: 'Foto',
    route: (id) => `/photos?id=${encodeURIComponent(id)}`,
  },
  // Biblioteca multimedia (módulos propios sobre Navidrome/Jellyfin/ABS). El
  // resolver afina la ruta por `media_type` del record (track/album, movie/
  // series, ebook/audiobook); estas rutas son el fallback genérico.
  music: {
    Icon: Music,
    color: 'var(--mod-music)',
    label: 'Música',
    route: (id) => `/music?album=${encodeURIComponent(id)}`,
  },
  video: {
    Icon: Clapperboard,
    color: 'var(--mod-video)',
    label: 'Vídeo',
    route: (id) => `/video?item=${encodeURIComponent(id)}`,
  },
  book: {
    Icon: Library,
    color: 'var(--mod-books)',
    label: 'Libro',
    route: (id) => `/books?book=${encodeURIComponent(id)}`,
  },
  // Conversación del chat / mensaje de canal — navegan a su módulo (sin
  // deep-link fino hoy; mejor que dejarlos sin ruta).
  conversation: {
    Icon: MessageSquare,
    color: 'var(--mod-chat)',
    label: 'Chat',
    route: () => `/chat`,
  },
  message: {
    Icon: MessageCircle,
    color: 'var(--mod-chat)',
    label: 'Mensaje',
    route: () => `/messages`,
  },
  // office: chips tipadas por formato del documento generado/referenciado. Word/Excel/
  // PowerPoint abren en el editor ONLYOFFICE (/office/edit/:id, que detecta el tipo por
  // mime); PDF abre en el visor (/office/pdf/:id). Colores de marca por formato.
  office_doc: {
    Icon: FileText,
    color: '#2563eb',
    label: 'Documento',
    route: (id) => `/office/edit/${encodeURIComponent(id)}`,
  },
  office_sheet: {
    Icon: Sheet,
    color: '#16a34a',
    label: 'Hoja',
    route: (id) => `/office/edit/${encodeURIComponent(id)}`,
  },
  office_slides: {
    Icon: Presentation,
    color: '#ea580c',
    label: 'Presentación',
    route: (id) => `/office/edit/${encodeURIComponent(id)}`,
  },
  office_pdf: {
    Icon: FileType,
    color: '#dc2626',
    label: 'PDF',
    route: (id) => `/office/pdf/${encodeURIComponent(id)}`,
  },
  // databases: el contenido vive en Mathesar (no en el índice de Core) → no hay
  // refs por-registro; la chip navega al módulo (tab Databases de Office),
  // ignorando el id. Color de marca igual que la tab (purple #a855f7).
  databases: {
    Icon: Database,
    color: '#a855f7',
    label: 'Base de datos',
    route: () => `/office/databases`,
  },
  // flows/flow_run retirados 2026-06-30 (MicelFlow eliminado; la automatización es n8n).
  // Finance — Firefly III. Las chips navegan al embed del módulo (deep-link a un
  // registro concreto = futuro; el iframe es cross-origin). El id se ignora.
  firefly_transaction: {
    Icon: ArrowLeftRight,
    color: 'var(--mod-finance)',
    label: 'Transacción',
    route: () => `/finance/firefly`,
  },
  firefly_account: {
    Icon: Wallet,
    color: 'var(--mod-finance)',
    label: 'Cuenta',
    route: () => `/finance/firefly`,
  },
  firefly_budget: {
    Icon: PieChart,
    color: 'var(--mod-finance)',
    label: 'Presupuesto',
    route: () => `/finance/firefly`,
  },
  firefly_bill: {
    Icon: Receipt,
    color: 'var(--mod-finance)',
    label: 'Factura',
    route: () => `/finance/firefly`,
  },
  // Finance — Personal NATIVO. Chips → la lente Personal (/finance?tab=personal).
  finance_account: {
    Icon: Wallet,
    color: 'var(--mod-finance)',
    label: 'Cuenta',
    route: () => `/finance?tab=personal`,
  },
  finance_transaction: {
    Icon: ArrowLeftRight,
    color: 'var(--mod-finance)',
    label: 'Movimiento',
    // La lente Personal lee ?tx= y abre el MovimientoDetalle de ese id.
    route: (id) => `/finance?tab=personal&tx=${encodeURIComponent(id)}`,
  },
  finance_budget: {
    Icon: PieChart,
    color: 'var(--mod-finance)',
    label: 'Presupuesto',
    route: () => `/finance?tab=personal`,
  },
  // Finance — Facturación NATIVO (F2b). Chips → la lente Facturación
  // (/finance?tab=facturacion). El id deep-linkea al doc concreto:
  // FacturacionLens lee ?doc= para abrir la factura. Los clientes/proveedores
  // son CONTACTOS (dominio `contact`), no un dominio de facturación propio.
  finance_invoice: {
    Icon: Receipt,
    color: 'var(--mod-finance)',
    label: 'Factura',
    route: (id) => `/finance?tab=facturacion&doc=${encodeURIComponent(id)}`,
  },
  // Slugs CANÓNICOS (= entity_links / lo que devuelven búsqueda, grafo y picker).
  // finance_invoice/finance_transaction quedan como aliases visuales equivalentes.
  finance_document: {
    Icon: Receipt,
    color: 'var(--mod-finance)',
    label: 'Factura',
    route: (id) => `/finance?tab=facturacion&doc=${encodeURIComponent(id)}`,
  },
  finance_journal_entry: {
    Icon: ArrowLeftRight,
    color: 'var(--mod-finance)',
    label: 'Asiento',
    // La lente Contabilidad lee ?entry= y abre el AsientoDetalle de ese id.
    route: (id) => `/finance?tab=contabilidad&entry=${encodeURIComponent(id)}`,
  },
  // Finance — SolidInvoice. Chips → embed de SolidInvoice.
  solidinvoice_client: {
    Icon: Users,
    color: 'var(--mod-finance)',
    label: 'Cliente',
    route: () => `/finance/solidinvoice`,
  },
  solidinvoice_invoice: {
    Icon: Receipt,
    color: 'var(--mod-finance)',
    label: 'Factura',
    route: () => `/finance/solidinvoice`,
  },
  solidinvoice_quote: {
    Icon: FileText,
    color: 'var(--mod-finance)',
    label: 'Presupuesto',
    route: () => `/finance/solidinvoice`,
  },
};

/** Dominios buscables para el dropdown de menciones `@` del editor de notas. */
export const MENTION_DOMAINS: string[] = ['note', 'event', 'contact', 'email', 'diary', 'inventory', 'inventory_location', 'inventory_move', 'inventory_proposal', 'kanban_board', 'kanban_card', 'finance_document', 'finance_journal_entry'];

// ─── Extensión dinámica por apps L3 (`ui.entities` del manifest) ────────────
// Invocada una vez al boot (`stores/entity-types.store.ts`) tras fetchear
// `/me/entity-types`. Solo AÑADE tipos nuevos — nunca pisa un dominio del core
// (defensa: si una app declara un `type` ya existente, se ignora esa entrada y
// se avisa por consola). Tipos con `mention !== false` se suman también a
// MENTION_DOMAINS para que el editor `@` los ofrezca.
// Qué app registró cada tipo aportado por una app. Hace idempotente la función
// de abajo: re-registrar el MISMO tipo desde la MISMA app (boot doble por React
// StrictMode en dev, remount del Shell, o un re-fetch tras instalar una app) es un
// no-op silencioso. Solo se avisa en un conflicto REAL: un tipo del core o de OTRA
// app. (Antes el `if (ENTITY_REF_MAP[type])` avisaba también de las re-invocaciones
// benignas → "workflow ya existe — ignorado" en cada navegación.)
const appEntityOwner = new Map<string, string>();

export function registerAppEntityTypes(entries: AppEntityType[]): void {
  for (const entry of entries) {
    if (ENTITY_REF_MAP[entry.type]) {
      // Re-registro idempotente de la misma app → silencio.
      if (appEntityOwner.get(entry.type) === entry.app_name) continue;
      // Conflicto real (tipo del core, o de otra app) → avisar y respetar al dueño.
      console.warn(`[entity-refs] "${entry.type}" (app ${entry.app_name}) ya existe — ignorado`);
      continue;
    }
    appEntityOwner.set(entry.type, entry.app_name);
    ENTITY_REF_MAP[entry.type] = {
      Icon: lucideLookup(entry.icon),
      color: entry.color,
      label: entry.label,
      route: (id: string) => entry.route.replace('{id}', encodeURIComponent(id)),
    };
    if (entry.mention !== false && !MENTION_DOMAINS.includes(entry.type)) {
      MENTION_DOMAINS.push(entry.type);
    }
  }
}
