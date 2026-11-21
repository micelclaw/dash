import { useEffect, type Dispatch, type SetStateAction } from 'react';
/** App data enters a draft; it never sends a turn or replaces existing user text. */
export function useMcpAppComposer(conversationId: string | null, setText: Dispatch<SetStateAction<string>>) {
 useEffect(() => {
  const listener = (event: Event) => {
   const detail = (event as CustomEvent<unknown>).detail;
   if (!detail || typeof detail !== 'object') return;
   const value = detail as { conversation_id?: unknown; text?: unknown };
   if (value.conversation_id !== conversationId || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 8000) return;
   const text = value.text; setText(previous => previous ? `${previous}\n\n${text}` : text);
  };
  window.addEventListener('micelclaw:mcp-app-draft', listener);
  return () => { window.removeEventListener('micelclaw:mcp-app-draft', listener); };
 }, [conversationId, setText]);
}
