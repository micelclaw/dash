import { useEffect, useCallback } from 'react';
import { useProjectsStore } from '@/stores/projects.store';
import type { ViewMode } from '../types';

const VIEW_KEYS: Record<string, ViewMode> = {
  '1': 'board',
  '2': 'list',
  '3': 'timeline',
  '4': 'calendar',
  '5': 'dashboard',
};

export function useKanbanKeyboard(onToggleShortcuts: () => void) {
  const selectCard = useProjectsStore((s) => s.selectCard);
  const setView = useProjectsStore((s) => s.setView);
  const selectedCardId = useProjectsStore((s) => s.selectedCardId);
  const cardDetailOpen = useProjectsStore((s) => s.cardDetailOpen);
  const deleteCard = useProjectsStore((s) => s.deleteCard);
  const updateCard = useProjectsStore((s) => s.updateCard);
  const activeBoardId = useProjectsStore((s) => s.activeBoardId);
  const toggleMultiSelect = useProjectsStore((s) => s.toggleMultiSelect);
  const clearMultiSelect = useProjectsStore((s) => s.clearMultiSelect);
  const setFilters = useProjectsStore((s) => s.setFilters);
  const filters = useProjectsStore((s) => s.filters);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip when inside inputs/textareas/contenteditable
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      return;
    }

    const boardId = activeBoardId;
    if (!boardId) return;

    // Alt+1-5: view shortcuts
    if (e.altKey && VIEW_KEYS[e.key]) {
      e.preventDefault();
      setView(VIEW_KEYS[e.key]);
      return;
    }

    switch (e.key) {
      // ─── Navigation ─────────────────────────
      case 'Escape':
        if (cardDetailOpen) {
          selectCard(null);
        } else {
          clearMultiSelect();
        }
        break;

      // ─── Card operations ────────────────────
      case 'Delete':
      case 'Backspace':
        if (selectedCardId && cardDetailOpen) {
          if (confirm('Delete this card?')) {
            deleteCard(boardId, selectedCardId);
          }
        }
        break;

      case '1':
      case '2':
      case '3':
      case '4':
        if (selectedCardId && !e.altKey) {
          const priorities: Record<string, string> = { '1': 'urgent', '2': 'high', '3': 'medium', '4': 'low' };
          updateCard(boardId, selectedCardId, { priority: priorities[e.key] });
        }
        break;

      // ─── Multi-select ──────────────────────
      case 'x':
        if (selectedCardId) {
          toggleMultiSelect(selectedCardId);
        }
        break;

      // ─── Search ─────────────────────────────
      case '/':
        e.preventDefault();
        // Focus search (handled by FilterBar/BoardHeader)
        setFilters({ ...filters, search: filters.search ?? '' });
        break;

      // ─── Help ───────────────────────────────
      case '?':
        e.preventDefault();
        onToggleShortcuts();
        break;
    }
  }, [
    activeBoardId, selectedCardId, cardDetailOpen,
    selectCard, setView, deleteCard, updateCard,
    toggleMultiSelect, clearMultiSelect, setFilters, filters,
    onToggleShortcuts,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
