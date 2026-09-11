import { supabase } from '@/lib/supabase';
import { clearQueryCache } from '@/lib/queryCache';
import { clearMediaCache } from '@/lib/setlogMediaCache';
import { logoutOneSignalUser } from '@/services/oneSignalService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  phone_number: any;
  id?: string;
  username?: string;
  name?: string;
  /**
   * Only ever set by an OAuth provider's `user_metadata`, which `login.tsx`
   * already normalises into `name` — so on a profile loaded from the
   * `profiles` table this is undefined, and the several `name || full_name`
   * fallbacks around the app are reading a field that is not a column.
   * Declared rather than deleted because a row could still carry it, and a
   * fallback that quietly does nothing is cheaper than one that throws.
   */
  full_name?: string | null;
  email?: string;
  phone?: string;
  password?: string;
  followers?: number;
  following?: number;
  profileImg?: any;
  avatar_url?: string | null;
  /** DiceBear style id when the avatar is a generated one, null when it is
   *  a real photo — see lib/dicebear.ts. */
  avatar_style?: string | null;
  /** DiceBear animationVariant for that style. */
  avatar_animation?: string | null;
  bio?: string | null;
  cover_image_url?: string | null;
  cover_hue?: number | null;
  namzoed_id?: string | null;
  birth_date?: string | null;
  show_birthday?: boolean | null;
  birthday_display?: string | null;
  dzongkhag?: string | null;
  products?: Array<{
    name: string;
    productImg: any;
  }>;
}

interface UserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      logoutOneSignalUser();
      // Clear Supabase auth session so next login doesn't reuse stale account.
      await supabase.auth.signOut({ scope: 'local' });
      await AsyncStorage.removeItem('currentUser');
      // Every cached query goes with the session. It holds one account's
      // rows — and, for Setlog, week-long signed URLs into a private
      // bucket, which would otherwise outlive the account on a shared
      // phone and still play.
      await clearQueryCache();
      // And the clips themselves. They now live in the documents directory
      // and survive everything else, which on a shared phone would mean the
      // next person could scrub through the last person's Setlog offline.
      clearMediaCache();
      setCurrentUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
