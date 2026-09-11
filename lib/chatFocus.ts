/**
 * "Take me to that message" — the handoff from chat details back to the
 * conversation.
 *
 * Tapping a search result used to call
 * `router.push('/(users)/chat/<partner>')` with no message reference at all,
 * so every hit did the same thing: opened a *second* copy of the chat on top
 * of the details screen, which loaded the newest page and sat at the bottom.
 * The results were decorative — you could find the message and then not go
 * to it.
 *
 * This is deliberately a module-level slot rather than a route parameter.
 * Details is pushed *from* the chat, so the conversation is already on the
 * stack with its history loaded and its scroll position intact: the right
 * move is `router.back()` into it, not another push. A route param cannot
 * ride along with a back navigation, and stacking a duplicate screen to
 * carry one is the bug this replaces — it leaves Back going chat → details →
 * chat through screens the reader never chose.
 *
 * The slot holds one request and is emptied by whoever takes it, so a
 * request cannot be replayed by an unrelated re-focus later.
 */

export interface MessageFocusRequest {
  /** Whose conversation, so a stale request cannot fire in another one. */
  partnerId: string;
  messageId: string;
  /** Lets the reader page back to it without guessing how far: keep loading
   *  older messages while the oldest loaded is still newer than this. */
  createdAt: string;
}

let pending: MessageFocusRequest | null = null;

export const requestMessageFocus = (request: MessageFocusRequest): void => {
  pending = request;
};

/** Takes the request if it belongs to this conversation, and clears it. */
export const takeMessageFocus = (
  partnerId: string,
): MessageFocusRequest | null => {
  if (!pending || pending.partnerId !== String(partnerId)) return null;
  const request = pending;
  pending = null;
  return request;
};

export const clearMessageFocus = (): void => {
  pending = null;
};
