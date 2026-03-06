import { supabase } from "@/lib/supabase";
import {
    fetchActiveLivestreams,
    type Livestream,
} from "@/services/livestreamService";
import { useCallback, useEffect, useState } from "react";

/**
 * useLivestreams
 *
 * Uses a payload-aware Supabase subscription so state is updated surgically:
 * - INSERT  → new active stream appended to list immediately
 * - UPDATE  → patched in-place (viewer_count, etc.) — no HTTP round-trip
 * - DELETE / is_active=false → removed from list immediately
 *
 * This eliminates the "polling" feel caused by re-fetching on every
 * viewer_count UPDATE event.
 */
export function useLivestreams() {
  const [livestreams, setLivestreams] = useState<Livestream[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await fetchActiveLivestreams();
      setLivestreams(data);
    } catch (e) {
      console.error("useLivestreams: fetch error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);

    const channel = supabase
      .channel("useLivestreams-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_streams" },
        (payload) => {
          const row = payload.new as Livestream;
          if (!row.is_active) return; // ignore inactive inserts
          setLivestreams((prev) =>
            prev.some((s) => s.id === row.id) ? prev : [row, ...prev],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_streams" },
        (payload) => {
          const row = payload.new as Livestream;
          if (!row.is_active) {
            // Stream ended — remove it
            setLivestreams((prev) => prev.filter((s) => s.id !== row.id));
          } else {
            // Patch in-place (viewer_count, title, etc.) — no refetch
            setLivestreams((prev) =>
              prev.map((s) => (s.id === row.id ? row : s)),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "live_streams" },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setLivestreams((prev) => prev.filter((s) => s.id !== id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  /** Returns true if the given Supabase user UUID has an active live stream */
  const isUserLive = useCallback(
    (userId: string | null | undefined): boolean => {
      if (!userId) return false;
      return livestreams.some((s) => s.user_id === userId && s.is_active);
    },
    [livestreams],
  );

  /** Returns the active Livestream record for a user (if any) */
  const getLivestreamForUser = useCallback(
    (userId: string | null | undefined): Livestream | null => {
      if (!userId) return null;
      return (
        livestreams.find((s) => s.user_id === userId && s.is_active) ?? null
      );
    },
    [livestreams],
  );

  return { livestreams, loading, isUserLive, getLivestreamForUser };
}
