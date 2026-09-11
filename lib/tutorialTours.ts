/**
 * The tours — what the app teaches, and in what order.
 *
 * Not slides. Every step points at a real control on the real screen and,
 * with one exception per tour, **waits for you to actually use it**: the
 * step about the plus button ends when the plus button is pressed, not when
 * a "Next" is tapped. A carousel of screenshots is read by nobody and
 * teaches nothing, because the thing it describes is never under your
 * finger while you are reading about it.
 *
 * That is also why the steps live here as data rather than as screens: a
 * step is a sentence, an anchor to point at, and the event that finishes
 * it. The engine is `contexts/TutorialContext.tsx`; what it draws is
 * `components/tutorial/TutorialOverlay.tsx`.
 *
 * Adding a step means three things, and all three have to line up:
 *  - wrap the control in `<TutorialAnchor id="…">` so it can be pointed at,
 *  - call `notify("…")` where the action actually happens,
 *  - write the step here.
 * A step whose anchor never registers still works — it degrades to a
 * bubble with no spotlight and blocks nothing — but a step whose event is
 * never fired is a dead end, so the event is the half worth checking.
 */

import type { MascotMood } from "@/components/ui/Mascot";

export type TourId =
  | "create"
  | "post"
  | "setlog"
  | "contextdrop"
  | "business"
  | "product"
  | "marketplace";

/** How a step ends. */
export type TutorialAdvance =
  /** The app said the thing happened. The only kind that teaches. */
  | { on: "action"; event: string; hint: string }
  /** Nothing to do but read it — a "Got it" closes the step. */
  | { on: "next" };

export interface TutorialStep {
  /** Unique within its tour; also what analytics would key on. */
  id: string;
  /** Which `TutorialAnchor` to spotlight. Absent = a bubble with no hole. */
  anchor?: string;
  title: string;
  body: string;
  advance: TutorialAdvance;
  /** Drawn on the spotlight when the thing to do is not a tap. */
  gesture?: "swipe-right" | "hold" | "swipe-up";
  /**
   * Which face the mongoose pulls on this card.
   *
   * It is a guide, so it reacts to what the step is: keen where there is
   * something to press, level where it is only explaining, puzzled on the
   * one gesture nobody guesses. Every step carries one — a guide that
   * appears and disappears between steps reads as a bug, not a character.
   */
  mascot: MascotMood;
}

export interface Tour {
  id: TourId;
  /** How it is listed in Settings, and named in the "done" toast. */
  title: string;
  blurb: string;
  /**
   * The screen whose first visit starts it. `arrive(screen)` is what the
   * screens call; a tour with no trigger only ever runs from Settings.
   */
  startsOn?: string;
  steps: TutorialStep[];
}

/** Screens that announce themselves — see `arrive` in the context. */
export const TUTORIAL_SCREENS = {
  HOME: "home",
  SETLOG: "setlog",
  CREATE_POST: "create-post",
  CREATE_PRODUCT: "create-product",
  CREATE_MARKETPLACE: "create-marketplace",
  WORK_PROFILE: "work-profile",
  POST_DETAIL: "post-detail",
} as const;

/**
 * The plus, and the four things it makes.
 *
 * The one place the app says what it is for. Namzoed is a social app that
 * happens to have a shop in it, and a new seller who lists twelve products
 * before ever posting has an empty page nobody follows — so the Post step
 * says so plainly, once, where the choice is actually being made.
 */
const createTour: Tour = {
  id: "create",
  title: "The plus button",
  blurb: "What you can make, and which of it to make first",
  startsOn: TUTORIAL_SCREENS.HOME,
  steps: [
    {
      id: "plus",
      mascot: "excited",
      anchor: "create.plus",
      title: "Everything starts here",
      body: "The plus is the only way to make anything — a post, a product, a two-second log, a story. Give it a press.",
      advance: {
        on: "action",
        event: "create.menu-opened",
        hint: "Press the plus to go on",
      },
    },
    {
      id: "post-first",
      mascot: "normal",
      anchor: "create.post",
      title: "Post first, sell later",
      body: "Namzoed is somewhere people follow people. A page with posts on it sells; a page that is only a price list has nobody reading it. Post is the one to reach for most days.",
      advance: { on: "next" },
    },
    {
      id: "product",
      mascot: "normal",
      anchor: "create.product",
      title: "Product is for what you sell",
      body: "It goes to your shop with a price, a stock count and reviews. You can tag it into a post afterwards, which is how people actually find it.",
      advance: { on: "next" },
    },
    {
      id: "setlog",
      mascot: "superexcited",
      anchor: "create.setlog",
      title: "Setlog is your day",
      body: "Two seconds, on the hour, with the people in your log. Nothing is public and nothing is counted.",
      advance: { on: "next" },
    },
  ],
};

