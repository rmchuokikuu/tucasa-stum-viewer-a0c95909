export function useStartupSplash(authLoading: boolean, dashboardReady: boolean, hasUser: boolean = false) {
  return authLoading || (hasUser && !dashboardReady);
}
