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

import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// ─── Long-press táctil ≠ menú contextual ────────────────────────────────────
// En táctil el long-press queda reservado para la SELECCIÓN MÚLTIPLE (decisión
// 2026-07-11: ambas cosas en el mismo gesto se pisaban y congelaban el WebView).
// El menú en móvil se abre con el botón ⋮ (TileMoreButton), que despacha un
// contextmenu SINTÉTICO (isTrusted=false) — ese sí pasa. Los contextmenu
// REALES nacidos de un toque (trusted + touchstart reciente) se bloquean aquí,
// globalmente, para los 28 consumidores del componente.
// Además: al SOLTAR un long-press quieto, el navegador sintetiza un `click`
// en ese punto. Si cae sobre el ⋮ (que abre el menú en su onClick) o sobre una
// tarjeta/fila clicable, el long-press acaba "clicando" — en Android nativo un
// long-press jamás produce click al soltar. Se traga aquí, a nivel documento,
// para TODAS las superficies (álbumes, Drive, Explorer… — bug 2026-07-11:
// "segundo long-press abre el menú y congela").
let lastTouchTs = 0;
let touchStart: { ts: number; x: number; y: number } | null = null;
let touchMoved = false;
let swallowClickUntil = 0;
/** El WebView ya consideró este toque un long-press (disparó contextmenu). */
let sawTouchContextmenu = false;
const LONG_PRESS_MS = 450;
if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', (e) => {
    lastTouchTs = Date.now();
    swallowClickUntil = 0; // un gesto nuevo decide su propio click
    sawTouchContextmenu = false;
    if (e.touches.length === 1) {
      const t = e.touches[0]!;
      touchStart = { ts: lastTouchTs, x: t.clientX, y: t.clientY };
      touchMoved = false;
    } else {
      touchStart = null; // multi-touch: no es un long-press
    }
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!touchStart || !t) return;
    if (Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > 10) touchMoved = true;
  }, { capture: true, passive: true });
  // Señal EXACTA de long-press: si el navegador emitió un contextmenu trusted
  // durante el toque, ese gesto ES un long-press según el umbral del propio
  // sistema (MIUI puede usar <450ms) — el click al soltar debe morir siempre.
  document.addEventListener('contextmenu', (e) => {
    if (e.isTrusted && touchStart) sawTouchContextmenu = true;
  }, { capture: true });
  document.addEventListener('touchend', () => {
    // Long-press QUIETO (heurística de duración) O contextmenu ya emitido (señal
    // del sistema): tragar el click sintetizado. Un scroll largo no sintetiza
    // click, y su tap siguiente no debe morir aquí.
    if (touchStart && (sawTouchContextmenu || (!touchMoved && Date.now() - touchStart.ts >= LONG_PRESS_MS))) {
      swallowClickUntil = Date.now() + 600;
    }
    touchStart = null;
    sawTouchContextmenu = false;
  }, { capture: true, passive: true });
  document.addEventListener('touchcancel', () => { touchStart = null; sawTouchContextmenu = false; }, { capture: true, passive: true });
  document.addEventListener('click', (e) => {
    if (e.isTrusted && Date.now() < swallowClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      swallowClickUntil = 0;
    }
  }, { capture: true });
}
function isTouchLongPress(e: React.MouseEvent): boolean {
  return e.nativeEvent.isTrusted && Date.now() - lastTouchTs < 1500;
}

export interface ContextMenuItem {
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  separator?: boolean;
  subItems?: ContextMenuItem[];
}

interface ContextMenuProps {
  trigger: ReactNode;
  items: ContextMenuItem[];
}