/** Making the post itself, in the composer, with the real fields. */
const postTour: Tour = {
  id: "post",
  title: "Making a post",
  blurb: "Pictures, caption, tags — and who sees it",
  startsOn: TUTORIAL_SCREENS.CREATE_POST,
  steps: [
    {
      id: "media",
      mascot: "excited",
      anchor: "post.media",
      title: "Start with the picture",
      body: "Pick one, or several. Whatever you choose here is what the feed shows — the words come after.",
      advance: {
        on: "action",
        event: "post.media-picked",
        hint: "Choose a picture to go on",
      },
    },
    {
      id: "caption",
      mascot: "normal",
      anchor: "post.caption",
      title: "Say something about it",
      body: "A caption is what makes it yours rather than a photo. #hashtags find it later, and @names reach people.",
      advance: { on: "next" },
    },
    {
      id: "tag",
      mascot: "superexcited",
      anchor: "post.tag",
      title: "Tag what's in it",
      body: "A product tagged here becomes a tappable price on your picture. This is the way to sell on Namzoed — a post people want to look at, with the thing in it attached.",
      advance: { on: "next" },
    },
    {
      id: "share",
      mascot: "superexcited",
      anchor: "post.share",
      title: "That's the whole thing",
      body: "Share puts it in the feed of everyone who follows you.",
      advance: { on: "next" },
    },
  ],
};

/** Setlog, which is a different app inside the app and reads like one. */
const setlogTour: Tour = {
  id: "setlog",
  title: "Setlog",
  blurb: "Two seconds an hour, with your people",
  startsOn: TUTORIAL_SCREENS.SETLOG,
  steps: [
    {
      id: "camera",
      mascot: "excited",
      anchor: "setlog.camera",
      title: "Two seconds is the whole idea",
      body: "Press the camera on the hour and record whatever is in front of you. No editing, no caption needed, nothing to get right.",
      advance: {
        on: "action",
        event: "setlog.camera-opened",
        hint: "Open the camera to go on",
      },
    },
    {
      id: "day",
      mascot: "normal",
      anchor: "setlog.day",
      title: "Any day, not just today",
      body: "The day at the top of your clips opens a calendar. Days you recorded carry the Namzoed mark, so you can see where to go back to.",
      advance: { on: "next" },
    },
    {
      id: "squad",
      mascot: "superexcited",
      anchor: "setlog.squad",
      title: "Squads are the good part",
      body: "A squad is up to 12 people recording the same hours. Join one with a friend's six-character code — a log of your own is quiet until somebody else is in it.",
      advance: { on: "next" },
    },
  ],
};

/**
 * The edge-drag drop target, which is the one thing in the app nobody
 * finds on their own: it is a gesture with no button anywhere.
 */
const contextDropTour: Tour = {
  id: "contextdrop",
  title: "Swipe back, and drop",
  blurb: "The gesture that messages a seller without leaving the post",
  startsOn: TUTORIAL_SCREENS.POST_DETAIL,
  steps: [
    {
      id: "drag",
      mascot: "confused",
      anchor: "contextdrop.surface",
      title: "Drag in from the left edge",
      body: "Start at the very edge of the screen and pull right. The post shrinks, and a dome rises from the bottom.",
      gesture: "swipe-right",
      advance: {
        on: "action",
        event: "contextdrop.revealed",
        hint: "Pull in from the left edge to go on",
      },
    },
    {
      id: "drop",
      mascot: "surprised",
      title: "Let go on the dome",
      body: "Release your finger over the dome and it opens a message to whoever posted it. Release anywhere else and you have simply gone back.",
      advance: { on: "next" },
    },
  ],
};

