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

import { EntitySource } from '@/components/shared/SourceBadge';
import { useState, useRef } from 'react';
import {
  Star, StarOff, Paperclip, Archive, Clock, Trash2,
  MailOpen, Mail as MailIcon, Inbox, ShieldAlert, Link2,
  FolderInput, Folder, Tag,
} from 'lucide-react';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { buildMailActions, type MailAction, type MailActionKey } from './lib/mail-actions';
import { TagChip } from '@/components/shared/TagChip';
import { HeatBadge } from '@/components/shared/HeatBadge';
import { RelateModal } from '@/components/shared/RelateModal';
import { formatEmailTime } from '@/lib/date-helpers';
import { userLabels } from './lib/mail-labels';
import type { MoveTarget } from './lib/move-targets';
import type { Email } from './types';
import type { ContextMenuItem } from '@/components/shared/ContextMenu';

/** Enough to fill the preview line at any reasonable column width. */
const PREVIEW_CHARS = 160;

/** Sender + subject + preview, plus padding. Keep MailList's skeleton in sync. */
export const MAIL_ROW_MIN_HEIGHT = 86;

/**
 * El ancho de la franja de la izquierda de la tarjeta.
 *
 * Se exporta para que el ESQUELETO de carga reserve el mismo hueco: si no, al
 * llegar los correos la lista entera se desplaza cinco píxeles.
 */
export const UNREAD_STRIPE_PX = 5;

/**
 * Cuánto color le queda a la franja de un correo YA LEÍDO (el resto es
 * transparencia). 25 % de opacidad = la «transparencia del 75 %» que pidió el
 * usuario.
 */
export const LEIDO_OPACIDAD_PCT = 25;

/**
 * El color de la franja: el de la cuenta SIEMPRE, atenuado si ya está leído.
 *
 * La franja empezó siendo solo la señal de «sin leer», y con varias cuentas a la
 * vez eso dejaba a los leídos sin decir de quién eran (no tenían franja). Ahora la
 * llevan todos —así se ve la cuenta de un vistazo en la bandeja unificada— y lo
 * que distingue al no leído es la INTENSIDAD, no la presencia.
 *
 * Se usa `color-mix` en vez de componer un hexadecimal con canal alfa porque el
 * color puede no ser un hexadecimal: cuando el correo no tiene cuenta, es la
 * variable `var(--mod-mail)`, y a una variable no se le pueden pegar dos dígitos.
 *
 * Función pura y exportada para poder aseverarla sin montar la pantalla.
 */
export function colorDeFranja(colorDeCuenta: string, sinLeer: boolean): string {
  return sinLeer
    ? colorDeCuenta
    : `color-mix(in srgb, ${colorDeCuenta} ${LEIDO_OPACIDAD_PCT}%, transparent)`;
}

interface MailListItemProps {
  email: Email;
  selected: boolean;
  active: boolean;
  onSelect: (shiftKey: boolean) => void;
  onClick: () => void;
  accountColor?: string;
  /**
   * La ÚNICA vía de acción. Antes había doce props (`onArchive`, `onDelete`,
   * `onMarkRead`, `onBatchArchive`…), una por cosa y por número de correos, y de
   * ahí venía que cada superficie ofreciera un juego distinto. Ahora la fila dice
   * QUÉ se ha pedido y sobre QUÉ correos, y quien despacha es uno solo
   * (`runMailAction` de MailPage).
   */
  onAction?: (
    key: MailActionKey,
    ids: string[],
    params?: { folder?: string; label?: string; el?: HTMLElement },
  ) => void;
  /** A dónde se puede mover: las carpetas y etiquetas reales de SU cuenta. */
  moveTargets?: MoveTarget[];
  /** Current active folder — adapts context menu actions */
  activeFolder?: string;
  /** Cuántos hay seleccionados (el menú es el mismo, pero lo dice el contador). */
  selectedCount?: number;
  /** Los ids seleccionados: la acción cae sobre ELLOS cuando esta fila es una. */
  selectedIds?: string[];
  /** ¿Están todos los seleccionados destacados? Decide destacar vs quitar. */
  allSelectedStarred?: boolean;
}

