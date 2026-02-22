import { useEffect } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface KeyBinding {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  handler: KeyHandler;
}

export function useKeyboard(bindings: KeyBinding[]): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      for (const binding of bindings) {
        const metaMatch = binding.meta ? (e.metaKey || e.ctrlKey) : true;
        const ctrlMatch = binding.ctrl ? e.ctrlKey : true;
        const shiftMatch = binding.shift ? e.shiftKey : !e.shiftKey;

        if (e.key.toLowerCase() === binding.key.toLowerCase() && metaMatch && ctrlMatch && shiftMatch) {
          e.preventDefault();
          binding.handler(e);
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bindings]);
}
