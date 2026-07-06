import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface GlassButtonProps extends Omit<ButtonProps, 'variant'> {
  variant?: 'default' | 'secondary' | 'subtle';
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white',
      secondary: 'bg-white/5 border-white/20 text-white/90 hover:bg-white/10 hover:text-white',
      subtle: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border-0',
    };

    return (
      <Button
        ref={ref}
        variant="outline"
        className={cn(variants[variant], className)}
        {...props}
      />
    );
  }
);

GlassButton.displayName = 'GlassButton';
