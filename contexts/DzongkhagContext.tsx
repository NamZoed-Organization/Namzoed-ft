// context/DzongkhagContext.tsx

import { useUser } from "@/contexts/UserContext";
import { nearestDzongkhag } from "@/utils/dzongkhag";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface DzongkhagState {
  name: string | null;
  loading: boolean;
  accessDenied: boolean;
  location: { latitude: number; longitude: number } | null;
  refresh: () => void;
}

const DzongkhagContext = createContext<DzongkhagState | undefined>(undefined);

export const DzongkhagProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentUser, setCurrentUser } = useUser();
  const isMountedRef = useRef(true);
  const [name, setName] = useState<string | null>(currentUser?.dzongkhag || null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const throttleRef = useRef(false);

  const lookup = useCallback(async () => {
  if (throttleRef.current) return;
  throttleRef.current = true;
  if (isMountedRef.current) setLoading(true);

  if (isMountedRef.current) setAccessDenied(false);

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      if (isMountedRef.current) setAccessDenied(true);
      return;
    }

    const { coords } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    if (isMountedRef.current) {
      setAccessDenied(false);
      setLocation({ latitude: coords.latitude, longitude: coords.longitude });
    }

    const detectedName = nearestDzongkhag(coords.latitude, coords.longitude);

    if (isMountedRef.current) setName(detectedName);

    if (currentUser?.id) {
      const locationData = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        timestamp: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update({
          dzongkhag: detectedName,
          location: locationData,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (!error) {
        // Always update local cache, not just when dzongkhag changes
        const updatedUser = { ...currentUser, dzongkhag: detectedName };
        await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));
        if (isMountedRef.current) {
          setCurrentUser(updatedUser);
        }
      }
    }
  } catch (err: any) {
    if (isMountedRef.current) {
      setAccessDenied(true);
      setName(null);
    }
  } finally {
    if (isMountedRef.current) setLoading(false);
    throttleRef.current = false;
  }
}, [currentUser, setCurrentUser]); // Add currentUser as dependency

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (currentUser?.dzongkhag) {
      setName(currentUser.dzongkhag);
    }
  }, [currentUser?.dzongkhag]);

  // Load saved location from database on mount for fast initial render
  useEffect(() => {
    let isActive = true;
    const loadSavedLocation = async () => {
      if (currentUser?.id) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('location')
            .eq('id', currentUser.id)
            .single();

          if (isActive && data?.location) {
            setLocation({
              latitude: data.location.latitude,
              longitude: data.location.longitude,
            });
          }
        } catch (error) {
        }
      }
    };

    loadSavedLocation();
    return () => {
      isActive = false;
    };
  }, [currentUser?.id]);

  return (
    <DzongkhagContext.Provider
      value={{ name, loading, accessDenied, location, refresh: lookup }}
    >
      {children}
    </DzongkhagContext.Provider>
  );
};

export function useDzongkhag() {
  const ctx = useContext(DzongkhagContext);
  if (!ctx)
    throw new Error("useDzongkhag must be used inside a DzongkhagProvider");
  return ctx;
}