/** The work profile — a business page, not a shop page. */
const businessTour: Tour = {
  id: "business",
  title: "Setting up a business",
  blurb: "A work profile, and what verifying it unlocks",
  startsOn: TUTORIAL_SCREENS.WORK_PROFILE,
  steps: [
    {
      id: "identity",
      mascot: "normal",
      anchor: "business.identity",
      title: "This is your business, not your account",
      body: "A work profile sits beside your personal one — same login, different page. The logo, the name and what you do are what people meet first.",
      advance: { on: "next" },
    },
    {
      id: "details",
      mascot: "normal",
      anchor: "business.details",
      title: "Fill in how to reach you",
      body: "Hours, a work number, where you are. Each row is its own page and saves on its own, so you can stop halfway and come back.",
      advance: { on: "next" },
    },
    {
      id: "license",
      mascot: "excited",
      anchor: "business.license",
      title: "Verify to sell",
      body: "Upload your licence and a reviewer checks it. Until then you have a page; after, you have the Shopping catalogue and the seller badge.",
      advance: { on: "next" },
    },
  ],
};

/** Adding a product to the shop. */
const productTour: Tour = {
  id: "product",
  title: "Adding a product",
  blurb: "Pictures, price, stock — and tagging it into a post",
  startsOn: TUTORIAL_SCREENS.CREATE_PRODUCT,
  steps: [
    {
      id: "photos",
      mascot: "normal",
      anchor: "product.photos",
      title: "Photograph it properly",
      body: "The first picture is the one the grid shows. Daylight, plain background, the whole item in frame.",
      advance: { on: "next" },
    },
    {
      id: "price",
      mascot: "confused",
      anchor: "product.price",
      title: "Price and stock",
      body: "A price with a number people recognise, and an honest stock count — running out is fine, saying you have it when you don't is not.",
      advance: { on: "next" },
    },
    {
      id: "post-it",
      mascot: "superexcited",
      title: "Then post about it",
      body: "A product on its own sits in the catalogue. Tagged into a post, it turns up in the feed of everyone who follows you — which is where things actually sell.",
      advance: { on: "next" },
    },
  ],
};

/** The marketplace, which is second-hand and one-of-a-kind, not the shop. */
const marketplaceTour: Tour = {
  id: "marketplace",
  title: "Listing on the marketplace",
  blurb: "One-off things, and how it differs from the shop",
  startsOn: TUTORIAL_SCREENS.CREATE_MARKETPLACE,
  steps: [
    {
      id: "what",
      mascot: "normal",
      anchor: "marketplace.photos",
      title: "The marketplace is for one-off things",
      body: "A used phone, a sofa you're moving on, something you made once. The shop is for stock you keep; this is for the thing itself.",
      advance: { on: "next" },
    },
    {
      id: "condition",
      mascot: "confused",
      anchor: "marketplace.details",
      title: "Say what state it's in",
      body: "Condition, and where in the country it is. Buyers filter on both, so a listing missing them is a listing nobody sees.",
      advance: { on: "next" },
    },
    {
      id: "talk",
      mascot: "excited",
      title: "Then it's a conversation",
      body: "There is no cart here. People message you, and you agree between yourselves — the same chat you already use.",
      advance: { on: "next" },
    },
  ],
};

export const TOURS: Record<TourId, Tour> = {
  create: createTour,
  post: postTour,
  setlog: setlogTour,
  contextdrop: contextDropTour,
  business: businessTour,
  product: productTour,
  marketplace: marketplaceTour,
};

/** The order they are listed in Settings — roughly the order somebody
 *  meets them, not alphabetical. */
export const TOUR_ORDER: TourId[] = [
  "create",
  "post",
  "setlog",
  "product",
  "marketplace",
  "business",
  "contextdrop",
];

export const tourFor = (screen: string): Tour | undefined =>
  TOUR_ORDER.map((id) => TOURS[id]).find((t) => t.startsOn === screen);
