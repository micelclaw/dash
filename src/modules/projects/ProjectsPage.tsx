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
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Archive, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useProjectsStore } from '@/stores/projects.store';
import { TagChip } from '@/components/shared/TagChip';
import { NewBoardModal } from './components/NewBoardModal';
import { InboxZone } from './components/InboxZone';
import { CardDetailPanel } from './components/CardDetailPanel';
import type { Board } from './types';

function BoardCard({
  board, onClick, onDropTask,
}: {
  board: Board;
  onClick: () => void;
  onDropTask?: (cardId: string) => void;
}) {
  const [over, setOver] = useState(false);
  const total = board._card_count;
  const hechas = board._done_count;
  const vencidas = board._overdue_count ?? 0;
  const pct = total && total > 0 ? Math.round(((hechas ?? 0) / total) * 100) : null;

  return (
    <button
      onClick={onClick}
      onDragOver={(e) => {
        if (!onDropTask || !e.dataTransfer.types.includes('text/x-claw-task')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const cardId = e.dataTransfer.getData('text/x-claw-task');
        if (cardId && onDropTask) { e.preventDefault(); onDropTask(cardId); }
      }}
      style={{
        background: over ? 'var(--card-hover, var(--card))' : 'var(--card)',
        border: over ? '1px solid var(--amber)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 8px)',
        padding: 16,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        borderTop: `3px solid ${board.color || 'var(--mod-projects)'}`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {board.icon && <span style={{ fontSize: 20 }}>{board.icon}</span>}
        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{board.title}</span>
      </div>
      {board.description && (
        <span style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.4 }}>
          {board.description}
        </span>
      )}
      {board.tags && board.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {board.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} tag={tag} size="xs" />
          ))}
        </div>
      )}
      {/* Estos contadores el backend ya los calculaba PARA LOS AGENTES y el dash
          nunca los pedía: hasta ahora los agentes veían más de tus tableros que tú. */}
      {total !== undefined && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ width: `${pct ?? 0}%`, height: '100%', background: 'var(--amber)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, color: 'var(--text-dim)', fontSize: 11 }}>
            <span>{hechas ?? 0}/{total}</span>
            {vencidas > 0 && <span style={{ color: 'var(--red, #e5484d)' }}>⚠ {vencidas}</span>}
          </div>
        </div>
      )}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div
      className="animate-pulse"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md, 8px)',
        padding: 16,
        height: 100,
      }}
    >
      <div style={{ background: 'var(--surface-hover)', height: 14, width: '60%', borderRadius: 4 }} />
      <div style={{ background: 'var(--surface-hover)', height: 10, width: '80%', borderRadius: 4, marginTop: 12 }} />
    </div>
  );
}

export function Component() {
  const boards = useProjectsStore((s) => s.boards);
  const loading = useProjectsStore((s) => s.loading);
  const fetchBoards = useProjectsStore((s) => s.fetchBoards);
  const navigate = useNavigate();

  const [showNew, setShowNew] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  // Deep-link del widget "Nuevo tablero": /projects?action=new → abre el modal.
  const fetchInbox = useProjectsStore((s) => s.fetchInbox);
  const sendTaskToBoard = useProjectsStore((s) => s.sendTaskToBoard);
  const fetchFullBoard = useProjectsStore((s) => s.fetchFullBoard);

  // La tarea abierta vive en la URL (`?task=`): sin eso, F5 y el botón atrás
  // devuelven a la rejilla y la ficha es un callejón sin salida.
  const taskId = searchParams.get('task');
  const [taskBoardId, setTaskBoardId] = useState<string | null>(null);

  useEffect(() => { void fetchInbox(); }, [fetchInbox]);

  // Para pintar la ficha hace falta el tablero cargado (columnas + campos
  // propios): así se reutiliza EL MISMO CardDetailPanel del tablero, con sus 13
  // secciones, en vez de escribir un segundo panel que acabaría divergiendo.
  useEffect(() => {
    if (!taskId) { setTaskBoardId(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: { board_id: string } }>(`/projects/cards/${taskId}`);
        if (cancelled) return;
        await fetchFullBoard(res.data.board_id);
        if (!cancelled) setTaskBoardId(res.data.board_id);
      } catch {
        if (cancelled) return;
        toast.error('No se encontró la tarea');
        setSearchParams({}, { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [taskId, fetchFullBoard, setSearchParams]);

  async function moverABaldosa(cardId: string, board: Board) {
    const columna = await sendTaskToBoard(cardId, board.id);
    if (columna) {
      toast.success(`Movida a ${board.title} · ${columna}`);
      void fetchBoards();
    }
  }

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowNew(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Deep-link degradado de una chip de `kanban_card` SIN board (chips antiguas, o
  // resultados de búsqueda sin `board_id`): /projects?card=<cardId>. Aquí no se sabe
  // en qué tablero vive, así que se resuelve probando los tableros del usuario con el
  // GET por tarjeta que ya existe, y se redirige a /projects/:boardId?card=… que es
  // donde BoardView abre el CardDetailPanel. Si no aparece en ninguno, se dice.
  useEffect(() => {
    const cardId = searchParams.get('card');
    if (!cardId || loading || boards.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const board of boards) {
        try {
          await api.get(`/projects/boards/${board.id}/cards/${cardId}`);
        } catch {
          continue;
        }
        if (cancelled) return;
        navigate(`/projects/${board.id}?card=${encodeURIComponent(cardId)}`, { replace: true });
        return;
      }
      if (cancelled) return;
      toast.error('No se encontró la tarjeta');
      setSearchParams({}, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [searchParams, setSearchParams, boards, loading, navigate]);

  // Las tareas sueltas viven en el tablero por defecto, que se FILTRA de la
  // rejilla: si saliera como baldosa, las mismas tareas se verían dos veces.
  const tablerosVisibles = boards.filter((b) => !b.is_default);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <InboxZone
        selectedTaskId={taskId}
        onSelectTask={(id) => setSearchParams({ task: id })}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {taskId ? (
        /* Variante A: la ficha SUSTITUYE la rejilla de tableros. La zona
           izquierda sobrevive entera y hace de índice. */
        taskBoardId ? (
          <CardDetailPanel
            boardId={taskBoardId}
            cardId={taskId}
            isMobile={false}
            variant="full"
            leadingAction={
              <button
                onClick={() => setSearchParams({})}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'var(--font-sans)' }}
              >
                <ArrowLeft size={13} />
                Tableros ({tablerosVisibles.length})
              </button>
            }
          />
        ) : (
          <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>Cargando la tarea…</div>
        )
      ) : (
      <div style={{ padding: 24, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
          Tableros
        </h1>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--amber)',
            color: '#06060a',
            border: 'none',
            borderRadius: 'var(--radius-md, 8px)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={14} />
          New Board
        </button>
      </div>

      {showNew && (
        <NewBoardModal
          onClose={() => setShowNew(false)}
          onCreated={(board) => {
            setShowNew(false);
            navigate(`/projects/${board.id}`);
          }}
        />
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : tablerosVisibles.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 60,
            color: 'var(--text-dim)',
            gap: 12,
          }}
        >
          <Archive size={40} strokeWidth={1} />
          <span style={{ fontSize: 14 }}>No boards yet. Create your first board to get started.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {tablerosVisibles.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onClick={() => navigate(`/projects/${board.id}`)}
              onDropTask={(cardId) => void moverABaldosa(cardId, board)}
            />
          ))}
        </div>
      )}
      </div>
      )}
      </div>
    </div>
  );
}
