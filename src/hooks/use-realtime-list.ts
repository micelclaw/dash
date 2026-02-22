import { useEffect } from 'react';
import { useWebSocket } from './use-websocket';

/**
 * Subscribes to WS events for a domain and keeps a list state in sync.
 * Handles created, updated, deleted, and restored events.
 */
export function useRealtimeList<T extends { id: string }>(
  domain: string,
  items: T[],
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
) {
  const wsCreated = useWebSocket(`${domain}.created`);
  const wsUpdated = useWebSocket(`${domain}.updated`);
  const wsDeleted = useWebSocket(`${domain}.deleted`);
  const wsRestored = useWebSocket(`${domain}.restored`);

  useEffect(() => {
    if (!wsCreated) return;
    setItems(prev => {
      if (prev.some(item => item.id === wsCreated.data.id)) return prev;
      return [wsCreated.data as T, ...prev];
    });
  }, [wsCreated, setItems]);

  useEffect(() => {
    if (!wsUpdated) return;
    setItems(prev =>
      prev.map(item =>
        item.id === wsUpdated.data.id ? { ...item, ...wsUpdated.data } as T : item,
      ),
    );
  }, [wsUpdated, setItems]);

  useEffect(() => {
    if (!wsDeleted) return;
    setItems(prev => prev.filter(item => item.id !== wsDeleted.data.id));
  }, [wsDeleted, setItems]);

  useEffect(() => {
    if (!wsRestored) return;
    setItems(prev => {
      if (prev.some(item => item.id === wsRestored.data.id)) return prev;
      return [wsRestored.data as T, ...prev];
    });
  }, [wsRestored, setItems]);

  // Return the items array for chaining (identity — no transform)
  return items;
}
