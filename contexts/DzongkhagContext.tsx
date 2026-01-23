// context/DzongkhagContext.tsx

import { useUser } from "@/contexts/UserContext";
import { dzongkhagCenters } from "@/data/dzongkhag";
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
  const [name, setName] = useState<string | null>(currentUser?.dzongkhag || null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const throttleRef = useRef(false);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const lookup = useCallback(async () => {
  if (throttleRef.current) return;
  throttleRef.current = true;
  setLoading(true);

  setAccessDenied(false);

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setAccessDenied(true);
      return;
    }

    const { coords } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    setAccessDenied(false);
    setLocation({ latitude: coords.latitude, longitude: coords.longitude });

    let nearest = dzongkhagCenters[0];
    let minDist = Infinity;

    for (const dz of dzongkhagCenters) {
      const d = getDistance(coords.latitude, coords.longitude, dz.lat, dz.lon);
      if (d < minDist) {
        minDist = d;
        nearest = dz;
      }
    }

    let detectedName = nearest.name;
    if (detectedName === "Phuentsholing") detectedName = "Chhukha";
    if (detectedName === "Gelephu") detectedName = "Sarpang";

    setName(detectedName);

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
        setCurrentUser(updatedUser);
      }
    }
  } catch (err: any) {
    setAccessDenied(true);
    setName(null);
  } finally {
    setLoading(false);
    throttleRef.current = false;
  }
}, [currentUser, setCurrentUser]); // Add currentUser as dependency

  useEffect(() => {
    if (currentUser?.dzongkhag) {
      setName(currentUser.dzongkhag);
    }
  }, [currentUser?.dzongkhag]);

  // Load saved location from database on mount for fast initial render
  useEffect(() => {
    const loadSavedLocation = async () => {
      if (currentUser?.id) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('location')
            .eq('id', currentUser.id)
            .single();

          if (data?.location) {
            setLocation({
              latitude: data.location.latitude,
              longitude: data.location.longitude,
            });
          }
        } catch (error) {
          console.log('Could not load saved location');
        }
      }
    };

    loadSavedLocation();
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