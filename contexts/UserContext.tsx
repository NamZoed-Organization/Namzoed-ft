import { supabase } from '@/lib/supabase';
import { logoutOneSignalUser } from '@/services/oneSignalService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  phone_number: any;
  id?: string;
  username?: string;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  followers?: number;
  following?: number;
  profileImg?: any;
  avatar_url?: string | null;
  bio?: string | null;
  cover_image_url?: string | null;
  namzoed_id?: string | null;
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
