// Shared layout tokens used across the app.

// Standard corner radius for all modal/bottom-sheet shells (dialogs,
// action sheets, bottom sheets), paired with Apple's continuous corner
// smoothing via borderCurve: "continuous".
export const MODAL_RADIUS = 12;

// Switches. The track carries the brand blue when on, with a white thumb —
// the pale-blue track and navy thumb this replaced read as a disabled
// control rather than an active one, especially on iOS where the track is
// the whole affordance.
export const SWITCH_COLORS = {
  trackOn: "#094569",
  trackOff: "#E5E7EB",
  thumb: "#FFFFFF",
} as const;

// The filter/tab row that sits directly under TopNavbar on the four browsing
// tabs — Home, Shopping, Market and Services.
//
// It was four hand-written boxes and they had drifted: Market sat on 8pt of
// vertical padding against everyone else's 12, and Shopping and Services
// started their first label 34pt from the screen edge (a 16pt row inset plus
// an 18pt scroller inset that existed to clear the edge fade) against Home
// and Market's 16. Tab to tab, the row visibly moved. These are the numbers
// all four now use, so the next row added to a browsing tab has something to
// copy rather than something to guess.
//
// INSET is where the first label's text starts, measured from the screen
// edge — not the padding of any one box. A scrolling row pays for its edge
// fade by sitting flush and putting the whole inset inside the scroller;
// a fixed row simply pads its container.
export const FILTER_ROW_INSET = 16;
export const FILTER_ROW_VERTICAL = 12;
/** Between labels. Already what every row used — kept here so it stays that
 *  way (§ Tabs and pills). */
export const FILTER_ROW_GAP = 18;
