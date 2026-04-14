import { useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Returns a monotonically increasing number that bumps each time
 * the device transitions from offline → online.
 * Use as a prop to image components to force re-mount / retry on reconnect.
 */
export function useConnectionKey(): number {
  const [connectionKey, setConnectionKey] = useState(0);
  const wasConnected = useRef(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      if (!wasConnected.current && isConnected) {
        setConnectionKey((k) => k + 1);
      }
      wasConnected.current = isConnected;
    });
    return () => unsubscribe();
  }, []);

  return connectionKey;
}
