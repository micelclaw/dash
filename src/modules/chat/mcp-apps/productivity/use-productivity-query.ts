import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Each mounted App owns its data. Old requests cannot repopulate a changed conversation/profile/selection. */
export function useProductivityQuery<T>(key: string, read: (signal: AbortSignal) => Promise<T>) {
 const reader = useRef(read); useLayoutEffect(() => { reader.current = read; });
 const [state, setState] = useState<{ key: string; loading: boolean; data?: T; error?: string }>({ key, loading: true });
 const [revision, setRevision] = useState(0);
 const refresh = useCallback(() => { setState(previous => ({ key, loading: true, data: previous.key === key ? previous.data : undefined })); setRevision(value => value + 1); }, [key]);
 useEffect(() => {
  const controller = new AbortController();
  void reader.current(controller.signal).then(data => {
   if (!controller.signal.aborted) setState({ key, loading: false, data });
  }).catch(error => {
   if (!controller.signal.aborted) setState({ key, loading: false, error: error instanceof RangeError ? 'El período no es válido. Comprueba las fechas.' : error instanceof Error ? error.message : 'No se pudo cargar la información.' });
  });
  return () => controller.abort();
 }, [key, revision]);
 // A dependency change hides old data synchronously, before the effect runs.
 return { ...(state.key === key ? state : { key, loading: true, data: undefined, error: undefined }), refresh };
}
