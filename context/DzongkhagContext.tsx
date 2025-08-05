// context/DzongkhagContext.tsx

import { dzongkhagCenters } from "@/data/dzongkhag";
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
  refresh: () => void;
}

const DzongkhagContext = createContext<DzongkhagState | undefined>(undefined);

export const DzongkhagProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [name, setName] = useState<string | null>(null);
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

    // simulate UX delay
    setTimeout(async () => {
      // reset loading & throttle
      setLoading(false);
      throttleRef.current = false;

      // real geolocation
      const services = await Location.hasServicesEnabledAsync();
      if (!services) {
        setAccessDenied(true);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setAccessDenied(true);
        return;
      }
      setAccessDenied(false);

      const { coords } = await Location.getCurrentPositionAsync();
      let nearest = dzongkhagCenters[0];
      let minDist = Infinity;
      for (const dz of dzongkhagCenters) {
        const d = getDistance(
          coords.latitude,
          coords.longitude,
          dz.lat,
          dz.lon
        );
        if (d < minDist) {
          minDist = d;
          nearest = dz;
        }
      }
      setName(nearest.name);
    }, 3000);
  }, []);

  // run once on mount
  useEffect(() => {
    lookup();
  }, [lookup]);

  return (
    <DzongkhagContext.Provider
      value={{ name, loading, accessDenied, refresh: lookup }}
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
