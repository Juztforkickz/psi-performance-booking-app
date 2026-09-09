import { useIsFocused, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect } from 'react';
import { Platform } from 'react-native';

type StaffExitGuardOptions = {
  dirty: boolean;
  busy: boolean;
  onConfirmLeave: (action: () => void) => void;
};

export function useStaffExitGuard({ dirty, busy, onConfirmLeave }: StaffExitGuardOptions) {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const preventExit = isFocused && (dirty || busy);

  usePreventRemove(preventExit, ({ data }) => {
    // Reusing the intercepted action lets React Navigation resume it once approved.
    onConfirmLeave(() => navigation.dispatch(data.action));
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !preventExit) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [preventExit]);
}
