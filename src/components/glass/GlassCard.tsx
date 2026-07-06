import React from 'react';
import { cn } from '@/lib/utils';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'interactive';
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'rounded-[30px] p-4 sm:p-6 bg-gradient-to-br from-white/25 via-white/12 to-white/5 border border-white/30 shadow-[0_32px_90px_-30px_rgba(2,8,23,0.75)] backdrop-blur-[32px]',
      subtle: 'rounded-[24px] p-4 bg-white/5 border border-white/20 backdrop-blur-md',
      interactive: 'rounded-[22px] bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-colors p-3 backdrop-blur-md',
    };

    return (
      <div
        ref={ref}
        className={cn(variants[variant], className)}
        {...props}
      />
    );
  }
);

GlassCard.displayName = 'GlassCard';
