/**
 * Analytics Service
 *
 * Tracks user interactions (button taps, screen views, feature usage) to
 * understand which parts of the app users engage with most.
 *
 * Interactions are batched in memory and flushed to Supabase every few seconds
 * to avoid a DB round-trip on every single tap.
 */

import { supabase } from "@/lib/supabase";

// ─── Typed constants ──────────────────────────────────────────────────────────

export const Screens = {
  HOME: "home",
  FEED: "feed",
  MARKETPLACE: "marketplace",
  CATEGORIES: "categories",
  SERVICES: "services",
  MESSAGES: "messages",
  CHAT: "chat",
  PROFILE: "profile",
  PROFILE_OTHER: "profile_other",
  POST_DETAIL: "post_detail",
  PRODUCT_DETAIL: "product_detail",
  MARKETPLACE_DETAIL: "marketplace_detail",
  SERVICE_DETAIL: "service_detail",
  SEARCH: "search",
  NOTIFICATIONS: "notifications",
  LIVE_STREAM: "live_stream",
  MONGOOSE_DASHBOARD: "mongoose_dashboard",
  LOGIN: "login",
  SIGNUP: "signup",
  ONBOARDING: "onboarding",
} as const;

export const Features = {
  // Feed & Posts
  POST_LIKE: "post_like",
  POST_COMMENT: "post_comment",
  POST_SHARE: "post_share",
  POST_BOOKMARK: "post_bookmark",
  POST_VIEW: "post_view",
  POST_CREATE: "post_create",
  POST_REPORT: "post_report",
  POST_REEL: "post_reel",

  // Social
  FOLLOW: "follow",
  UNFOLLOW: "unfollow",
  USER_PROFILE_VIEW: "user_profile_view",
  SEARCH: "search",

  // Messaging
  MESSAGE_SEND: "message_send",
  MESSAGE_REQUEST: "message_request",
  VOICE_MESSAGE: "voice_message",
  GIF_SEND: "gif_send",
  CHAT_OPEN: "chat_open",

  // Live Streaming
  LIVE_STREAM_JOIN: "live_stream_join",
  LIVE_STREAM_START: "live_stream_start",
  LIVE_STREAM_LEAVE: "live_stream_leave",
  LIVE_STREAM_BROWSE: "live_stream_browse",

  // Marketplace & Products
  PRODUCT_VIEW: "product_view",
  PRODUCT_BROWSE: "product_browse",
  MARKETPLACE_VIEW: "marketplace_view",
  MARKETPLACE_BROWSE: "marketplace_browse",
  FLASH_DEAL_VIEW: "flash_deal_view",

  // Services
  SERVICE_VIEW: "service_view",
  SERVICE_BROWSE: "service_browse",
  SERVICE_BOOK: "service_book",
  BOOKING_REQUEST: "booking_request",

  // Navigation
  TAB_SWITCH: "tab_switch",
  SCREEN_VIEW: "screen_view",
  BACK_NAVIGATE: "back_navigate",

  // Banners & Promotions
  BANNER_TAP: "banner_tap",
  CLOSING_SALE_TAP: "closing_sale_tap",

  // Notifications
  NOTIFICATION_OPEN: "notification_open",
  NOTIFICATION_VIEW: "notification_view",

  // Sorting & Filtering
  SORT_CHANGE: "sort_change",
  FILTER_APPLY: "filter_apply",
  CATEGORY_SELECT: "category_select",

  // Auth
  LOGIN: "login",
  SIGNUP: "signup",
  LOGOUT: "logout",
} as const;

