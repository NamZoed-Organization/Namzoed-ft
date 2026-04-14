import React, { createContext, useContext } from 'react';
import { useConnectionKey } from '@/hooks/useNetworkReconnect';

const NetworkContext = createContext(0);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const connectionKey = useConnectionKey();
  return (
    <NetworkContext.Provider value={connectionKey}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkConnectionKey(): number {
  return useContext(NetworkContext);
}