export function ContextMenu({ trigger, items }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const rawPos = useRef({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [activeSubIdx, setActiveSubIdx] = useState<number | null>(null);
  // Anti-colisión del SUBMENÚ: por defecto abre a la derecha (left:100%), pero si
  // se saldría del viewport lo abrimos a la izquierda y/o lo subimos. Ningún
  // submenú puede salirse de la pantalla (bug reportado en móvil). Medimos con
  // el rect del ITEM padre + el tamaño del submenú (independiente del flip previo).
  const submenuRef = useRef<HTMLDivElement>(null);
  const [subPos, setSubPos] = useState<{ openLeft: boolean; shiftY: number }>({ openLeft: false, shiftY: 0 });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Stop bubbling so a wrapping ContextMenu (e.g. a background-area menu
    // around a list of rows) doesn't open on top of this one.
    e.stopPropagation();
    // Long-press táctil REAL → no abrir (el gesto es de selección; el ⋮
    // despacha un contextmenu sintético que sí entra).
    if (isTouchLongPress(e)) return;
    rawPos.current = { x: e.clientX, y: e.clientY };
    setPosition({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  // Adjust position if menu overflows viewport edges
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = rawPos.current;
    if (y + rect.height > vh) y = vh - rect.height - 8;
    if (x + rect.width > vw) x = vw - rect.width - 8;
    if (y < 8) y = 8;
    if (x < 8) x = 8;
    setPosition({ x, y });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reposiciona el submenú activo para que no se salga del viewport. Corre antes
  // del paint (useLayoutEffect) → sin parpadeo. Deps: el submenú abierto.
  useLayoutEffect(() => {
    if (activeSubIdx === null || !submenuRef.current) { setSubPos({ openLeft: false, shiftY: 0 }); return; }
    const el = submenuRef.current;
    const parent = el.parentElement;
    if (!parent) return;
    const p = parent.getBoundingClientRect();
    const subW = el.offsetWidth;
    const subH = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Abrir a la izquierda si a la derecha se saldría (left:100% pondría el borde
    // derecho en p.right + subW). shiftY sube el submenú si desborda por abajo.
    const openLeft = p.right + subW > vw - 8;
    const shiftY = Math.max(0, (p.top + subH) - (vh - 8));
    setSubPos({ openLeft, shiftY });
  }, [activeSubIdx]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <>
      {/* `display: contents` no genera caja pero SÍ propaga las props heredadas
          (user-select / touch-callout) al subárbol del trigger. En Android WebView,
          si no se suprimen, el long-press arranca la selección/callout NATIVA que
          secuestra los toques → el menú se ve pero no responde y hay que reiniciar
          la app (bug verificado en Redmi por CDP). Suprimirlas deja pasar el
          gesto contextmenu → menú React → tap, sin secuestro. */}
      <div
        ref={triggerRef}
        onContextMenu={handleContextMenu}
        style={{
          display: 'contents',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        {trigger}
      </div>
      {open && (
        <>
        {/* Invisible backdrop: captures dismiss-clicks so they don't reach elements underneath */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-dropdown)',
          }}
        />
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 'var(--z-dropdown)',
            minWidth: 180,
            background: 'var(--glass-40)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '4px 0',
            animation: 'fadeIn 100ms ease',
          }}
        >
          {items.map((item, i) => {
            if (item.separator) {
              return <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
            }
            const Icon = item.icon;
            const isDanger = item.variant === 'danger';
            const hasSub = item.subItems && item.subItems.length > 0;
            return (
              <div
                key={i}
                style={{ position: 'relative' }}
                onMouseEnter={() => hasSub && setActiveSubIdx(i)}
                onMouseLeave={() => hasSub && setActiveSubIdx(null)}
              >
                <button
                  onClick={() => {
                    if (!item.disabled && !hasSub) {
                      item.onClick();
                      setOpen(false);
                    }
                  }}
                  disabled={item.disabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    height: 32,
                    padding: '0 12px',
                    background: activeSubIdx === i ? 'var(--surface-hover)' : 'transparent',
                    border: 'none',
                    cursor: item.disabled ? 'default' : 'pointer',
                    color: item.disabled ? 'var(--text-muted)' : isDanger ? 'var(--error)' : 'var(--text)',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-sans)',
                    textAlign: 'left',
                    opacity: item.disabled ? 0.5 : 1,
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={(e) => { if (activeSubIdx !== i) e.currentTarget.style.background = 'transparent'; }}
                >
                  {Icon && <Icon size={14} />}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {hasSub && <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>▶</span>}
                  {!hasSub && item.shortcut && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {item.shortcut}
                    </span>
                  )}
                </button>
                {hasSub && activeSubIdx === i && (
                  <div
                    ref={submenuRef}
                    style={{
                      position: 'absolute',
                      left: subPos.openLeft ? 'auto' : '100%',
                      right: subPos.openLeft ? '100%' : 'auto',
                      top: -subPos.shiftY,
                      minWidth: 160,
                      background: 'var(--glass-95)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      padding: '4px 0',
                      zIndex: 1,
                    }}
                  >
                    {item.subItems!.map((sub, j) => {
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={j}
                          onClick={() => {
                            sub.onClick();
                            setOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            height: 32,
                            padding: '0 12px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text)',
                            fontSize: '0.8125rem',
                            fontFamily: 'var(--font-sans)',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {SubIcon && <SubIcon size={14} />}
                          <span style={{ flex: 1 }}>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}
    </>
  );
}
