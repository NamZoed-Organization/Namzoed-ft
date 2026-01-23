import { supabase } from "@/lib/supabase";

export type LivestreamType = "business" | "entertainment";

export interface Livestream {
  id: string;
  user_id: string | null;
  username: string | null;
  profile_image?: string | null;
  title?: string | null;
  description?: string | null;
  is_active: boolean;
  viewer_count: number | null;
  likes: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  stream_key: string | null;
  stream_provider_id?: string | null;
  playback_id?: string | null;
  playback_policy?: string | null;
  hls_url?: string | null;
  dash_url?: string | null;
  rtmp_address?: string | null;
  recording_enabled?: boolean | null;
  external_metadata?: Record<string, unknown> | null;
  thumbnail?: string | null;
  stream_type?: LivestreamType | null;
  co_hosts?: string[] | null; // Array of user IDs who are co-hosts
}

export interface CoHostRequest {
  id: string;
  livestream_id: string;
  user_id: string;
  username: string;
  profile_image?: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

const TABLE_NAME = "live_streams";

export async function fetchActiveLivestreams(): Promise<Livestream[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("is_active", true)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Failed to load active livestreams", error);
    throw error;
  }

  return (data ?? []) as Livestream[];
}

export function subscribeToLivestreams(onChange: () => void): () => void {
  return subscribeToLivestreamsShared(onChange);
}

export async function incrementLivestreamViewerCountAtomic(
  id: string,
  delta = 1
): Promise<void> {
  const { error } = await supabase.rpc("increment_viewer_count", {
    p_id: id,
    p_delta: delta,
  });

  if (error) {
    console.error("Failed to increment viewer count atomically", error);
    throw error;
  }
}

const _livestreamsChannelState: {
  channel: ReturnType<typeof supabase.channel> | null;
  callbacks: Set<() => void>;
  subscribed: boolean;
} = {
  channel: null,
  callbacks: new Set(),
  subscribed: false,
};

function _createChannel() {
  if (_livestreamsChannelState.channel) return;

  const channel = supabase.channel("livestreams-changes").on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: TABLE_NAME,
    },
    () => {
      // call each registered listener; keep errors isolated
      try {
        for (const cb of Array.from(_livestreamsChannelState.callbacks)) {
          try {
            cb();
          } catch (e) {
            // swallow callback errors to keep channel alive
            // and avoid noisy reconnections
            // eslint-disable-next-line no-console
            console.error("livestreams callback error", e);
          }
        }
      } catch (outer) {
        // eslint-disable-next-line no-console
        console.error("Error dispatching livestreams callbacks", outer);
      }
    }
  );

  _livestreamsChannelState.channel = channel;
  _livestreamsChannelState.subscribed = true;

  // subscribe returns a promise-like object; handle possible errors
  try {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // noop — channel active
      } else if (status === "CHANNEL_ERROR") {
        // log so we can surface issues in app logs
        // eslint-disable-next-line no-console
        console.warn("livestreams channel error", status);
      }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to subscribe to livestreams channel", err);
  }
}

function _removeChannel() {
  const channel = _livestreamsChannelState.channel;
  if (!channel) return;

  try {
    // supabase client provides removeChannel for cleanup
    supabase.removeChannel(channel);
  } catch (err) {
    // fallback: try channel.unsubscribe if removeChannel is not available
    try {
      // @ts-ignore
      channel.unsubscribe();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to remove/unsubscribe livestreams channel", e);
    }
  }

  _livestreamsChannelState.channel = null;
  _livestreamsChannelState.subscribed = false;
}

export function subscribeToLivestreamsShared(onChange: () => void): () => void {
  // add callback (Set avoids dupes)
  _livestreamsChannelState.callbacks.add(onChange);

  // only create the channel when the first callback is registered
  if (!_livestreamsChannelState.subscribed) {
    _createChannel();
  }

  // return unsubscribe function that removes the callback and tears down
  // the channel when no more listeners remain
  return () => {
    try {
      _livestreamsChannelState.callbacks.delete(onChange);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error removing livestreams callback", err);
    }

    if (_livestreamsChannelState.callbacks.size === 0) {
      _removeChannel();
    }
  };
}

interface CreateLivestreamPayload {
  user_id: string;
  username: string;
  profile_image?: string | null;
  stream_key?: string | null;
  title?: string | null;
  description?: string | null;
  stream_provider_id?: string | null;
  playback_id?: string | null;
  playback_policy?: string | null;
  hls_url?: string | null;
  dash_url?: string | null;
  rtmp_address?: string | null;
  recording_enabled?: boolean | null;
  external_metadata?: Record<string, unknown> | null;
  thumbnail?: string | null;
  call_id?: string | null;
  call_cid?: string | null;
  call_type?: string | null;
  stream_type?: LivestreamType | null;
}

