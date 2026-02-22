import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[var(--amber)] text-[#06060a] shadow-[var(--shadow-sm)] hover:bg-[var(--amber-hover)]',
        destructive: 'bg-[var(--error)] text-white shadow-sm hover:bg-[var(--error)]/90',
        outline: 'border border-[var(--border)] bg-transparent shadow-sm hover:bg-[var(--surface-hover)] hover:text-[var(--text)]',
        secondary: 'bg-[var(--surface)] text-[var(--text)] shadow-sm hover:bg-[var(--surface-hover)]',
        ghost: 'hover:bg-[var(--surface-hover)] hover:text-[var(--text)]',
        link: 'text-[var(--amber)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3 py-1',
        sm: 'h-7 rounded-[var(--radius-sm)] px-2 text-xs',
        lg: 'h-9 rounded-[var(--radius-md)] px-4',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={{ borderRadius: 'var(--radius-md)' }}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
