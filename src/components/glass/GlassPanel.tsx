import React from 'react';
import { cn } from '@/lib/utils';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  showClose?: boolean;
  onClose?: () => void;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, title, subtitle, showClose, onClose, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-[30px] p-4 sm:p-6 bg-gradient-to-br from-white/25 via-white/12 to-white/5 border border-white/30 shadow-[0_32px_90px_-30px_rgba(2,8,23,0.75)] backdrop-blur-[32px] overflow-hidden',
          className
        )}
        {...props}
      >
        {(title || subtitle || showClose) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              {subtitle && (
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                  {subtitle}
                </p>
              )}
              {title && (
                <h2 className="mt-2 text-base sm:text-xl font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] break-words">
                  {title}
                </h2>
              )}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="shrink-0 text-white/70 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = 'GlassPanel';
