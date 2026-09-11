/**
 * AppearanceContext
 *
 * What the user has chosen about how chats look: one default background for
 * every conversation, and per-conversation overrides. Persisted to
 * AsyncStorage and restored on startup.
 *
 * It also held `bubbleSkin` — four badge-tier gradient skins for message
 * bubbles — which is gone. Nothing rendered it: the chat screen read the
 * value and never used it, so the setting saved a choice that changed
 * nothing on screen. The picker in Settings › Appearance went with it. The
 * stored `@namzoed_bubble_skin` key is simply left where it is; a migration
 * to delete a key nobody reads would be more code than ignoring it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

const KEY_GLOBAL_BG = '@namzoed_global_chat_bg';
const KEY_LOCAL_BGS = '@namzoed_local_chat_bgs';

interface AppearanceContextValue {
  globalChatBg: string;
  setGlobalChatBg: (bgId: string) => Promise<void>;
  
  localChatBgs: Record<string, string>;
  setLocalChatBg: (chatPartnerId: string, bgId: string | null) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  globalChatBg: 'default',
  setGlobalChatBg: async () => {},
  
  localChatBgs: {},
  setLocalChatBg: async () => {},
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [globalChatBg, setGlobalChatBgState] = useState<string>('default');
  const [localChatBgs, setLocalChatBgsState] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  // Restore persisted preferences
  useEffect(() => {
    (async () => {
      try {
        const [gBg, lBgs] = await Promise.all([
          AsyncStorage.getItem(KEY_GLOBAL_BG),
          AsyncStorage.getItem(KEY_LOCAL_BGS),
        ]);
        if (gBg) setGlobalChatBgState(gBg);
        if (lBgs) setLocalChatBgsState(JSON.parse(lBgs));
      } catch {
        // ignore — fall back to defaults
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setGlobalChatBg = useCallback(async (bgId: string) => {
    setGlobalChatBgState(bgId);
    try { await AsyncStorage.setItem(KEY_GLOBAL_BG, bgId); } catch {}
  }, []);

  const setLocalChatBg = useCallback(async (chatPartnerId: string, bgId: string | null) => {
    setLocalChatBgsState(prev => {
      const next = { ...prev };
      if (bgId === null) {
        delete next[chatPartnerId];
      } else {
        next[chatPartnerId] = bgId;
      }
      AsyncStorage.setItem(KEY_LOCAL_BGS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = {
    globalChatBg, setGlobalChatBg,
    localChatBgs, setLocalChatBg,
  };

  // Don't block render — just expose defaults until storage is read
  if (!ready) {
    return (
      <AppearanceContext.Provider value={value}>
        {children}
      </AppearanceContext.Provider>
    );
  }

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  return useContext(AppearanceContext);
}
