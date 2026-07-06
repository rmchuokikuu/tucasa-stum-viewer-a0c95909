import React from 'react';
import { cn } from '@/lib/utils';

interface GlassItemButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
}

export const GlassItemButton = React.forwardRef<HTMLButtonElement, GlassItemButtonProps>(
  ({ className, title, subtitle, count, countLabel = 'items', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'text-left group w-full min-w-0 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-colors p-3 flex items-center gap-3 backdrop-blur-md',
          className
        )}
        {...props}
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-white break-words">{title}</h3>
          {subtitle && <p className="text-xs text-white/70 break-words">{subtitle}</p>}
        </div>
        {count !== undefined && (
          <div className="text-right shrink-0">
            <div className="text-lg font-semibold leading-none text-white">{count}</div>
            <div className="text-[10px] text-white/70 mt-1">{countLabel}</div>
          </div>
        )}
      </button>
    );
  }
);

GlassItemButton.displayName = 'GlassItemButton';