export async function createLivestreamRecord(
  payload: CreateLivestreamPayload
): Promise<Livestream> {
  const now = new Date().toISOString();

  const mergedMetadata: Record<string, unknown> | null = (() => {
    const base = payload.external_metadata
      ? { ...payload.external_metadata }
      : {};

    if (payload.call_id) {
      base.call_id = payload.call_id;
    }
    if (payload.call_cid) {
      base.call_cid = payload.call_cid;
    }
    if (payload.call_type) {
      base.call_type = payload.call_type;
    }
    return Object.keys(base).length > 0 ? base : null;
  })();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({
      user_id: payload.user_id,
      username: payload.username,
      profile_image: payload.profile_image ?? null,
      title: payload.title ?? null,
      description: payload.description ?? null,
      is_active: true,
      viewer_count: 0,
      likes: 0,
      started_at: now,
      stream_key: payload.stream_key ?? null,
      stream_provider_id: payload.stream_provider_id ?? null,
      playback_id: payload.playback_id ?? null,
      playback_policy: payload.playback_policy ?? null,
      hls_url: payload.hls_url ?? null,
      dash_url: payload.dash_url ?? null,
      rtmp_address: payload.rtmp_address ?? null,
      recording_enabled: payload.recording_enabled ?? false,
      external_metadata: mergedMetadata,
      thumbnail: payload.thumbnail ?? null,
      stream_type: payload.stream_type ?? "entertainment",
      co_hosts: [],
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to create livestream record", error);
    throw error ?? new Error("Unable to create livestream record");
  }

  return data as Livestream;
}

export async function endLivestreamRecord(
  id: string,
  ownerId?: string | null
): Promise<void> {
  const now = new Date().toISOString();

  let query = supabase
    .from(TABLE_NAME)
    .update({
      is_active: false,
      ended_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (ownerId) {
    query = query.eq("user_id", ownerId);
  }

  const { error } = await query;

  if (error) {
    console.error("Failed to end livestream", error);
    throw error;
  }
}

export async function adjustLivestreamViewerCount(
  id: string,
  delta: number
): Promise<void> {
  try {
    const current = await supabase
      .from(TABLE_NAME)
      .select("viewer_count")
      .eq("id", id)
      .single();

    if (current.error) {
      console.error("Failed to fetch viewer count", current.error);
      return;
    }

    const viewerCount = current.data?.viewer_count ?? 0;
    const nextValue = Math.max(0, viewerCount + delta);

    const update = await supabase
      .from(TABLE_NAME)
      .update({
        viewer_count: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (update.error) {
      if (update.error.code === "42501") {
        // Row-level security denied; skip logging to avoid noise for viewers.
        return;
      }
      console.error("Failed to update viewer count", update.error);
    }
  } catch (error) {
    console.error("Unexpected error adjusting viewer count", error);
  }
}

// Co-host request management
const COHOST_REQUESTS_TABLE = "cohost_requests";

export async function createCoHostRequest(
  livestreamId: string,
  userId: string,
  username: string,
  profileImage?: string | null
): Promise<CoHostRequest> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from(COHOST_REQUESTS_TABLE)
    .insert({
      livestream_id: livestreamId,
      user_id: userId,
      username,
      profile_image: profileImage ?? null,
      status: "pending",
      created_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to create co-host request", error);
    throw error ?? new Error("Unable to create co-host request");
  }

  return data as CoHostRequest;
}

export async function fetchPendingCoHostRequests(
  livestreamId: string
): Promise<CoHostRequest[]> {
  const { data, error } = await supabase
    .from(COHOST_REQUESTS_TABLE)
    .select("*")
    .eq("livestream_id", livestreamId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch co-host requests", error);
    throw error;
  }

  return (data ?? []) as CoHostRequest[];
}

export async function updateCoHostRequestStatus(
  requestId: string,
  status: "accepted" | "rejected"
): Promise<void> {
  const { error } = await supabase
    .from(COHOST_REQUESTS_TABLE)
    .update({ status })
    .eq("id", requestId);

  if (error) {
    console.error("Failed to update co-host request status", error);
    throw error;
  }
}

export async function cancelCoHostRequest(
  livestreamId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from(COHOST_REQUESTS_TABLE)
    .delete()
    .eq("livestream_id", livestreamId)
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) {
    console.error("Failed to cancel co-host request", error);
    throw error;
  }
}

export async function addCoHostToLivestream(
  livestreamId: string,
  coHostUserId: string
): Promise<void> {
  // First get the current co_hosts array
  const { data: stream, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select("co_hosts")
    .eq("id", livestreamId)
    .single();

  if (fetchError) {
    console.error("Failed to fetch livestream for co-host update", fetchError);
    throw fetchError;
  }

  const currentCoHosts = (stream?.co_hosts as string[]) ?? [];
  if (!currentCoHosts.includes(coHostUserId)) {
    const updatedCoHosts = [...currentCoHosts, coHostUserId];

    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({
        co_hosts: updatedCoHosts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", livestreamId);

    if (updateError) {
      console.error("Failed to add co-host to livestream", updateError);
      throw updateError;
    }
  }
}

export async function removeCoHostFromLivestream(
  livestreamId: string,
  coHostUserId: string
): Promise<void> {
  const { data: stream, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select("co_hosts")
    .eq("id", livestreamId)
    .single();

  if (fetchError) {
    console.error("Failed to fetch livestream for co-host removal", fetchError);
    throw fetchError;
  }

  const currentCoHosts = (stream?.co_hosts as string[]) ?? [];
  const updatedCoHosts = currentCoHosts.filter((id) => id !== coHostUserId);

  const { error: updateError } = await supabase
    .from(TABLE_NAME)
    .update({
      co_hosts: updatedCoHosts,
      updated_at: new Date().toISOString(),
    })
    .eq("id", livestreamId);

  if (updateError) {
    console.error("Failed to remove co-host from livestream", updateError);
    throw updateError;
  }
}

export function subscribeToCoHostRequests(
  livestreamId: string,
  onChange: () => void
): () => void {
  const channel = supabase
    .channel(`cohost-requests-${livestreamId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: COHOST_REQUESTS_TABLE,
        filter: `livestream_id=eq.${livestreamId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToViewerCount(
  livestreamId: string,
  onCountChange: (count: number) => void
): () => void {
  const channel = supabase
    .channel(`viewer-count-${livestreamId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: TABLE_NAME,
        filter: `id=eq.${livestreamId}`,
      },
      (payload) => {
        if (payload.new && typeof payload.new.viewer_count === "number") {
          onCountChange(payload.new.viewer_count);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
