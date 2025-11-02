import { supabase } from "@/lib/supabase";

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
  // Deprecated: callers should use this exported function which now delegates
  // to a shared manager below. Keep the signature but forward to manager so
  // existing code continues to work.
  return subscribeToLivestreamsShared(onChange);
}

/*
  Shared subscription manager

  Problem being fixed: code was repeatedly creating many realtime channels
  which results in excessive calls to `realtime.list_changes`. To avoid that
  we create at most one Realtime channel per client instance and keep a Set
  of callbacks. When the first listener registers we subscribe; when the
  last listener unsubscribes we remove the channel.

  This prevents noisy resubscribe loops and reduces compute usage.
*/
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
}

export async function createLivestreamRecord(
  payload: CreateLivestreamPayload
): Promise<Livestream> {
  const now = new Date().toISOString();

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
      external_metadata: payload.external_metadata ?? null,
      thumbnail: payload.thumbnail ?? null,
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
