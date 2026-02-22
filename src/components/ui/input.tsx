import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-8 w-full bg-[var(--card)] px-3 py-1 text-sm text-[var(--text)] transition-colors placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