export function MailListItem({
  email,
  selected,
  active,
  onSelect,
  onClick,
  accountColor,
  onAction,
  moveTargets,
  activeFolder,
  selectedCount = 0,
  selectedIds,
  allSelectedStarred,
}: MailListItemProps) {
  const [hovered, setHovered] = useState(false);
  const [relateOpen, setRelateOpen] = useState(false);
  const snoozeRef = useRef<HTMLButtonElement>(null);

  const unread = !email.is_read;
  const leftBorderColor = accountColor ?? 'var(--mod-mail)';

  // The list endpoint returns body_plain in full, so cap it here: a single row
  // never needs more than a line's worth, and thousands of characters per row
  // is wasted DOM.
  const preview = email.body_plain
    ? email.body_plain.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_CHARS)
    : '';

  const visibleLabels = userLabels(email.labels);

  // Si esta fila está seleccionada junto a otras, la acción cae sobre TODAS: es
  // lo que hace que el menú sea el mismo para uno y para varios.
  const isMulti = selected && selectedCount > 1;
  // Las reglas por carpeta (en la Papelera no se borra, se restaura; en Spam se
  // saca de ahí) las decide `buildMailActions`, no este fichero.

  // EL menú: el mismo para UN correo y para una selección, y el mismo que abre
  // el ⋮ de la fila y el ⋮ de la barra de arriba. La lista sale de
  // `lib/mail-actions.ts`, que es el único sitio que decide qué se puede hacer;
  // aquí solo se pinta y se despacha. Antes había cuatro listas distintas y cada
  // una se olvidaba de algo (destacar no existía en selección múltiple, mover a
  // tampoco, aplazar no estaba en el menú…).
  const ICONOS = {
    'mail-open': MailOpen, mail: MailIcon, star: Star, 'star-off': StarOff,
    archive: Archive, inbox: Inbox, clock: Clock, folder: FolderInput,
    'shield-alert': ShieldAlert, link: Link2, trash: Trash2,
  } as const;

  const objetivo = isMulti ? selectedIds ?? [email.id] : [email.id];
  const acciones = buildMailActions({
    count: objetivo.length,
    allRead: !unread,
    allStarred: isMulti ? (allSelectedStarred ?? false) : !!email.is_starred,
    folder: activeFolder ?? 'INBOX',
    moveTargets,
    canRelate: !isMulti,
  });

  const despachar = (a: MailAction, e?: { currentTarget: HTMLElement }) => {
    if (a.key === 'relate') { setRelateOpen(true); return; }
    onAction?.(a.key, objetivo, { el: e?.currentTarget });
  };

  const contextItems: ContextMenuItem[] = [];
  for (const a of acciones) {
    const Icono = ICONOS[a.icon];
    if (a.submenu) {
      const subItems: ContextMenuItem[] = [];
      for (const t of a.submenu) {
        if (t.groupHeader) subItems.push({ label: t.groupHeader, separator: true, onClick: () => {} });
        subItems.push({
          label: t.label,
          icon: t.kind === 'label' ? Tag : t.kind === 'folder' ? Folder : Inbox,
          onClick: () => onAction?.('move', objetivo,
            t.kind === 'label' ? { label: t.folder } : { folder: t.folder }),
        });
      }
      contextItems.push({ label: a.label, icon: Icono, onClick: () => {}, subItems });
      continue;
    }
    // Una raya antes de lo irreversible, para que no quede pegado al resto.
    if (a.danger || a.key === 'restore') contextItems.push({ label: '', separator: true, onClick: () => {} });
    contextItems.push({
      label: a.label, icon: Icono, onClick: () => despachar(a),
      ...(a.danger ? { variant: 'danger' as const } : {}),
    });
  }

  return (
    <>
    <ContextMenu trigger={
    <div
      // Marca invisible con el id del correo: sin ella, un test que quiera
      // comprobar «pulsé la estrella de ESTA fila» tiene que suponer que el orden
      // de la pantalla es el de la API, y no lo es (hay cabeceras de grupo por
      // fecha). Suponerlo daba un falso fallo — y, peor, podía dar un falso PASE.
      data-email-id={email.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 12px',
        minHeight: MAIL_ROW_MIN_HEIGHT,
        boxSizing: 'border-box',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        // 5 px, no 2: a dos píxeles no se distinguía de un borde. Y el color va en
        // TODAS las tarjetas —atenuado en las leídas—, porque con varias cuentas a
        // la vez un correo sin franja no decía de quién era.
        borderLeft: `${UNREAD_STRIPE_PX}px solid ${colorDeFranja(leftBorderColor, unread)}`,
        background: active ? 'var(--surface-hover)' : hovered ? 'var(--surface-hover)' : 'transparent',
        transition: 'background var(--transition-fast)',
      }}
    >
      {/* Line 1: Checkbox + dot + from + time + attachment + star */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        }}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => {}}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(e.shiftKey);
          }}
          style={{
            width: 14,
            height: 14,
            accentColor: 'var(--amber)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />


        {/* Estrella — a la IZQUIERDA, pegada a la casilla.
            Antes vivía en la esquina derecha, dentro del bloque que se desvanece
            al pasar el ratón para dejar sitio a las acciones: o sea que con el
            ratón en la fila la estrella NO estaba tapada, DESAPARECÍA, y era
            imposible pulsarla. Aquí a la izquierda no compite con nada: a este
            lado va lo que es ESTADO (seleccionar, destacar) y a la derecha lo que
            son ACCIONES. */}
        <button
          data-testid="mail-row-star"
          onClick={(e) => {
            e.stopPropagation();
            onAction?.(email.is_starred ? 'unstar' : 'star', [email.id]);
          }}
          title={email.is_starred ? 'Unstar' : 'Star'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 0,
            color: email.is_starred ? 'var(--amber)' : 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          <Star
            size={14}
            fill={email.is_starred ? 'var(--amber)' : 'none'}
            strokeWidth={email.is_starred ? 0 : 1.5}
          />
        </button>

        {/* Account color dot */}
        {accountColor && (
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: accountColor,
              flexShrink: 0,
            }}
          />
        )}

        <EntitySource entity={email} domain="mail" />

        {/* From name */}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            fontWeight: unread ? 600 : 500,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {email.from_name ?? email.from_address}
        </span>

        {/* Derecha: calor + fecha + clip. La FECHA sí cede su hueco a las
            acciones al pasar el ratón (es un dato, no un control), pero ya no se
            lleva la estrella con ella. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            opacity: hovered ? 0 : 1,
            transition: 'opacity var(--transition-fast)',
          }}
        >
          {/* Heat */}
          <HeatBadge score={email.heat_score ?? 0} />

          {/* Time */}
          <span
            style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {formatEmailTime(email.received_at)}
          </span>

          {/* Attachment indicator */}
          {email.has_attachments && (
            <Paperclip size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          )}

        </div>

        {/* Hover actions (overlaying timestamp area) */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'opacity var(--transition-fast)',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction?.(activeFolder === 'ARCHIVE' ? 'unarchive' : 'archive', [email.id]);
            }}
            title="Archive"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            <Archive size={14} />
          </button>
          <button
            ref={snoozeRef}
            onClick={(e) => {
              e.stopPropagation();
              if (snoozeRef.current) onAction?.('snooze', [email.id], { el: snoozeRef.current });
            }}
            title="Snooze"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            <Clock size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction?.(activeFolder === 'TRASH' ? 'restore' : 'delete', [email.id]);
            }}
            title="Delete"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Line 2: Subject — on its own line so nothing competes for its width.
          It used to share a flex row with the preview, and since flexbox shrinks
          proportionally to content width (and body_plain arrives in full from the
          API), a long body ate almost all the overflow: the longer the email, the
          shorter the visible subject. */}
      <div
        style={{
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-sans)',
          fontWeight: unread ? 600 : 500,
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
          paddingLeft: 20,
        }}
      >
        {email.subject ?? '(no subject)'}
      </div>

      {/* Line 3: Body preview */}
      {preview && (
        <div
          style={{
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            paddingLeft: 20,
          }}
        >
          {preview}
        </div>
      )}

      {/* Line 3: Label chips — solo las del usuario. Las de Gmail (UNREAD,
          IMPORTANT, CATEGORY_SOCIAL…) son estado interno, no etiquetas suyas. */}
      {visibleLabels.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            paddingLeft: 20,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {visibleLabels.map((label) => (
            <TagChip key={label} tag={label} size="xs" />
          ))}
        </div>
      )}
    </div>
    } items={contextItems} />
      {relateOpen && (
        <RelateModal
          open={relateOpen}
          sourceType="email"
          sourceId={email.id}
          onClose={() => setRelateOpen(false)}
        />
      )}
    </>
  );
}
