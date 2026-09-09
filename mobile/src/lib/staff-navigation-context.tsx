import { usePathname, useRouter } from 'expo-router';
import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useRef } from 'react';

import type { StaffSection } from '@/lib/staff-navigation';

type StaffNavigationHandler = (section: StaffSection) => void;

type StaffNavigationContextValue = {
  navigateToSection: StaffNavigationHandler;
  registerNavigationHandler: (handler: StaffNavigationHandler) => () => void;
};

const StaffNavigationContext = createContext<StaffNavigationContextValue | null>(null);

export function StaffNavigationProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const handlerRef = useRef<StaffNavigationHandler | null>(null);

  const registerNavigationHandler = useCallback((handler: StaffNavigationHandler) => {
    handlerRef.current = handler;
    return () => {
      if (handlerRef.current === handler) handlerRef.current = null;
    };
  }, []);

  const navigateToSection = useCallback((section: StaffSection) => {
    if (pathname === '/staff') {
      if (handlerRef.current) handlerRef.current(section);
      else router.setParams({ section });
      return;
    }
    router.replace({ pathname: '/staff', params: { section } });
  }, [pathname, router]);

  const value = useMemo(() => ({ navigateToSection, registerNavigationHandler }), [navigateToSection, registerNavigationHandler]);

  return <StaffNavigationContext.Provider value={value}>{children}</StaffNavigationContext.Provider>;
}

export function useStaffNavigation() {
  const context = useContext(StaffNavigationContext);
  if (!context) throw new Error('Staff navigation requires StaffNavigationProvider');
  return context;
}
