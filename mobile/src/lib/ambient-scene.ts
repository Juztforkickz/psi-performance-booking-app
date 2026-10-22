export type AmbientScene = 'garage' | 'reports' | 'forms';

const ANDROID_THEME_AWARE_ROUTES = ['/', '/events', '/customer-cars-for-sale', '/trusted-partners', '/messages'];

/** Keep the existing dark palette legible on Android's legacy colour screens. */
export function ambientUsesBrightTheme(activeTheme: 'bright' | 'dark', pathname: string, platform: string): boolean {
  return activeTheme === 'bright' && (platform !== 'android' || ANDROID_THEME_AWARE_ROUTES.includes(pathname));
}

/** Decorative route selection only. It never reads customer or booking data. */
export function ambientSceneForPath(pathname: string): AmbientScene {
  if (pathname === '/vehicle-reports' || pathname === '/vehicle-vault' || pathname === '/history-import') return 'reports';
  if (
    pathname === '/booking' || pathname === '/bookings' || pathname === '/parts'
    || pathname === '/account' || pathname.startsWith('/account/')
    || pathname === '/performance-plus' || pathname === '/subscription-terms'
    || pathname === '/support' || pathname === '/messages' || pathname === '/delete-account'
  ) return 'forms';
  return 'garage';
}
