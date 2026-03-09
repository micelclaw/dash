import { Loader2 } from 'lucide-react';

interface ServiceLoadingStateProps {
  displayName: string;
  estimatedSeconds?: number;
}

export function ServiceLoadingState({ displayName, estimatedSeconds }: ServiceLoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-[var(--text-dim)]">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--amber)]" />
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--text)]">
          Starting {displayName}...
        </p>
        {estimatedSeconds && (
          <p className="mt-1 text-xs">
            Usually takes {estimatedSeconds}s
          </p>
        )}
      </div>
    </div>
  );
}
