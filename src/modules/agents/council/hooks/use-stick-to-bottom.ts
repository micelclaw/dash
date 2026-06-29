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

import { useRef, useState, useEffect, useCallback } from 'react';

interface StickOptions {
  /** Nº de mensajes (dispara el badge "N nuevos" si el usuario está arriba). */
  messageCount: number;
  /** Señal que cambia durante el streaming (p.ej. longitud del último mensaje). */
  contentSignal?: number;
  /** Solo fija al fondo cuando está activo (reunión en vivo). */
  enabled?: boolean;
}

/**
 * Auto-scroll inteligente para un contenedor scrollable. Si el usuario está
 * abajo, lo mantiene pegado al fondo cuando llega contenido nuevo; si ha hecho
 * scroll-up, NO fuerza y cuenta los mensajes nuevos para un botón "volver".
 *
 * NO hace scroll en el montaje inicial (solo reacciona a cambios) — así una
 * reunión completada abierta desde el archivo se ve desde arriba.
 */
export function useStickToBottom({ messageCount, contentSignal = 0, enabled = true }: StickOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);

  const atBottomRef = useRef(true);
  const prevCount = useRef(messageCount);
  const prevContent = useRef(contentSignal);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    atBottomRef.current = true;
    setIsAtBottom(true);
    setNewCount(0);
  }, []);

  // Listener de scroll: reevalúa si está pegado al fondo (umbral 80px).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = dist < 80;
      atBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
      if (atBottom) setNewCount(0);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Pin al fondo cuando crece el contenido (mensaje nuevo o streaming).
  useEffect(() => {
    if (!enabled) { prevContent.current = contentSignal; return; }
    const grew = messageCount !== prevCount.current || contentSignal !== prevContent.current;
    prevContent.current = contentSignal;
    if (grew && atBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom('auto'));
    }
  }, [messageCount, contentSignal, enabled, scrollToBottom]);

  // Badge "N nuevos": solo cuenta mensajes nuevos mientras el usuario lee arriba.
  useEffect(() => {
    if (messageCount === prevCount.current) return;
    const delta = messageCount - prevCount.current;
    prevCount.current = messageCount;
    if (delta > 0 && !atBottomRef.current) setNewCount((c) => c + delta);
  }, [messageCount]);

  return { scrollRef, sentinelRef, isAtBottom, newCount, scrollToBottom };
}
