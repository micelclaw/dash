import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--amber)] text-[#06060a]',
        secondary: 'bg-[var(--surface)] text-[var(--text-dim)]',
        outline: 'border border-[var(--border)] text-[var(--text-dim)]',
        destructive: 'bg-[var(--error)] text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      style={{ borderRadius: 'var(--radius-full)' }}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