export const Elements = {
  // Tab bar
  TAB_HOME: "tab_home",
  TAB_FEED: "tab_feed",
  TAB_MARKETPLACE: "tab_marketplace",
  TAB_CATEGORIES: "tab_categories",
  TAB_SERVICES: "tab_services",

  // Buttons
  LIKE_BUTTON: "like_button",
  COMMENT_BUTTON: "comment_button",
  SHARE_BUTTON: "share_button",
  BOOKMARK_BUTTON: "bookmark_button",
  FOLLOW_BUTTON: "follow_button",
  SEND_BUTTON: "send_button",
  SEARCH_BAR: "search_bar",
  SORT_BUTTON: "sort_button",
  FILTER_BUTTON: "filter_button",
  REFRESH_CONTROL: "refresh_control",
  LOAD_MORE: "load_more",

  // Cards & List Items
  POST_CARD: "post_card",
  PRODUCT_CARD: "product_card",
  SERVICE_CARD: "service_card",
  MARKETPLACE_CARD: "marketplace_card",
  LIVE_CARD: "live_card",
  USER_AVATAR: "user_avatar",

  // Feed specific
  LIVE_BAR: "live_bar",
  STORIES_BAR: "stories_bar",
  CREATE_POST_FAB: "create_post_fab",

  // Home specific
  BANNER: "banner",
  FLASH_DEAL_ITEM: "flash_deal_item",
  HOME_SORT_CHIP: "home_sort_chip",
  CLOSING_SALE_BANNER: "closing_sale_banner",

  // Chat
  CHAT_ROW: "chat_row",
  MESSAGE_INPUT: "message_input",
  ATTACHMENT_BUTTON: "attachment_button",
  VOICE_RECORD_BUTTON: "voice_record_button",
} as const;

export const Actions = {
  TAP: "tap",
  LONG_PRESS: "long_press",
  VIEW: "view",
  SCROLL: "scroll",
  SWIPE: "swipe",
  REFRESH: "refresh",
  SEARCH: "search",
  SUBMIT: "submit",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type Screen = (typeof Screens)[keyof typeof Screens];
export type Feature = (typeof Features)[keyof typeof Features];
export type Element = (typeof Elements)[keyof typeof Elements];
export type Action = (typeof Actions)[keyof typeof Actions];

export interface TrackPayload {
  userId?: string | null;
  screen: Screen | string;
  feature: Feature | string;
  element?: Element | string;
  action: Action | string;
  metadata?: Record<string, unknown>;
}

// ─── Session ID ───────────────────────────────────────────────────────────────

/** Unique ID for the current app launch — resets on next open */
const SESSION_ID = (() => {
  // Simple RFC4122 v4 UUID without external dependencies
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
})();

// ─── Batching queue ───────────────────────────────────────────────────────────

interface QueuedInteraction {
  user_id: string | null;
  session_id: string;
  screen: string;
  feature: string;
  element: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 5_000; // flush every 5 seconds

let queue: QueuedInteraction[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, BATCH_SIZE);
  try {
    await supabase.from("user_interactions").insert(batch);
  } catch {
    // Silently discard — analytics must never break the app
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Track a user interaction.
 *
 * @example
 * trackInteraction({
 *   userId: currentUser?.id,
 *   screen: Screens.FEED,
 *   feature: Features.POST_LIKE,
 *   element: Elements.LIKE_BUTTON,
 *   action: Actions.TAP,
 *   metadata: { post_id: post.id },
 * });
 */
export function trackInteraction(payload: TrackPayload): void {
  // Dev and prod currently share one backend — skip writing real analytics
  // rows while running a development build (Metro/dev client), so testing
  // features doesn't pollute production interaction data. Real users only
  // ever run production builds, where __DEV__ is false, so this never
  // affects them.
  if (__DEV__) return;

  const interaction: QueuedInteraction = {
    user_id: payload.userId ?? null,
    session_id: SESSION_ID,
    screen: payload.screen,
    feature: payload.feature,
    element: payload.element ?? null,
    action: payload.action,
    metadata: payload.metadata ?? null,
    created_at: new Date().toISOString(),
  };

  queue.push(interaction);

  // Flush immediately when the batch is full, otherwise schedule a deferred flush
  if (queue.length >= BATCH_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush();
  } else {
    scheduleFlush();
  }
}

/** Force an immediate flush — call on app background/close events */
export function flushInteractions(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  return flush();
}
