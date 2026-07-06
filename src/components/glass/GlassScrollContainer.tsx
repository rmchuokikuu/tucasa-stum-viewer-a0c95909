import React from 'react';
import { cn } from '@/lib/utils';

interface GlassScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxHeight?: string;
}

export const GlassScrollContainer = React.forwardRef<HTMLDivElement, GlassScrollContainerProps>(
  ({ className, maxHeight = 'max-h-[calc(100vh-10rem)]', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'overflow-y-auto overflow-x-hidden rounded-[24px] border border-white/20 bg-white/5 p-2 sm:p-3',
          maxHeight,
          className
        )}
        {...props}
      />
    );
  }
);

GlassScrollContainer.displayName = 'GlassScrollContainer';
