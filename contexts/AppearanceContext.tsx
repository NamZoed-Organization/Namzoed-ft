/**
 * AppearanceContext
 *
 * Global store for the user's chosen chat-bubble skin.
 * Preferences are persisted to AsyncStorage and restored on startup.
 *
 * Bubble skins are named after badge tiers — a user can only select a style
 * they own.  The actual gating is enforced in the settings UI; the context
 * simply stores and restores the current choice.
 *
 *   'founding' — gold gradient (Founding Member)
 *   'waitlist' — amber gradient (Pioneer)
 *   'tester'   — silver gradient (Beta Tester)
 *   'genesis'  — green gradient (Genesis)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

export type BubbleSkin = 'founding' | 'waitlist' | 'tester' | 'genesis';

const KEY_BUBBLE = '@namzoed_bubble_skin';
const KEY_GLOBAL_BG = '@namzoed_global_chat_bg';
const KEY_LOCAL_BGS = '@namzoed_local_chat_bgs';

interface AppearanceContextValue {
  bubbleSkin:   BubbleSkin;
  setBubbleSkin: (skin: BubbleSkin) => Promise<void>;
  
  globalChatBg: string;
  setGlobalChatBg: (bgId: string) => Promise<void>;
  
  localChatBgs: Record<string, string>;
  setLocalChatBg: (chatPartnerId: string, bgId: string | null) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  bubbleSkin:   'founding',
  setBubbleSkin: async () => {},
  
  globalChatBg: 'default',
  setGlobalChatBg: async () => {},
  
  localChatBgs: {},
  setLocalChatBg: async () => {},
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [bubbleSkin, setBubbleSkinState] = useState<BubbleSkin>('founding');
  const [globalChatBg, setGlobalChatBgState] = useState<string>('default');
  const [localChatBgs, setLocalChatBgsState] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  // Restore persisted preferences
  useEffect(() => {
    (async () => {
      try {
        const [bub, gBg, lBgs] = await Promise.all([
          AsyncStorage.getItem(KEY_BUBBLE),
          AsyncStorage.getItem(KEY_GLOBAL_BG),
          AsyncStorage.getItem(KEY_LOCAL_BGS),
        ]);
        if (bub) setBubbleSkinState(bub as BubbleSkin);
        if (gBg) setGlobalChatBgState(gBg);
        if (lBgs) setLocalChatBgsState(JSON.parse(lBgs));
      } catch {
        // ignore — fall back to defaults
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setBubbleSkin = useCallback(async (skin: BubbleSkin) => {
    setBubbleSkinState(skin);
    try { await AsyncStorage.setItem(KEY_BUBBLE, skin); } catch {}
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
    bubbleSkin, setBubbleSkin,
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
