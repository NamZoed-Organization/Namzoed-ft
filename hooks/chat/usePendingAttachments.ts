/**
 * Pictures waiting in the composer, uploading while you type.
 *
 * Picking a photograph used to send it — the file went straight up and
 * landed in the thread before you had said anything about it, so whatever
 * you meant to say arrived underneath as a separate message with no visible
 * connection to the picture. Now a pick lands in the composer instead, and
 * the send button sends both together.
 *
 * **The upload starts immediately, not on send.** By the time somebody has
 * typed a line the bytes are usually already up, so Send is instant; and if
 * they send before it finishes, the send simply waits on the promises that
 * are already in flight rather than starting them. That is the whole reason
 * this is a hook with its own state rather than a list of URIs handed to the
 * sender at the end.
 *
 * A failed upload stays in the strip as a failed thumbnail rather than
 * vanishing or blocking the message: the picture is still there to retry or
 * remove, and anything that did upload can still go.
 */

import { supabase } from "@/lib/supabase";
import { uploadFileToSupabase } from "@/lib/uploadFile";
import { useCallback, useRef, useState } from "react";

export type AttachmentState = "uploading" | "ready" | "failed";

export interface PendingAttachment {
  id: string;
  /** The local file, shown in the strip and in the optimistic bubble. */
  uri: string;
  type: "image" | "video";
  state: AttachmentState;
  /** Where it landed, once it has. */
  remoteUrl?: string;
}

export interface PickedAsset {
  uri: string;
  type?: string | null;
}

/** How many can wait at once — the picker's own limit, kept in step. */
export const MAX_ATTACHMENTS = 10;

export function usePendingAttachments(conversationKey: string) {
  const [items, setItems] = useState<PendingAttachment[]>([]);
  /** Every upload in flight, so a send can wait on them rather than
   *  starting a second round of the same work. */
  const inFlight = useRef<Map<string, Promise<string | null>>>(new Map());

  const upload = useCallback(
    async (attachment: PendingAttachment): Promise<string | null> => {
      const isVideo = attachment.type === "video";
      const bucket = isVideo ? "chat-videos" : "chat-images";
      const ext = isVideo ? "mp4" : "jpg";
      const path = `${conversationKey}/${attachment.id}_${Date.now()}.${ext}`;

      try {
        await uploadFileToSupabase(
          attachment.uri,
          bucket,
          path,
          isVideo ? "video/mp4" : "image/jpeg",
          true,
        );
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        const url = data.publicUrl;
        setItems((prev) =>
          prev.map((item) =>
            item.id === attachment.id
              ? { ...item, state: "ready", remoteUrl: url }
              : item,
          ),
        );
        return url;
      } catch (e) {
        console.error("[chat] attachment upload failed", e);
        setItems((prev) =>
          prev.map((item) =>
            item.id === attachment.id ? { ...item, state: "failed" } : item,
          ),
        );
        return null;
      }
    },
    [conversationKey],
  );

  const add = useCallback(
    (assets: PickedAsset[]) => {
      setItems((prev) => {
        const room = MAX_ATTACHMENTS - prev.length;
        if (room <= 0) return prev;

        const next = assets.slice(0, room).map((asset, i) => ({
          id: `att-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          uri: asset.uri,
          type: (asset.type === "video" ? "video" : "image") as "image" | "video",
          state: "uploading" as AttachmentState,
        }));

        // Started here rather than in an effect: an effect would fire again
        // on every unrelated re-render of the list and re-upload the lot.
        next.forEach((attachment) => {
          inFlight.current.set(attachment.id, upload(attachment));
        });

        return [...prev, ...next];
      });
    },
    [upload],
  );

  const retry = useCallback(
    (id: string) => {
      setItems((prev) => {
        const attachment = prev.find((item) => item.id === id);
        if (!attachment) return prev;
        inFlight.current.set(id, upload({ ...attachment, state: "uploading" }));
        return prev.map((item) =>
          item.id === id ? { ...item, state: "uploading" } : item,
        );
      });
    },
    [upload],
  );

  const remove = useCallback((id: string) => {
    inFlight.current.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => {
    inFlight.current.clear();
    setItems([]);
  }, []);

  /**
   * The URLs to send, waiting on anything still in the air.
   *
   * Order is the order they were picked, and a failure drops out rather than
   * holding up the rest — one photograph that would not upload should not
   * cost somebody the other five and the sentence they wrote.
   */
  const resolve = useCallback(async (): Promise<string[]> => {
    const pending = items.map(
      (item) => item.remoteUrl ?? inFlight.current.get(item.id) ?? null,
    );
    const settled = await Promise.all(
      pending.map((value) => (typeof value === "string" ? value : value)),
    );
    return settled.filter((url): url is string => typeof url === "string" && !!url);
  }, [items]);

  return {
    items,
    add,
    remove,
    retry,
    clear,
    resolve,
    /** Anything at all in the composer. */
    any: items.length > 0,
    uploading: items.some((item) => item.state === "uploading"),
  };
}
