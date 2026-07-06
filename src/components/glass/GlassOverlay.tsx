import React from 'react';
import { cn } from '@/lib/utils';

interface GlassOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  onClick?: () => void;
}

export const GlassOverlay = React.forwardRef<HTMLDivElement, GlassOverlayProps>(
  ({ onClick, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn('fixed inset-0 z-40', className)}
        style={{
          background:
            'radial-gradient(1200px 700px at 10% -10%, rgba(96,165,250,0.5), transparent 60%),' +
            'radial-gradient(900px 600px at 100% 0%, rgba(186,230,253,0.35), transparent 60%),' +
            'radial-gradient(900px 700px at 50% 120%, rgba(59,130,246,0.45), transparent 60%),' +
            'linear-gradient(180deg, #173A82 0%, #1E4AA0 50%, #173A82 100%)',
        }}
        {...props}
      />
    );
  }
);

GlassOverlay.displayName = 'GlassOverlay';
