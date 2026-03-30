import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

/**
 * Live status for a booking row (pending | accepted | rejected | completed), for chat UI.
 */
export function useBookingRequestStatus(
  bookingRequestId: string | null | undefined,
): { status: string | null; loading: boolean } {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!bookingRequestId);

  useEffect(() => {
    if (!bookingRequestId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const channelName = `booking_status_${bookingRequestId}`;

    async function fetchStatus() {
      const { data } = await supabase
        .from("booking_requests")
        .select("status")
        .eq("id", bookingRequestId)
        .maybeSingle();
      if (cancelled) return;
      setStatus(data?.status ?? null);
      setLoading(false);
    }

    void fetchStatus();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "booking_requests",
          filter: `id=eq.${bookingRequestId}`,
        },
        (payload) => {
          const s = (payload.new as { status?: string })?.status;
          if (typeof s === "string") setStatus(s);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [bookingRequestId]);

  return { status, loading };
}
