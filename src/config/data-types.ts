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

// ─── Los tipos de dato que se pueden conectar ────────────────────────────────
//
// La primera ventana de "Conectar" pregunta QUÉ, no CÓMO. Esta tabla es la
// respuesta, y la regla que la gobierna sale de una conversación con el usuario:
//
//   **Cada tipo de dato es un módulo que YA EXISTE y que va a recibir los
//   datos.** No hay tipos huérfanos ni módulos que no puedan recibir nada.
//
// De ahí que no haya un "Marcadores" ni un "Contraseñas": no existe forma
// estándar de traerlos. Y de ahí que el botón "+ Conectar" pueda vivir al pie de
// la barra lateral de cada módulo — el módulo sabe cuál es su tipo.
//
// Lo que NO está aquí a propósito: la MENSAJERÍA (Telegram, Signal, WhatsApp…).
// Vive en su propia sección de Ajustes por decisión del usuario, y podría ser un
// décimo botón en el futuro.

import {
  Calendar,
  CheckSquare,
  Contact,
  FileText,
  Files,
  Image,
  Mail,
  Music,
  Rss,
  type LucideIcon,
} from 'lucide-react';

/** El identificador que viaja en la URL y en las llamadas al catálogo. */
export type DataTypeId =
  | 'mail'
  | 'contacts'
  | 'calendar'
  | 'tasks'
  | 'notes'
  | 'files'
  | 'photos'
  | 'music'
  | 'feeds';

export interface DataTypeMeta {
  id: DataTypeId;
  /** Cómo se llama para una persona. En la ventana 1 esto es TODO lo que se lee. */
  label: string;
  icon: LucideIcon;
  /** Módulo que RECIBE estos datos. Es a donde se vuelve al terminar. */
  moduleRoute: string;
  /**
   * El dominio con el que el catálogo del servidor filtra sus proveedores
   * (`GET /sync/providers?domain=…`). `null` = ese tipo todavía no tiene
   * catálogo en el servidor, y la ventana 2 lo dice en llano en vez de salir
   * vacía sin explicación.
   */
  providerDomain: 'mail' | 'calendar' | 'contacts' | 'tasks' | 'notes' | null;
  /**
   * ¿Existe un protocolo común para este tipo? Gobierna si la ventana 2 ofrece
   * la baldosa "Otro servidor". Decisión del usuario: esa baldosa es una más, no
   * un caso especial, **y solo existe donde hay estándar**.
   */
  ownServerProtocol: string | null;
  /**
   * Una frase honesta para cuando el tipo aún no tiene proveedores conectables.
   * `null` = ya funciona. No se apaga el botón: se dice qué pasa.
   */
  pending: string | null;
}

export const DATA_TYPES: DataTypeMeta[] = [
  {
    id: 'mail',
    label: 'Correo',
    icon: Mail,
    moduleRoute: '/mail',
    providerDomain: 'mail',
    ownServerProtocol: 'IMAP + SMTP',
    pending: null,
  },
  {
    id: 'contacts',
    label: 'Contactos',
    icon: Contact,
    moduleRoute: '/contacts',
    providerDomain: 'contacts',
    ownServerProtocol: 'CardDAV',
    pending: null,
  },
  {
    id: 'calendar',
    label: 'Calendario',
    icon: Calendar,
    moduleRoute: '/calendar',
    providerDomain: 'calendar',
    ownServerProtocol: 'CalDAV',
    pending: null,
  },
  {
    id: 'tasks',
    label: 'Tareas',
    icon: CheckSquare,
    moduleRoute: '/projects',
    providerDomain: 'tasks',
    // Las tareas viajan por el MISMO protocolo que el calendario (`VTODO` de
    // iCalendar), así que este tipo sale casi gratis sobre el motor que ya hay.
    ownServerProtocol: 'CalDAV (VTODO)',
    pending: null,
  },
  {
    id: 'notes',
    label: 'Notas',
    icon: FileText,
    moduleRoute: '/notes',
    providerDomain: 'notes',
    // Medido: NO existe protocolo común de notas. Lo más parecido es una carpeta
    // de ficheros `.md`, que es literalmente cómo funcionan Obsidian, Joplin y
    // Logseq. Por eso aquí no hay "Otro servidor": no hay estándar que ofrecer.
    ownServerProtocol: null,
    pending: null,
  },
  {
    id: 'files',
    label: 'Archivos',
    icon: Files,
    // Decisión del usuario: los ficheros conectados aparecen en el EXPLORADOR,
    // como una fuente más de su árbol. No en Drive.
    moduleRoute: '/explorer',
    providerDomain: null,
    ownServerProtocol: 'WebDAV · SMB · NFS · SFTP · S3',
    pending: 'Se conectarán Google Drive, Dropbox, OneDrive, Nextcloud, Synology Drive y cualquier servidor por WebDAV, SMB, NFS o SFTP. Aparecerán en el explorador como una carpeta más.',
  },
  {
    id: 'photos',
    label: 'Fotos',
    icon: Image,
    moduleRoute: '/photos',
    providerDomain: null,
    ownServerProtocol: null,
    pending: 'Immich y Synology Photos se podrán sincronizar. Google Fotos requiere revisar el uso permitido por su política antes de ofrecer importación seleccionada.',
  },
  {
    id: 'music',
    label: 'Música',
    icon: Music,
    moduleRoute: '/music',
    providerDomain: null,
    ownServerProtocol: 'OpenSubsonic',
    pending: 'Se importarán tus listas y lo que tengas guardado, desde un servidor OpenSubsonic (Navidrome) o desde Spotify.',
  },
  {
    id: 'feeds',
    label: 'Feeds',
    icon: Rss,
    moduleRoute: '/feeds',
    providerDomain: null,
    // La respuesta principal para feeds es un FICHERO, no una API: el OPML lo
    // exporta todo el mundo, Feedly incluido.
    ownServerProtocol: 'importar OPML',
    pending: 'Tu lista de feeds se importará desde un fichero OPML, que exportan todos los lectores. Los self-hosted (FreshRSS, Miniflux, Nextcloud News) además se podrán sincronizar.',
  },
];

const BY_ID = new Map(DATA_TYPES.map((d) => [d.id, d]));

export function dataType(id: string): DataTypeMeta | undefined {
  return BY_ID.get(id as DataTypeId);
}

/** Los tipos que ya tienen catálogo de proveedores en el servidor. */
export function readyDataTypes(): DataTypeMeta[] {
  return DATA_TYPES.filter((d) => d.pending === null);
}
