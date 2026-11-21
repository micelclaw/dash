import { useEffect, useRef, useState } from 'react';
import {ApiError} from '@/services/api';
import { initialAuthStatus, type InitialAuthStatus } from '@/services/initial-setup.service';

/** A network error is unknown status, never proof that the installation is set up. */
export function useInitialStatus(enabled = true) {
  const [status, setStatus] = useState<InitialAuthStatus | null>(null);
  const [phase, setPhase] = useState<'checking' | 'preparing' | 'unavailable' | 'known'>('checking');
  const [attempt, setAttempt] = useState(0);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const delays = [0, 500, 1000, 2000, 4000, 8000];
    setPhase('checking');
    async function check(index: number) {
      if (generation.current !== current) return;
      setAttempt(index + 1);
      try {
        const next = await initialAuthStatus();
        if (generation.current !== current) return;
        setStatus(next); setPhase('known');
      } catch(error) {
        if (generation.current !== current) return;
        setPhase(error instanceof ApiError&&error.code==='INSTALLATION_PREPARING'?'preparing':'unavailable');
        if (index + 1 < delays.length) timer = setTimeout(() => void check(index + 1), delays[index + 1]);
      }
    }
    void check(0);
    return () => { ++generation.current; clearTimeout(timer); };
  }, [enabled, retry]);
  return { status, phase, attempt, retry: () => setRetry(n => n + 1) };
}
