import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-[var(--radius-md)]', className)}
      style={{ background: 'var(--surface-hover)' }}
      {...props}
    />
  );
}

export { Skeleton };
