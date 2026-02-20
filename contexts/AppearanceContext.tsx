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

interface AppearanceContextValue {
  bubbleSkin:   BubbleSkin;
  setBubbleSkin: (skin: BubbleSkin) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue>({
  bubbleSkin:   'founding',
  setBubbleSkin: async () => {},
});

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [bubbleSkin, setBubbleSkinState] = useState<BubbleSkin>('founding');
  const [ready, setReady] = useState(false);

  // Restore persisted preferences
  useEffect(() => {
    (async () => {
      try {
        const bub = await AsyncStorage.getItem(KEY_BUBBLE);
        if (bub) setBubbleSkinState(bub as BubbleSkin);
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

  // Don't block render — just expose defaults until storage is read
  if (!ready) {
    return (
      <AppearanceContext.Provider value={{ bubbleSkin, setBubbleSkin }}>
        {children}
      </AppearanceContext.Provider>
    );
  }

  return (
    <AppearanceContext.Provider value={{ bubbleSkin, setBubbleSkin }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  return useContext(AppearanceContext);
}
