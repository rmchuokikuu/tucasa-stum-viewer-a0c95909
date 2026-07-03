import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStartupSplash } from './useStartupSplash';

describe('useStartupSplash', () => {
  it('shows the startup screen while authentication is still loading', () => {
    const { result } = renderHook(() => useStartupSplash(true, true));

    expect(result.current).toBe(true);
  });

  it('keeps the startup screen visible until the dashboard is marked ready', () => {
    const { result, rerender } = renderHook(
      ({ authLoading, dashboardReady, hasUser }) => useStartupSplash(authLoading, dashboardReady, hasUser),
      { initialProps: { authLoading: false, dashboardReady: false, hasUser: true } }
    );

    expect(result.current).toBe(true);

    rerender({ authLoading: false, dashboardReady: true, hasUser: true });

    expect(result.current).toBe(false);
  });
});
