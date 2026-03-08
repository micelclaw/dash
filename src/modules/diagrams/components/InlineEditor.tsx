import { useRef, useEffect, useCallback, useState } from 'react';
import { useDiagramsStore } from '@/stores/diagrams.store';

export function InlineEditor() {
  const editingNodeId = useDiagramsStore((s) => s.editingNodeId);
  const setEditingNode = useDiagramsStore((s) => s.setEditingNode);
  const updateNodeData = useDiagramsStore((s) => s.updateNodeData);
  const nodes = useDiagramsStore((s) => s.nodes);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef('');

  const node = editingNodeId ? nodes.find((n) => n.id === editingNodeId) : null;
  const isMultiline = node?.type === 'sticky';

  const [value, setValue] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Keep ref in sync for stable callbacks
  valueRef.current = value;

  // Get node DOM element bounds
  useEffect(() => {
    if (!editingNodeId) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-id="${editingNodeId}"]`);
    if (el) {
      setRect(el.getBoundingClientRect());
    }
  }, [editingNodeId]);

  // Set initial value when editing starts
  useEffect(() => {
    if (node && editingNodeId) {
      const data = node.data as Record<string, unknown>;
      setValue((data.label as string) || '');
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 10);
    }
  }, [editingNodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = useCallback(() => {
    if (editingNodeId) {
      updateNodeData(editingNodeId, { label: valueRef.current });
    }
    setEditingNode(null);
  }, [editingNodeId, updateNodeData, setEditingNode]);

  const cancel = useCallback(() => {
    setEditingNode(null);
  }, [setEditingNode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (isMultiline && e.shiftKey) {
          return; // Allow Shift+Enter for new lines in sticky
        }
        e.preventDefault();
        confirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    },
    [confirm, cancel, isMultiline],
  );

  // Click outside → confirm
  useEffect(() => {
    if (!editingNodeId) return;
    const handler = (e: MouseEvent) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target as globalThis.Node)) {
        confirm();
      }
    };
    // Delay to avoid catching the double-click that opened editing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [editingNodeId, confirm]);

  if (!node || !editingNodeId || !rect) return null;

  const data = node.data as Record<string, unknown>;
  const fontSize = (data.fontSize as number) || 12;
  const textColor = (data.textColor as string) || '#e2e8f0';

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        fontSize,
        fontWeight: 600,
        color: textColor,
        fontFamily: 'var(--font-sans, system-ui)',
        textAlign: 'center',
        background: 'var(--surface, #1a1a1a)',
        border: '2px solid var(--amber, #d4a017)',
        borderRadius: 4,
        outline: 'none',
        resize: 'none',
        zIndex: 50,
        padding: 8,
        lineHeight: 1.3,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    />
  );
}
