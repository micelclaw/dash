import { useState, useEffect, useRef } from 'react';
import { api } from '@/services/api';

interface Props {
  service: string;
  active: boolean;
  tail?: number;
}

function formatLine(line: string): string {
  // Strip ISO timestamp prefix: "2026-03-10T08:28:44Z ..."
  return line.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?\s*/, '');
}

export function CryptoLogs({ service, active, tail = 5 }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const intervalRef = useRef<number>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      setLines([]);
      return;
    }

    const fetchLogs = async () => {
      try {
        const res = await api.get<{ data: { lines: string[] } }>(`/crypto/${service}/logs?tail=${tail}`);
        setLines((res.data as any).lines ?? []);
      } catch { /* ignore */ }
    };

    fetchLogs();
    intervalRef.current = window.setInterval(fetchLogs, 3_000);
    return () => window.clearInterval(intervalRef.current);
  }, [service, active, tail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  if (!lines.length) return null;

  return (
    <>
      <div className="crypto-logs">
        {lines.map((line, i) => (
          <div key={i} className="crypto-log-line">{formatLine(line)}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      <style>{`
        .crypto-logs { margin-top: 8px; padding: 6px 8px; background: rgba(0,0,0,.25); border-radius: var(--radius-sm); font-family: var(--font-mono, monospace); font-size: 10px; line-height: 1.6; color: var(--text-muted); max-height: 90px; overflow: auto; }
        .crypto-log-line { white-space: pre; }
      `}</style>
    </>
  );
}
