# Namzoed UI Standard

The design this app is being rebuilt to. Everything here is already shipping on
the Settings tree, the Edit Profile flow and the History screen — those are the
reference implementations, not proposals. **When building or restyling any
screen, match this file unless told otherwise.**

> **Every UI change gets recorded here, in the same change that makes it.**
> A new pattern gets a section; a changed value gets edited in place; a screen
> that migrates gets moved out of "Screens still to migrate". This isn't
> documentation written after the fact — it's the spec the next change is built
> against, so a change that isn't in it will be undone by the one that follows.

**The reference:** RedNote (Xiaohongshu). Not to copy pixel for pixel, but for
what it gets right and this app is moving toward: content fills the screen and
chrome gets out of the way; a two-column waterfall of real photos rather than
uniform rows; one restrained accent colour; line icons in a single weight; type
that separates by weight and size rather than by colour. `ContextDrop` was
already written against that reference — its header comment is worth reading.

**Reference implementations in this repo:**

| Pattern | File |
|---|---|
| Menu / settings chrome | `components/settings/SettingsChrome.tsx`, `components/modals/HamburgerMenu.tsx` |
| Form screen | `components/settings/EditBio.tsx` |
| Form in a modal | `components/modals/ReportUserModal.tsx` |
| Bottom sheet shell | `components/modals/BottomSheetModal.tsx` |
| Action sheet ("..." menu) | `app/(users)/profile/[id].tsx`, `components/ui/SheetAction.tsx` |
| Share sheet | `components/modals/ShareComposerModal.tsx` |
| Business profile | `app/(users)/profile/work.tsx` |
| Profile tab row | `components/profile/ProfileTabRow.tsx` |
| People list | `components/modals/FollowRequestsOverlay.tsx` |
| People list, as a section | `components/ui/PeopleGroup.tsx` |
| Conversation list | `app/(users)/(tabs)/messages.tsx`, `components/messages/ConversationRow.tsx` |
| Setlog | `components/setlog/SetlogFeed.tsx`, `components/setlog/SetlogDayGrid.tsx` |
| QR identity card | `components/qr/NamzoedQrCard.tsx` |
| Camera screen | `app/(users)/qr-scanner.tsx` |
| Screen preview (dev) | `components/dev/BusinessProfilePreview.tsx` |
| Reviews section | `components/ProductReviews.tsx` |
| Seller credibility block | `components/SellerCredibilityCard.tsx` |
| Hub screen | `components/settings/EditProfile.tsx`, `components/profile/EditWorkProfile.tsx` |
| Waterfall grid | `app/(users)/history.tsx`, `components/MasonryGrid.tsx` + `components/GridCard.tsx` |
| Pull-to-refresh | `components/ui/PullToRefresh.tsx` |
| Edge-swipe back / drop target | `components/ContextDrop.tsx` |
| Create menu ("+") | `components/create/LiquidCreateMenu.tsx` |
| "This looks like a listing" | `lib/sellingIntent.ts` |
| Price sanity check | `lib/priceSanity.ts` |
| Tagged product card | `components/post/TaggedProductsCard.tsx` |
| Chat details | `app/(users)/chat/details/[id].tsx` |
| Generated avatar | `lib/dicebear.ts`, `components/ui/GeneratedAvatar.tsx` |
| Services directory | `app/(users)/(tabs)/services/index.tsx` |
| Shared-thing card in a chat | `components/chat/ComposerContextCard.tsx` |
| Wait between a push and its screen | `utils/navHandoff.ts`, `components/ui/NavHandoffOverlay.tsx` |

---

## Foundations

### Grounds

Screens sit on grey; content sits on white. Never the inverse, and never a
white screen with grey cards.

| Ground | Where |
|---|---|
| `#f5f5f5` | Menu and settings surfaces (`SETTINGS_BACKGROUND`) |
| `#F9FAFB` | Form screens (`bg-gray-50`) |
| `#F0F1F3` | Anything hosting a grid (`GRID_BACKGROUND`, exported from `MasonryGrid`) |
| `#fff` | Cards, groups, fields, sheets |

A screen must paint its ground **everywhere the content doesn't reach** — behind
the status bar, between sections, and below the last item. A band of a different
shade where the content runs out is the most common way this gets broken. When a
screen is hosted inside a shared wrapper, that wrapper needs the same colour;
`app/(users)/settings/index.tsx`'s `SUB_PAGE_BACKGROUNDS` map is how a sub-page
declares its own — it feeds both the container behind the status bar and the
`SubPageLayer` that pays the bottom inset, so a wrong entry shows as a band at
*both* ends.

**That map lists every sub-page, white ones included, and `renderModalContent`
switches over `SubPageName = keyof typeof SUB_PAGE_BACKGROUNDS`.** It used to be
a partial map with `?? "#fff"` behind it, which is the failure this whole
section describes, made invisible: a screen built correctly on the settings grey
rendered between two white bands because nobody remembered a second file, and
the person who wrote the screen could not see anything wrong with it (Storage
was one). A default is the wrong shape for this — being on white has to be a
decision somebody wrote down, not what happens when you forget. A `case` for a
name with no entry now fails to compile. **Never reintroduce a fallback colour
here**; add the entry. The same map validates `?modal=`, so an unknown name in
the URL opens the settings list rather than a blank level with no way back.

### Corners

- `MODAL_RADIUS` (12, `constants/theme.ts`) — fields, sheets, modals, media tiles.
- **18** — settings/menu groups.
- **8** — inline media inside a row or card.
- **999** — pills and search fields.

**Always pair a radius with `borderCurve: "continuous"`.** A radius alone is a
bug, everywhere, no exceptions.

### Separators

`StyleSheet.hairlineWidth` in `#f0f0f0`, inset to where the row's text starts
(48 with an icon column, 16 without) — never a full-width `border-gray-200` rule.

### Icons

`lucide-react-native` only. `#111` at `strokeWidth={1.8}` in chrome; `#9CA3AF`
for secondary and inline icons; `#C7C7CC` for trailing chevrons. **One weight,
one colour per surface** — no per-item colour coding, which is what the old
settings list did and why it read as a toy.

**No emoji in native UI** — labels, badges, pills, buttons, headers, empty
states, alerts. Emoji belong only in user-authored text: chat messages and
comments.

The rule is absolute, and it reaches further than the obvious places:

- **Not in console output either.** It is not UI, but a codebase where half
  the logs open with a red cross and half don't is one more thing that is
  inconsistent for no reason.
- **Not in notification copy.** `"📷 Photo"` as a comment preview is a
  push notification, which is the operating system's chrome and the one place
  a stray character is least in your control.
- **An emoji that carries meaning becomes a lucide icon, not a deletion.** A
  package and a shopping bag for the two Mongoose roles, a moon on the night
  sale, a lock on a tier nobody has reached. The mongoose itself is the one
  that simply goes: § The mascot keeps it to teaching and waiting, so it has
  no business in a sheet header.
- **An emoji that only decorates simply goes.** "🔥 Flash Deals" is
  "Flash Deals"; a section title is already a section title.
- **Two exceptions, and they are the rule restated.** The chat reaction row
  is emoji by definition — replacing those with icons removes the feature
  rather than tidying it — and so is the GIF/sticker picker. Both are chat.
- **An emoji inside stored content is a data format, not a label.** A shared
  location was sent as `"📍 My Location: <url>"` and six places read it
  back out by matching that string, so every such message already in the
  database carries the pin. New messages are sent without it and the needle
  narrowed to `"My Location:"` — a substring of the old prefix, so history
  keeps working. Change what you emit; never change what you match, until
  nothing old can still match it.

### The mascot

The mongoose, in eight moods, through `components/ui/Mascot.tsx` — one
component and one map, because `require` needs a literal path and a map
copied across screens is how the same picture ends up at three sizes and two
spellings.

- **It belongs where the app is teaching or waiting**, and nowhere else:
  every tutorial card (§ Teaching the app), asleep on a Setlog day nobody has
  recorded, and on the two screens that are a promise rather than a place —
  Live and the Norbu Wallet. A mascot that turns up in the middle of a form,
  a checkout or an error is one people learn to resent.
- **A feature that is coming is not a feature that is broken.** "No live
  streams right now" and a grey icon in a circle read as an empty room;
  the mongoose ascending over *"Live is evolving into a higher being"* reads
  as a thing being built, which is the truth. The wallet gets the delighted
  one for the same reason: an unfinished feature is a promise, not an
  apology, and nothing about it should look sorry.
- **`super` is the one entry that is not a mood.** It is the mongoose
  ascended, reserved for a feature becoming something bigger — not a
  general-purpose "exciting" face, which is what `superexcited` is for.
- **The mood is the message.** Asleep on an empty day says *quiet day*,
  which is the truth — the alternative reading, that you have failed to keep
  a streak, is the one thing Setlog must never imply. Puzzled goes on the
  gesture nobody guesses; keen goes where there is something to press.
- **Always `contain` inside a square.** The art is not one aspect ratio —
  asleep it is wide, standing it is tall — so sizing by width alone makes
  the sleeping one twice the visual weight of the rest.
- **It is decorative, and marked so** (`accessibilityElementsHidden`): the
  words beside it always say the same thing, and "picture of a mongoose"
  announced between a title and its body is noise.

### Type

| Role | Size / weight |
|---|---|
| Screen title | 17 semibold `#111827` |
| Row label | 15.5 semibold `#111` |
| Row value / secondary | 15 `#9CA3AF` |
| Section label | 13 semibold `text-gray-500`, sentence case — never uppercase + letter-spacing |
| Caption / helper | 12–13 `text-gray-400` |
| Icon tile label | 13 medium `#111` |
| Form input | `text-xl` (20) |

Hierarchy comes from weight and size. Colour is not a hierarchy tool.

### Colour

`#0369A1` for actions, `#094569` for primary/brand, `#DC2626` for destructive.
One accent per screen, on the one thing the screen is for. Everything else is
black, grey, or white.

---

## Chrome

### Header

Three parts, on every screen: **`ChevronLeft`** (28, `#374151`) on the left, the
title absolutely centred against the row's full height, and **at most one text
action** on the right. No icon-button clusters, no full-width buttons at the
bottom of a screen — the primary action lives in the header.

Absolutely centre the title inside a `top:0,bottom:0,left:0,right:0` View with
`justifyContent`/`alignItems: "center"`; a bare absolutely-positioned `Text`
does not centre reliably against sibling buttons. Keep a spacer opposite the
chevron when there's no right action.

**A tab root whose tab row already names it has no header.** Messages is the
case: a centred "Messages" sitting directly above a tab reading "Messages"
is the same restatement § The conversation list rules out in a label, and it
cost 40pt of the list to say nothing. The tab row becomes the screen's
chrome and carries the top padding the header had. A screen one level in —
message requests, a log's day — keeps the full three-part header, because
there the title is the only thing naming where you are.

**One search per screen, and it is the bar's.** `TopNavbar` already draws a
search field on every screen without centre tabs, so a screen that needs a
search of its own points that field at it (`search={{ placeholder, onPress }}`)
rather than drawing a second field underneath — Services and a service
category each had one two rows below the other, asking the same question, and
the bar's won by position whichever was meant. A scoped field is plain: an
icon and a label naming what it covers, never the rotating trending
placeholder, which belongs to the one search that can return those trends.

**Scope is not a reason for a second field.** A services search that also
matches provider names, or a category search that only looks inside that
category, is a different *destination* — not a different control. Same
judgement § The business profile makes: the question on a shop front is "do
they have X", and it is still answered from the bar.

### Groups and rows

White block, radius 18, `overflow: "hidden"`, `marginBottom: 14`, on the grey.
Rows are `px-4 py-4`: optional icon column (32 wide), label, optional
description beneath, optional right-aligned value, then `ChevronRight` (18,
`#C7C7CC`) when the row navigates or a `Switch` when it toggles.

Use `SettingsChrome`'s `SettingsGroup` / `SettingsRow` / `SettingsSwitchRow`
rather than rebuilding rows. Icons belong on top-level index rows; screens one
level in are text-only.

### People lists

A list of people — followers, following, members, participants — is **one white
group on the grey**, not a card per person.
`components/modals/FollowRequestsOverlay.tsx` is the reference.

- The group's ends are rounded (18, `borderCurve: "continuous"`) and nothing in
  between is; every row but the first carries a hairline `#f0f0f0` inset to
  where the text starts (16 + avatar + 12 = 72 at a 44pt avatar). A bordered
  white card per person on a tinted ground is the pattern this replaced — it
  reads as a stack of unrelated things rather than one list.
- Row: 44pt circular avatar (`#E5E7EB` behind a photo, `#F5F5F5` with a
  `UserRound` 20/1.8 `#9CA3AF` without), name at 15.5 semibold `#111`,
  secondary line at 15 `#9CA3AF`, `px-4 py-3`.
- A follow/unfollow action is a `rounded-full` pill on the right: `#0369A1`
  filled with white text to act, `#F5F5F5` with `#111` when already following.
  A white or outlined button disappears against the white row.
- An unfollow marks the row rather than removing it — dimmed to 0.5, tap to
  undo. A row that vanishes under the finger that tapped it gives no way back.
- **A badge that restates the list is not a badge.** "Follows you" on your own
  Followers tab says exactly what the tab says; it stays only where it still
  carries information — on Following (this is mutual), and on someone else's
  Followers list (this person follows *you*, not the profile you're browsing).
  The condition is the list's owner, not the tab alone.

### Tabs and pills

Tabs are **plain text**, not chips: a short 24x2 underline under the active
one, never a full-width rule. 24 is `ProfileTabRow`'s `w-6`, and it is the
number any hand-rolled tab row copies — at 6 the mark reads as a dot beside
the word rather than a rule under it. Profile tabs come from
`components/profile/ProfileTabRow.tsx` — the personal profile and the work
profile use the same component, not two copies. Two hand-maintained tab rows
drift (one gets an edge fade, the other doesn't; one scrolls the active tab
into view, the other leaves it half-clipped), and the drift is invisible
until someone compares the screens side by side.

It owns its own scroll-into-view, and its measurements live in refs rather
than state — they're read only inside the imperative `scrollTo`, so putting
them in state would re-render the row on every frame of a scroll for nothing.

**A category row with more than a screenful is one component**,
`components/ui/CategoryFilterRow.tsx` — the horizontal scroll of plain-text
filters, the edge fades at both ends, and a chevron that opens all of them.
Shopping and Services both use it. It lived inside Shopping as ~150 lines of
measuring and animation until Services needed the same thing, which is
exactly the drift this section warns about a paragraph above.

**The full list drops out of the row itself**, anchored to where the row
actually is (measured on open — it scrolls with the content, so a fixed
offset lands somewhere the row is not) and full-width, so its own panel
covers the chevron that opened it and the way back up is its chevron-up or
the scrim below. A bottom sheet was tried here and is wrong: this list *is*
the row's own contents, and pulling it up from the opposite edge of the
screen severs it from the thing it belongs to.

**It takes the height it needs — and if that is everything below the row, it
takes everything below the row.** The old version was a flat 260pt: too tall
for a short list, a scroll-inside-a-scroll for a long one, and in both cases
ending in the middle of nowhere. The height is arithmetic (rows × cell,
plus header and any links section), capped at the space available, and the
bottom corners square off when it reaches the screen's edge — a rounded
corner floating over nothing reads as a panel that stopped short.

**It borrows the sheet grammar without being a sheet**: the `Check` on the
live one, `MODAL_RADIUS` corners, a 13 semibold sentence-case section label
(§ Sheets, § Type).

**It must be a `<Modal>`**, because the row lives inside each tab's scroller:
an in-tree overlay positioned by window coordinates lands relative to the
scroll *content* and disappears into the scrollable distance, which is
exactly the bug that made the chevron look dead. `statusBarTranslucent`
keeps the modal's coordinates the same as the window's.

**Two across, at a fixed 48%.** A wrapped run of chips leaves a ragged right
edge and a different number of items per row depending on how long the words
happen to be; a fixed two-column grid gives every category the same target
and the same left edge to read down. The long names are the reason — "Medical,
Legal and Financial Services" truncates at three across, and a directory
whose labels are cut in half is not a directory.

**Destinations in a filter row go in the drawer, under their own heading.**
Services' ground and room bookings are booked by the slot rather than by
contacting somebody, so tapping one *leaves* the screen instead of narrowing
it. That is a reason to label them, not to exile them: they were a separate
white block above the grid, which answered "why is this here" with silence.
In the drawer under "Book by the slot" they are where somebody looks for
what kinds of thing exist, and still visibly not filters.

Elsewhere, a plain tab row is active `text-[17px] font-mbold text-gray-900`,
inactive `text-[15px] font-medium text-gray-400`, in a horizontal scroller
with an 18pt gap. Pills (metadata, tags) are `rounded-full`,
`px-2.5 py-1`, translucent over media or `bg-white` on grey.

**The row under `TopNavbar` is the same box on all four browsing tabs** —
Home, Shopping, Market and Services — and the numbers live in
`constants/theme.ts` as `FILTER_ROW_INSET` (16), `FILTER_ROW_VERTICAL` (12)
and `FILTER_ROW_GAP` (18), not in four hand-written style blocks. They had
drifted exactly the way this section keeps warning about, and this one shows
in ordinary use rather than only in a side-by-side: switching tabs moved the
row. Market sat on 8pt of vertical padding against everyone else's 12, and
Shopping and Services started their first label 34pt from the screen edge
— a 16pt container inset plus an 18pt scroller inset — against Home's and
Market's 16.

**`FILTER_ROW_INSET` is where the first label's text starts, measured from
the screen edge**, not the padding of any one box — which is the distinction
that let the drift happen. A fixed row simply pads its container. A scrolling
row cannot: it has to sit flush so its edge fade reaches the screen's edge,
so it carries the whole inset inside `contentContainerStyle` instead, and the
fade is exactly one inset wide so that clearing it lands the first label back
on the shared left edge. Padding both the container and the scroller adds
them together, which is what 34 was.

The rows are still allowed to differ in what they *do* — Shopping and
Services scroll and carry the chevron that opens the full list, Home and
Market have few enough tabs to sit fixed. It is the box they agree on.

### Controls

**Switches** carry the brand blue when on, with a white thumb —
`SWITCH_COLORS` in `constants/theme.ts`:

```
trackOn: "#094569"   trackOff: "#E5E7EB"   thumb: "#FFFFFF"
```

Set `ios_backgroundColor` to `trackOff` as well, so the off state is a clean
grey instead of the system default showing through mid-animation. The pale
track this replaced (`#94c9e8` with a navy thumb) read as a disabled control —
on iOS the track *is* the affordance, so it carries the accent, not the thumb.

The exception is a switch whose colour carries meaning of its own: green for
availability (`EditWorkProfile`, `ServiceProviderSection`), amber for a closing
sale (`EditProductModal`), orange for live tracking (`LocationTrackingControl`).
Those stay as they are — the colour is the signal.

### Sheets

Choices open `BottomSheetModal`, never an inline `<Picker>` — the native picker
cannot be made to match on both platforms (squat wheel on iOS, spinner dialog on
Android). Options are `text-xl` rows with a `Check` (`#0369A1`) on the selected
one.

**Every bottom-anchored modal needs `statusBarTranslucent` *and*
`navigationBarTranslucent`.** Without them the modal's window is inset by
Android's system bars, so a strip of the screen shows below the sheet and it
reads as floating rather than sitting on the edge. The sheet's own
`paddingBottom` (at least `insets.bottom + 16`) is what keeps content clear of
the gesture bar — never the window inset. The same applies to a full-screen
modal whose ground has to reach both edges.

**Anchor a sheet with `position: "absolute"` on the sheet itself** — `left`,
`right` and `bottom` at 0 — inside a `flex-1` root. Its `maxHeight` is a
percentage, and a percentage only resolves against an ancestor with a definite
height: put the sheet in normal flow, or inside an absolutely positioned
*wrapper* (auto-height too), and the cap resolves against nothing. The sheet
then both truncates its own content and stops short of the bottom edge.

For the same reason, don't reach for `KeyboardAvoidingView` in a sheet — inside
an absolutely positioned box it measures its frame against the screen and
settles wrong. `BottomSheetModal`'s `avoidKeyboard` tracks the keyboard through
`Keyboard` events and moves the sheet's `bottom` instead.

Every sheet's shell is `BottomSheetModal` — handle, backdrop that fades
independently of the slide, and drag-to-dismiss. The drag lives on the handle
alone, never the whole sheet: a pan responder over the body wins every
vertical drag that belonged to a list scrolling inside it. Two optional props
matter — `avoidKeyboard` for a sheet with a text field, and `overlay` for a
`PopupMessage`, which is a plain absolute overlay and would otherwise be
clipped to the sheet's own bounds. Don't hand-roll a second shell.

An **action** sheet (a "..." menu) is not a list of rows with descriptions —
it's rows of round tiles, label underneath. `components/ui/SheetAction.tsx` is
the tile; the public profile's more menu is the reference use:

- 40x4 `#D1D5DB` grab handle at the top, from `BottomSheetModal`.
- Tiles are a 56pt `#F5F5F5` circle holding one lucide icon (22,
  `strokeWidth={1.8}`), with a 13 medium `#111` label 8pt below. Fixed 64pt
  tile width and a 20pt gap so labels centre under their circles.
- **One icon colour for the whole sheet.** Severity is carried by the
  confirmation that follows, not by a red or amber icon — per-item colour
  coding is what the Icons rule above rules out.
- Actions group by kind, one row each, separated by the standard hairline
  inset to where the tiles start. Sharing first, safety actions (Report,
  Block) last. A 13 semibold `text-gray-500` section label sits above the
  first row; a self-evident group doesn't need one.
- Tiles are left-aligned, never spread with `justify-between` — a row of two
  should not stretch to the sheet's full width.
- Ends with a `Cancel` block: `mx-4 mt-6 py-3.5`, `#F5F5F5`, `MODAL_RADIUS`,
  centred 15.5 semibold `#111`. The sheet's own bottom padding clears the
  home indicator (`Math.max(insets.bottom, 16) + 12`).
- Every tile opens something else, so each one closes the sheet and
  `await waitForIosModalDismiss()` before presenting it — including native
  `Alert`s and the OS share sheet (`Share.share` presents a view controller
  of its own), both just as easily lost into a dismissal as a modal is.

The **share sheet** (`ShareComposerModal`, used by profile, post, reel and
product alike) is the same sheet doing two jobs, separated by the standard
hairline:

- **Send to** — the people you follow as one horizontally-scrolling row of
  52pt avatars with a `#094569` check badge on the selected ones. Not a
  wrapped grid with its own vertical scroll inside a scrolling sheet. Search
  above it is a 999-radius `#F5F5F5` pill.
- The note field and **Send** appear only once somebody is selected — there is
  nothing to write on or press before that. Send is a text action in the
  header's two blues, not a coloured pill.
- **Share to** — `SheetAction` tiles, and only for targets that genuinely deep
  link. A tile that just opens the OS share sheet under a brand's name is a
  worse version of "More", which does it honestly and lists everything the
  user actually has installed.

### Dialogs

A dialog is not a sheet. A sheet offers choices and can be dragged away; a
dialog asks one question in the middle of the screen and waits. Everything
that asks one — a result message, a confirmation, "add your phone number",
"confirm your age" — is `components/ui/DialogCard.tsx`, and nothing hand-rolls
a second one.

- **A white card on a scrim.** The same white as groups, sheets and fields
  (§ Grounds), radius 18 with the continuous curve (§ Corners), scrim
  `rgba(0,0,0,0.35)`. Depth comes from a shadow, because the card is above the
  screen; it never comes from a border.
- **No glass.** No `BlurView`, no sheen gradient, no four-sided fake bevel
  with a lighter top edge and a darker bottom. Blur belongs to chrome that
  floats over live content — the tab bar, the camera's menus — where seeing
  through it is the point. A dialog sits over a still screen and asks a
  question; frosting it only makes the question harder to read.
- **Left-aligned copy.** 17/700 `#111827` title, 15/21 `#6B7280` message.
  Centred text is a poster; this is a sentence somebody has to read and act
  on.
- **An optional 44pt `#F5F5F5` icon tile** above the title, holding one lucide
  icon at 22. Optional because plenty of questions need no picture.
- **One filled action, at most** (§ People lists). The quiet one is `#F5F5F5`
  with `#6B7280` text — not an outlined pill, and never a second filled
  button, which is two things both claiming to be the answer. One action fills
  the width; two sit side by side with the filled one on the right, where a
  thumb lands; three or more stack, because three pills in a row are three
  labels nobody can read.
- **Colour only where colour is the message.** `PopupMessage`'s error is red
  and its warning amber because the hue *is* the information — the same
  licence the availability switches take. Success and the plain kind take the
  brand: "it worked" does not need a colour to be understood.
- **Omit `onDismiss` when the question has to be answered.** With it, tapping
  the scrim closes the dialog; without it, the buttons are the only way out.
  Skipping the age prompt has a consequence, so it is a button somebody
  presses, not something that happens by tapping past.
- **The card holds a field when it needs one** (`children`, between message
  and actions), and the shell lifts itself over the keyboard. A field inside
  a dialog takes the grey `#F5F5F5` rather than white, because on a white card
  the grey is the one that reads as the lighter, separate surface — which is
  what § Form screens is actually about.
- **It is an absolute overlay, not a native `<Modal>`.** So it composes inside
  a sheet or a full-screen modal without the nested-window problems § Sheets
  describes, and a bottom sheet showing one passes `overlay` so it isn't
  clipped.

- **Nesting.** Because it is an overlay, it needs a full-screen box to sit
  in. Inside a screen or a full-screen modal it works bare; inside a
  fixed-height parent (`TopNavbar`) it must be wrapped in a transparent
  native `<Modal>` with `statusBarTranslucent` and `navigationBarTranslucent`,
  or it is confined to the bar. `AuthPromptModal` carries both, switched by
  an `embedded` prop, because it is opened from both.

Two worked examples. `AuthPromptModal`, the guest gate, was a card with three
stacked pills — a filled "Log In", a grey "Create Account", and a grey text
"Not now" — which is three answers to a two-answer question, the third of them
restating what tapping the scrim already does. It is now two actions and a
scrim.

`DeleteConfirmationModal` was a bottom sheet: a bordered header with a red
icon beside a 20pt title, an italic quote of the post, a full-width red button
with a `Trash2` inside it, and a "Cancel" under a hairline. **A sheet slides up
from the edge because it offers a list you can drag away; a question that has
two answers and waits for one is a dialog**, whatever it is asking. It is now
`Cancel` / `Delete`, the red carried once by the destructive action and its
icon, and the quoted post in `children`.

Two things stay outside all this. A native `Alert` is for destructive
confirmations only (§ Feedback and motion), and an action sheet's "..." menu
is a sheet (§ Sheets) because it offers a list, not a question.

---

---

## Content

### Safe View is the whole app, not the feed

`lib/safeContent.ts` decides; `hooks/useViewableContent.ts` assembles the
reader; `components/ui/RestrictedContentGate.tsx` is what a blocked detail
screen shows.

- **It applies to everything the app displays**, not to posts. Safe View, an
  unverified age and being under 18 were enforced in the two feed hooks and
  nowhere else — so a reader protected in the feed could reach the same
  picture through Shopping, the Marketplace, Services, search or a shared
  link, none of which asked. That is not a gap in a feature; it is the
  feature not existing outside one screen.
- **One rule, one function.** `canView(row, viewer)` takes any row carrying
  `content_rating` / `moderation_status`, and every list and every detail
  screen goes through it. A call site comparing ratings by hand is a call
  site that gets missed the next time the rules change.
- **Two questions, both of which must pass.** Has moderation cleared it, and
  does the audience rating allow *this* reader. They are separate: something
  pulled for review is hidden from everyone regardless of Safe View, and an
  approved 18+ listing is still hidden from a minor.
- **Your own listing never disappears on you.** Whatever its rating, the
  owner sees it — otherwise there is no way to reach it and take it down,
  which is the one thing somebody must always be able to do with what they
  posted.
- **Lists filter; detail screens gate.** A list can leave an item out, but a
  link, a share, a search result or a notification lands somebody *on* a
  screen — so the gate is in `ProductDetailContent`, `ServiceDetailContent`
  and `MarketplaceDetailContent` themselves, which covers the route, the
  grow-from-a-tile overlay and the peek sheet in one place each.
- **The gate never says what it is hiding.** "Hidden by Safe View" is the
  whole message, plus the one control that changes it — describing what is
  behind it would defeat the point.
- **Counts are taken after the gate**, or a tab promises results it will not
  show.
- **Every table that holds uploaded pictures carries the same four ratings**
  (`add_content_rating_everywhere.sql`): products, marketplace and
  provider_services now have `content_rating` and `moderation_status` in the
  same vocabulary `posts` uses, so one rule can read any of them. Rows
  written before the column default to `general` — the status quo, not a
  sudden blackout — and the honest limit is worth stating: **the gate is only
  as good as what is written into those columns**, and nothing scans a
  product photograph yet the way `CreatePost` scans a post's.



### The Following tab

`components/home/FollowedCreatorRow.tsx` over the grid,
`hooks/useFollowedCreators.ts` behind both it and the Explore header's face.

- **A row of faces above the posts, and everybody is shown by default.** The
  tab was one mixed wall with no way to say "just this person" and no sign of
  who had been busy. A face is how anybody thinks about that — you go looking
  for a person, not for a post — so the filter is the person. It narrows a
  feed that already works; it is never a gate in front of it.
- **"All" is a face too, and it leads.** A text chip beside a row of avatars
  reads as a different kind of control from the things it sits with; at the
  same size, first in the same row, it is plainly one of the choices.
- **On Explore, the Following tab is a face only while it has news.** If
  somebody you follow has posted something you have not opened, the tab is
  their picture with the red dot; the moment you are caught up it is the
  word "Following" again (`components/ui/HomeSectionTabs.tsx`). It used to
  wear a face the entire time you were on Explore, dot or not, which spent
  the loudest element in the header on "the Following tab still exists" — **a
  picture that is always there is furniture**, and by the time it has
  something to say nobody is looking at it. The face has to be able to be
  absent for its presence to mean anything.
- **The face and the dot are the same person.** The avatar is the most
  recent creator *with something unseen* (`latest` in
  `hooks/useFollowedCreators.ts`), not the most recent creator outright.
  Taking whoever posted last regardless could show a face you had already
  caught up with and hang somebody else's dot on it — the picture saying one
  person and the badge meaning another. It also means the face is null
  exactly when there is no news, which is what turns the tab back into a
  word. Following is always the word while it is the active tab, where the
  row of faces below does this properly.
- **The ring is selection, the dot is news**, and they never share a colour —
  brand blue for "this is what you are looking at", the app's red for "this
  person has posted". One avatar can carry both without either being
  ambiguous.
- **Ordered by who posted most recently**, not by who was followed first:
  the row is about what is new. People who have never posted fall to the end
  rather than out — they are still followed.
- **"Seen" is local, per creator, and cleared by *opening* them.** It is a
  mark about this reader on this phone; a table on the server would grow by a
  row per follow per person for something nobody else can ever see. Scrolling
  past one of their posts in the mixed feed does not clear it — that is a
  glance, not catching up — so the dot keeps meaning "there is something here
  you have not gone and looked at", which is the only reading that survives a
  busy day.
- **Filtering reads the pool already loaded.** The Following feed is one
  chronological stream, so the newest of any one person is near the top of
  it by definition — the answer is instant instead of a round trip away, and
  a quiet creator fills in as the feed pages. The empty case says so rather
  than pretending they have nothing.
- **On Explore, the Following tab is a face rather than a word** — whoever
  you follow posted most recently, with a red dot when something is
  unopened. A word cannot say "there is something new from somebody you
  follow", and that is the only reason anybody leaves Explore. It goes back
  to being the word on the Following tab itself, where the row below is
  already doing that job and a second face would be the same information
  twice.



### The waterfall

Browsing surfaces are a **two-column masonry waterfall** — `MasonryGrid` +
`GridCard`, 4pt gutters, cards sized by **real media aspect ratio** so column
heights vary. Uniform rows and fixed-height tiles are what this app is moving
away from; if you're about to write a `FlatList` of full-width rows for
browsable content, use the grid instead.

Cards: image (or the video's poster frame), up to three lines of title, then a
footer row — 20pt round avatar, author name, and trailing meta (price, count) on
the right. Screens hosting a grid paint `GRID_BACKGROUND`.

**A tile never downloads the original.** Grid media goes through
`components/ui/GridThumbnail.tsx`, and nowhere else decides what a tile
fetches. A photo is requested at the tile's width (`toSizedImageUrl` in
`lib/imagePreview.ts` — fixed width steps so one download serves every grid,
density capped at 2x, 1.5x on data saver). A video shows the poster `uploadVideo` stores beside
it, never a mounted player. A phone photo is megabytes, the same photo at tile
size is tens of kilobytes, and most people using this app pay for every one of
them on mobile data. If the resized copy fails the original loads, and a video
posted before posters existed shows its paused first frame until
`scripts/backfill-video-posters.mjs` has run for it. The detail hero draws the
same `GridThumbnail` at the tapped rect's width, so the morph starts from the
bitmap already in memory rather than a fresh download.

**No upload is the camera original.** Every image through
`uploadFileToSupabase` is resized on the phone first (`lib/imageUpload.ts`):
`photo` 1440px long edge for posts, listings, services, chat, comments,
reviews and covers; `fullscreen` 1920px for stories; `avatar` 1080px;
`document` 2048px for licences. Never upscaled, PNGs stay PNG, and a failed
resize uploads the original rather than losing the post. A new upload path
picks a preset — it does not get to skip this.

**A post is sized by its own media; a product or a listing is sized by one
shared frame.** A post carries a real ratio (`media_display`) because the
photo *is* the post. Nothing stores the shape of a product photo, so those
cards have to pick a frame, and it has to be the same frame everywhere:
`LISTING_CARD_RATIO` in `components/GridCard.tsx`, square. The Shopping tab
drew products square while Marketplace drew listings at 4:3 — two grids one
tab apart, showing the same kind of thing, changing the same photo's shape as
you moved between them — and Saved items and History, which mix both in one
waterfall, showed the drift in a single screenful. Square also crops a
portrait photo far less brutally than 4:3, and sits between a post's portrait
and landscape framings so a mixed grid reads evenly.

Group by day (Today / Yesterday / N days ago / date) with a small bold label
where a feed has time structure, and run **one grid per group** so the waterfall
balances within a day instead of dragging cards across a date break.

### Hashtags

Hashtags in post text are tappable, rendered by `components/ui/HashtagText.tsx`
in the action blue (`#0369A1`, or a lighter `#7DD3FC` where the caption sits on
video). Tapping one opens the Search screen already searching that term. The
component returns a fragment of `<Text>` runs, so it must be used **inside** a
parent `<Text>` — that keeps a hashtag inline mid-sentence and inherits the
caption's own font and line height.

### Grid to detail

Tapping a grid card **morphs** it into the detail view rather than navigating
to it — `components/PostDetailOverlay.tsx` is the reference. `GridCard`
already measures itself on press and hands its on-screen rect to `onPress(id,
rect)`; that rect is the transition's whole input.

- **One driver, derived crossfades.** A single `heroProgress` runs 0→1 on
  open and back down on close; the hero's fade-out and the content's fade-in
  are `interpolate`d from it, not chained behind it with callbacks. Overlap
  the ranges (content in from 55%, hero out by 92%) so the swap lands while
  the motion is still going. A crossfade queued *after* the grow reads as two
  separate events, and running the driver backwards gives you the close for
  free.
- **~300ms, `Easing.out(Easing.cubic)`.** A hero transition is read as direct
  manipulation — the thing you touched, moving — so it arrives and settles
  rather than gliding.
- **Never distort the photo.** Split the transform across two layers: the
  outer wrapper takes the non-uniform scale and, with `overflow: hidden`, is
  the clip window; an inner layer divides that back out and applies one
  uniform scale. What changes during the morph is how much of the image you
  see, never its shape.
- **Transforms only** — never animate an `Image`'s real width/height. Its
  native view redoes its crop on every layout change and drops frames to
  black at animation rates.
- Keep an **opaque backing** pinned behind the swap for its duration: both
  image layers are mid-fade there, and the arriving one may not have uploaded
  a texture yet.
- **A gesture dismiss hands over from where the finger left the content**, not
  from the middle of the screen. `ContextDrop` leaves the content translated
  (and inset by its own shrink) at the moment it commits, so the hero and its
  backing add that same offset, eased away by a settle multiplier over the
  shrink. Without it the hero fades in at its untransformed position and the
  close jumps sideways before it moves — invisible on the back-button path,
  because there is no drag there. Settle a *multiplier*, never `dragX` itself:
  that value is still feeding the backdrop's own reveal.
- **A grid that already holds the post opens the overlay, never `/post/[id]`.**
  `hooks/usePostDetailMorph.ts` is the wiring — three lines per screen — and
  `lib/postData.ts` the one row-to-`PostData` conversion. Pushing the route
  instead means a fade over a spinner while it refetches a post the screen was
  already holding. `/post/[id]` stays for entry points that genuinely have
  only an id: notifications, chat, deep links, search and History.

### Hold to peek a profile

Press and hold an avatar and it expands into that person's profile —
`components/profile/ProfilePreviewTrigger.tsx` wrapped around the avatar
markup, with `ProfilePreviewCard` as the UI it opens into.

- **The avatar IS the island.** The expanded UI is mounted inside the trigger
  from the first frame and clipped away by the avatar's own bounds; holding it
  grows those bounds until the UI is no longer clipped. Nothing is rendered
  over anything, nothing appears on press, and the children stay the real
  avatar throughout — translated and scaled into the card's slot, never
  swapped for a copy drawn elsewhere. An overlay that mounts a duplicate
  avatar on press is a popover, and reads as one.
- **Wrap the avatar, not the row.** The wrapped element is what expands.
- **Two beats, overlapping: width, then height.** The circle stretches
  sideways into a pill with the avatar pinned exactly where the finger is —
  only the container's edges move — and then the pill opens downward into the
  card while the avatar rides down onto the cover's lower edge. Inflating both
  at once reads as a box growing, not an island expanding. The corner radius
  tracks the *height*, so it stays a true pill while the height is still the
  avatar's.
- A placeholder holds the avatar's slot in the row so the island can grow out
  of flow without pushing its neighbours around — sized from the **avatar's**
  measured size, never from itself: the shell inside it is absolutely
  positioned and contributes nothing, so measuring the placeholder collapses
  it to zero and the row loses the avatar's space entirely.
- **At rest the island must be indistinguishable from the bare avatar.** Clip,
  paint a ground and out-stack the row only while it's open: a permanent clip
  cuts off anything the avatar draws outside its own box (a LIVE badge, a
  story ring), and a permanent white ground shows through a transparent
  avatar. Keep those on React state that survives the closing animation, not
  on the animated progress.
- **The ring is an overlay, never a border on the avatar's own box.** A
  border on a sized box insets the content box, so fixed-size children get
  laid out from the border inward and sit low and right of their own rounded
  edge. An absolutely-positioned ring can't displace what it rings. Divide its
  width by the avatar's scale — a border is drawn in local coordinates and
  scaled with everything else.
- **Every elevation here is static — never toggled when the preview opens.**
  Changing `zIndex` reorders native subviews, and reordering a subtree cancels
  every touch inside it, including the hold that opened the preview: it
  cancels itself, morphing open and snapping straight back. The island is
  collapsed and overlaps nothing at rest, so being permanently above its
  siblings costs nothing. `useProfilePreviewElevation` on a row that has
  overlapping siblings (a Follow pill, header buttons); it's a constant.
- **Inside a list, open upward.** Rows are siblings painted in order, so a
  card growing down out of row N is covered by row N+1 no matter what a
  same-valued `zIndex` says, while one growing up covers rows painted before
  it. The trigger prefers up and falls back to down only when there isn't
  room.
- Take **one** layout measurement and pin the box to it. The ring the open
  state adds grows an auto-sized view, which would re-report a larger natural
  size mid-morph and feed the animation back into itself.
- **Hold opens it; it stays.** Lifting your finger leaves the card up, and the
  next tap anywhere dismisses it — caught by a transparent full-screen
  `Pressable` the provider renders while something is open, since an avatar
  buried in a comment row has no way to hear about a tap elsewhere. That
  catcher is deliberately not dimmed: the card is embedded in its own row,
  which sits *below* it, so a scrim would fall over the card too. It also
  swallows the dismissing tap, which is right — the first tap after a preview
  should put it away, not also open whatever it landed on. Android back
  dismisses too.
- It carries no buttons — no top bar, no Follow/Message row. Anything you'd
  want to press belongs on the profile the avatar's own tap already opens.
- **Layout is the profile screen's own header**: the per-user cover from
  `useCoverPalette` running behind the *whole* block rather than in a strip,
  the identity column
  — name, NamZoed ID, location — to the **right** of the avatar, counts
  beneath both, and the Work card when they have one. White type throughout,
  as there. A peek that doesn't look like the profile it previews isn't a
  preview.
- The cover is its **own layer**, revealed with the shape rather than with the
  type, so the pill is already the person's colour while it is still
  stretching. It still fades (early, ~14%) rather than simply existing: at
  rest the shell doesn't clip, so an opaque card-sized layer would spill
  across the row.
- **A cover photo goes *between* the gradients, never instead of them.** Four
  layers, as on the profile screen: the cover gradient always at the bottom;
  the photo; a neutral grey (`rgba(17,24,39,0.32)`), because a coloured tint
  alone can't keep white type legible over a pale photo; then the same hue's
  tint ramp on top, which is what stops the photo washing the person's colour
  out. Painting the photo straight over the gradient loses the identity
  colour entirely for anyone who has one.
- The gesture is `Gesture.Pan().activateAfterLongPress()`, never
  `Gesture.LongPress`: a Pan keeps following the finger, so a thumb resting on
  an avatar drifts without cancelling the peek. Taps pass through to whatever
  the avatar already did.
- **Keep the gesture object stable — route its callbacks through refs.**
  `GestureDetector` cancels whatever is in flight when its handler is swapped,
  and here every input to those callbacks changes at exactly the wrong moment:
  opening publishes to the context, the context hands back a new value, the
  callback identity changes, the gesture rebuilds, and the hold that just
  opened the card is cancelled — the peek cancelling itself the instant it
  appears. A `useMemo` over the callbacks looks correct and is the bug.
- **Known cost of embedding**: expanding in place means ancestors still clip.
  An avatar near the edge of a scrolling list will have its card clipped
  there. The trigger picks whichever direction has more room, which covers the
  common cases; it cannot escape a clip entirely, because RN has no portal for
  native views. That is the deliberate trade for the card genuinely being the
  avatar rather than a copy floating above it.

### Adding a friend by QR

Every profile carries a code, and scanning one is how two people who are
standing together follow each other. `app/(users)/add-friends.tsx` (the
code, reached from "+ Add Friends" in the drawer) and
`app/(users)/qr-scanner.tsx` (the camera, reached from the profile's top
bar and from **Scan** in the drawer's bottom action row) are the two ends of
it.

- **Drawer cards group by errand, not one row per card.** The hamburger
  drawer (`components/modals/HamburgerMenu.tsx`) renders `MENU_GROUPS` as
  white 18pt cards, rows inside a card separated by a hairline. Norbu Wallet
  sits with Mongoose delivery (spending) and Manage Listings with Business
  (selling), because a column of single-row cards is just a list wearing
  extra chrome — the card boundary stops meaning anything when every item
  gets its own. A new entry joins the card whose errand it shares, and only
  earns a card of its own when it shares one with nothing else.
- **The camera has two doors and one screen.** The profile's top-bar
  `ScanLine` button and **Scan** in the hamburger drawer's bottom row (beside
  Help center and Settings, same 52pt circle) both `router.push` plain
  `/qr-scanner`. Scanning is a thing you do standing next to somebody with
  their code out, and making that trip start on your own profile is a
  detour — the drawer is already reachable from wherever you are. Two entry
  points are only worth it because they land on the identical screen with no
  mode flag between them; a "scan" that behaved differently depending on
  which button opened it would be two features wearing one name.
- **A scan is never a follow.** The camera fires the moment a code crosses
  the frame, including one you only happened to point at, so the write sits
  behind a tap on a sheet that shows you whose face you are about to be
  connected to. Both people confirm — the scanner in `ScanConfirmSheet`, the
  scanned person on Add Friends — and the **database writes both follow rows
  together** at the second confirmation
  (`accept_qr_connect_request`). Following the scanned person at step one is
  the obvious shortcut and it turns a glance at a code into a unilateral
  follow with nothing to undo it.
- **The `NamZoed ID:` line on your own profile is the door to your code.**
  It carries a `QrCode` glyph, so the tap opens `/add-friends` — the screen
  that draws the code — not the OS share sheet it used to fire. An icon that
  names one thing and does another is the worst kind of affordance: people
  learn the row is unreliable and stop pressing it. Sharing the link is still
  the arrow in the header beside it, and Add Friends carries its own Share
  button, so nothing was lost by giving the glyph what it advertises.
- **The code carries the NamZoed ID, not the UUID.** That id is already
  printed under the person's name on their own profile, so the code
  discloses nothing that isn't on screen anyway — and it keeps the payload
  at QR version 2 (25×25, 8pt modules at 200pt), which is what makes it read
  quickly across a table. `lib/qrPayload.ts` is the only place that knows
  the format, deliberately import-free so a presentational card can use it
  without pulling the data layer in behind it.
- **A code wears its owner's cover identity** — the `useCoverPalette`
  gradient behind the whole card, white type over it, the same
  `NamZoed ID:` line the profile shows. A code with your colour and your
  face on it is recognisable across a table, which is the entire moment this
  screen exists for.
- **The code itself sits on a white tile inside that card, never on the
  gradient.** A scanner needs the quiet zone and dark-on-light contrast; a
  QR painted onto a mid-tone reads slowly or not at all in poor light. The
  tile's own padding is the quiet zone — asking the library for a second one
  just shrinks the modules. The ink is `#094569`, dark enough to scan as
  black, and it is the screen's one accent, on the one thing the screen is
  for.
- **A profile with no id yet renders as absent, not as a broken code.** The
  slot says the code is still being set up rather than drawing an
  unscannable placeholder — same rule as an unmeasured metric.
- **Everything asking to be let into your network is on this one screen.**
  Following back a stranger who followed you and confirming a code you
  scanned are the same decision, and they used to be two screens. Three
  sections, in the order they arrived: **Follow requests** (followers you
  don't follow back — what `components/modals/FollowRequests.tsx` opened
  from the drawer), then **Waiting for you**, then **Waiting for them**.
- **All three are the same list**, built on `components/ui/PeopleGroup.tsx`
  with a thin adapter each (`FollowRequestList`, `ConnectRequestList`)
  deciding what a row says and which pills it carries. They sit directly
  above one another, so a copy that drifts by two points of padding is
  visible in a single screenshot — and the old follow-requests screen, a
  bordered white card per person with green and grey status chips, is
  exactly what § People lists and § Icons rule out. Same data, this app's
  list.
- **One filled pill per row, at most.** Follow back / Confirm are
  `#0369A1`; Dismiss, Decline and Cancel are the quiet `#F5F5F5`. The
  secondary line always says where that person stands, because that is the
  only thing anybody opens one of these lists to find out.
- **A decline dims in place and offers Undo**, restoring the row to pending
  rather than deleting it — the requester never learns a decline happened,
  and nothing vanishes under the finger that tapped it. An accepted row says
  "You now follow each other" and stays until the next load. Cancelling is
  the one action that does remove a row, because deleting it is what frees
  the pair to be scanned again.
- **Dismissing a follow request is honest about lasting only the visit.**
  There is no table recording "I saw this and passed", and the section is
  derived from who follows you, so a dismissed row returns next time. It
  dims with Undo rather than vanishing, so the decision is at least visibly
  reversible while you are on the screen. Persisting it needs a row
  somewhere; until then the copy must not imply it has been.
- **The camera screen keeps the standard header**, in white because it sits
  over the camera: chevron, centred title, one text action. The torch is a
  control on the viewfinder, beside the frame it affects, not a second icon
  in the header — and the reticle is four corners, not a full border, which
  would read as a box you have to fill exactly.
- **Permission is asked for on arrival**, and a permanent refusal renders as
  its own plain screen with a route to Settings, never a camera view that
  silently shows nothing.
- Both entry points run the same `useQrConnectFlow`, so a code that was
  *tapped* (a `namzoed://add/<id>` link, resolved by `resolveDestination` in
  `app/_layout.tsx`) and one that was *scanned* cannot drift into telling
  the user different things.

### The conversation list

`app/(users)/(tabs)/messages.tsx`. A list of people, so § People lists
governs it — the differences from a followers list are the timestamp, the
preview line and the unread mark, and nothing else.

- **One white group on the grey, inset 16.** Only the group's ends round;
  every row but the first carries the hairline inset to where the text
  starts. The full-width `#e5e7eb` rule under every row that this replaced
  is what made an inbox read as a stack of unrelated things.
- **44pt avatar, `UserRound` when there's no photo.** The initial-on-navy
  tile it replaced was per-user colour coding by another name, and it made
  the two people in your inbox called Karma look identical anyway.
- **Hierarchy is weight, never colour.** Unread darkens the preview to
  `#111` and bolds it; it does not tint it. The unread mark itself is a
  `#094569` dot up to nine and a `9+` pill beyond — the exact count is not
  what anyone reads, and a numeral at that size is a smaller target for the
  eye than the dot it would sit in.
- **A draft outranks the last message** and says so, in `#DC2626`. It is
  the only place destructive red appears on a row, because an unsent draft
  is the one thing on the screen that can still be lost.
- **The timestamp is read as recency, so it uses words before numbers**:
  a clock time today, "Yesterday", a weekday inside a week, and a short
  date beyond. `toLocaleDateString()` for everything but today printed
  "3/5/2026" against a message from yesterday.
- **Swipe-to-reveal keeps Mute and Delete**, restyled to this app's
  palette: `#6B7280` and `#DC2626` on the screen's own grey, lucide icons.
  The row's group corners live on the *swipe container*, not on an inner
  wrapper — otherwise a full swipe paints a square corner behind a rounded
  row.
- **A closed row has nothing behind it.** The actions are revealed by the
  row sliding off them, so they sit there covered rather than absent — and a
  row that fades under a press (`activeOpacity`) shows them straight
  through, which blinked a mute icon on every tap into a chat. Their layer
  is hidden until the row has actually moved. Anything parked under a
  pressable row needs the same: opacity feedback makes a covered thing
  visible, and "it is behind the row" is not the same as "it cannot be
  seen".
- **The tab root has no header.** See § Header — the tab row names the
  screen, so a title above it repeated the active tab and nothing else.
  `MessagesHeader` survives for the two views that do need naming: the
  signed-out state and message requests.
- **The floating pill is hidden on the Setlog tab, and only there.**
  Messages is a destination you pass through and keeps it; Setlog is a place
  you go *into*, where the feed's cards run to the bottom edge and the pill
  sat over a playing video saying nothing about where you were. The bar
  belongs to the Tabs navigator, outside any screen's view tree, so it is
  reached through `setTabBarHidden` in `contexts/TabBarScrollContext.tsx` —
  z-index inside a screen can never out-stack it. Two rules come with using
  it: tie it to focus, so a background screen cannot hide the app's
  navigation, and restore it on unmount, so leaving with Setlog selected
  does not take the navigation along. It is hidden because Setlog puts its
  own bar there (§ Setlog), and the list's bottom padding clears that one
  instead.
- **The screen has two tabs: Messages and Setlog.** Mongoose delivery held
  the second slot until Setlog took it, and moved to the drawer
  (`app/(users)/mongoose.tsx`) rather than being deleted — a feature with no
  entry point is a removed feature, whatever the code still says. Its rows
  crossed unchanged.
- **Four filter pills sit under the search field**: All, Personal, Business,
  Mongoose. **One is always on**, All included, so the row always states what
  you are looking at rather than leaving "everything" as an unmarked default.
  White on the grey, `#094569` filled with white text when on — the same
  on-state blue the switches carry. They live in a horizontal scroller, not a
  fixed row: four labels at 14pt sit within a few points of the width on a
  375pt screen and past it at a large text size, and a filter you cannot
  reach is worse than one you have to nudge.
- **Both tabs' pills are one component**, `components/ui/FilterPills.tsx`.
  The Messages row and the Setlog row are one tap apart and sit directly
  above one another, so two hand-maintained copies would drift by two points
  of padding in a way that shows in a single screenshot — the same reason
  `ProfileTabRow` exists.
- The category is derived, never asked for: a Mongoose
  delivery account wins over everything (it is a service, not a contact), a
  commerce `message_requests` row in **either** direction makes the chat
  business, and the remainder is personal — so every conversation lands in
  exactly one pill. Reading only the incoming request rows would file every
  enquiry *you* sent as personal, because the row lives on the sender's side.
- **Message requests are one row in their own group**, above the chats,
  and open the shared `PeopleGroup` with Accept and Delete as pills. It is
  the same decision Add Friends asks about, so it is the same list. A card
  per person with two full-width buttons stacked beneath is what that
  replaced.
- **A label that restates the screen is not a label.** "Your Chats (12)"
  above the conversations on the Messages screen, and "Search Results (3)"
  while you are searching, both went; "Frequent contacts" and "Waiting for
  you" stayed, because those name something the rows alone don't.
- **Search results are conversation rows**, because that is what tapping
  one makes them. A second row design meant the list changed its own
  geometry as you typed.
- **Frequent contacts is one horizontally-scrolling row of 52pt avatars**,
  as the share sheet's "Send to" is — not a wrapped grid with its own
  vertical scroller nested inside the scrolling screen.
- **The skeleton is the row's geometry**, imported from it rather than
  repeated (`components/ui/ConversationSkeleton.tsx`). A skeleton with
  different proportions makes the arrival read as a re-layout, which is the
  opposite of the point.
- The screen paints its grey behind the status bar via `insets.top`. The
  fixed 48pt white spacer it replaced is the "band of a different shade"
  § Grounds names as the most common way that rule gets broken.

### Sending pictures in a chat

`components/chat/ChatMultiMediaPicker.tsx` picks,
`hooks/chat/usePendingAttachments.ts` holds and uploads,
`components/chat/ComposerAttachments.tsx` shows them waiting, and
`components/chat/ImageStack.tsx` draws them once sent.

- **Picking is not sending.** A picked photograph lands in the *composer*,
  not in the thread. It used to go straight up, so whatever you meant to say
  about it arrived underneath as a separate message with no visible
  connection to the picture — the two halves of one thought, sent as two
  things.
- **The upload starts on pick, not on send.** By the time a line has been
  typed the bytes are usually already up, so Send is instant; sending early
  waits on the promises already in flight rather than starting them again.
  That is the whole reason the pending list is a hook with state rather than
  a list of URIs handed over at the end.
- **Each thumbnail says what it is doing** — a spinner while it uploads, a
  tick when it is there, a tappable retry when it is not. A failure stays in
  the strip rather than vanishing, and never blocks the rest: one photograph
  that will not upload must not cost somebody the other five and the sentence
  they wrote.
- **The strip grows the way the context card grows**, in the same place, and
  reports `onTransitionStart` / `onTransitionEnd` — the composer's height is
  measured and the list's bottom padding follows it, so a strip that appears
  without saying so pushes the last message under the keyboard.
- **A set sent together is one message.** Four photographs used to be four
  full-width bubbles and four timestamps; they are now one bubble with the
  caption inside it. One row: `image_urls` holds the set, `image_url` keeps
  the first so older clients, notification previews and the type/payload
  constraint all still work (`add_chat_image_groups.sql`).
- **The arrangements are the ones every messenger converged on** — two side
  by side, one-tall-plus-two for three, a 2×2 beyond that with "+N" on the
  fourth — capped at 220pt so a message stays a message rather than becoming
  the screen. Three equal tiles would leave a hole in the grid, and a hole
  reads as a picture that failed to load.
- **Taps belong to the tiles, the hold belongs to the bubble.** A tile knows
  which picture it is (so the viewer opens on the right one); only the
  wrapper knows where on screen the press happened, which is what the action
  sheet positions against.

### Sharing something into a chat

Arriving in a conversation from the share sheet, a "Message Seller" button or
a `ContextDrop` drop attaches what you came from to the next message —
`components/chat/ComposerContextCard.tsx` in the composer, the same data as a
full card in the bubble once it is sent.

- **The attachment is a card, not a thumbnail.** 76pt of picture beside four
  lines — kind, title, byline, caption, and price/date/place on one last
  line. The 40pt thumbnail and single clipped line this replaced was smaller
  than the same post is anywhere else in the app, and it told you *that* you
  had brought something along without telling you *what*.
- **It is the same card as the one that lands in the conversation**, said
  horizontally. Same kind label, same title weight, same byline wording,
  same price line — a preview that summarises differently to the thing it
  previews is a second design to keep in step, and it had already drifted
  ("Shared marketplace item" in the composer against "Marketplace" in the
  bubble). `sharedContextKind()` is the one place those names, fallback
  icons and calls to action live. Horizontal is the one deliberate
  difference: the sent card owns its whole bubble, this one is borrowing
  height from the message being written, and 76pt is as much as the composer
  can give up before the text field is the smaller half of it.
- **The composer grows into it.** The card's height is measured once and
  then animated (240ms out, 180ms back), so the pill opens like a drawer out
  of the composer row instead of the input field teleporting up the screen —
  and it collapses the same way when the attachment is removed, which is why
  the card keeps rendering its last attachment until the collapse finishes
  rather than unmounting the moment the state clears.
- **Nothing measures while it moves.** The composer's height feeds the white
  backdrop and the list's bottom clearance through `onLayout`, which fires
  every frame of that animation; those measurements are remembered and
  applied once on settle. Re-rendering the chat screen thirty times chasing
  a number that is about to change again is the one thing that would make
  the transition stutter, and nobody can catch a backdrop lagging by a
  quarter of a second.
- **Every entry point hands over the same fields.** Whatever opens a chat
  with something attached sends the caption, date, place, byline and
  verification along with the title and picture — a drop that filled in
  three of the card's lines and left the rest blank was the same card
  looking broken.
- **The fixtures are in Dev Components**, one per kind, since what the card
  looks like is entirely a question of which lines the source populates —
  a profile has no price, a post has no seller (§ Judging a screen before
  the data exists).

### Generated avatars

`lib/dicebear.ts`, `components/ui/GeneratedAvatar.tsx`,
`components/modals/AvatarStylePicker.tsx`, and the columns
`profiles.avatar_style` / `avatar_animation`.

- **Nobody in this app is a set of initials.** A profile with no photo used
  to draw initials on a grey circle — a wall of grey letters down every
  list, and the two people in your inbox called Karma looking identical,
  which is the same failure § The conversation list names in the
  initial-on-navy tiles it replaced. A Google sign-in without a photo hands
  over Google's own monogram, which is that placeholder in someone else's
  brand. Both are replaced by a DiceBear avatar seeded on the profile's id:
  stable forever, identical on every device, nothing to upload.
- **The seed is the id, never the name.** A name-seeded avatar redraws
  itself the day somebody fixes their spelling, and the whole promise of a
  generated avatar is that it is theirs.
- **One house style, varied by seed.** `notionists-neutral` for everything
  assigned automatically. The seed already makes every avatar distinct;
  letting the *style* vary per account too would make one list look like
  five apps. The picker offers all sixty-one, because a choice somebody
  makes deliberately is not the same thing as a default.
- **`avatar_url` stays a raster URL.** Seventy-odd files draw it, through
  everything from `expo-image` to React Native's own `<Image>`, and RN's
  cannot draw an SVG — so the PNG endpoint goes in the column and every one
  of those surfaces keeps working untouched. The style and the animation sit
  beside it as the recipe, so the few surfaces that *can* render SVG rebuild
  the animated version from the same seed rather than needing a second URL.
- **Animation is CSS inside the SVG, so it plays in exactly one place.**
  Neither `react-native-svg` nor `expo-image` runs CSS; both draw the first
  frame and stop. `GeneratedAvatar` puts the animated ones in a `WebView` —
  which is why it is used for the one large avatar on your own profile and
  the picker's preview, and never for a list. A `WebView` per row is a web
  page per row. The still frame is drawn underneath it and stays there, so
  the avatar is never a hole in the layout while the page loads.
- **Guess conservatively about what is a placeholder.** Google gives no flag
  saying whether a photo URL is a real photo or its own monogram, so only
  what can be proven — no URL at all, Google's `default-user`, `ui-avatars`,
  a Gravatar asking for one of its own fallbacks — is replaced. Anything
  else is treated as a real photo and left alone; guessing the other way
  deletes somebody's actual face, and the picker is two taps from every
  screen that shows an avatar.
- **Removing a photo lands on a generated avatar**, not on an empty circle,
  and it keeps whatever style was chosen before — so removing a photo you
  added over an avatar gives you that avatar back rather than resetting the
  choice. Only a real photo offers Remove at all; removing a generated
  avatar would land on the thing it exists to replace.
- **The picker is tiles**, where the services directory is rows: the thing
  being chosen is a picture, the labels are two words, and seeing many at
  once is the entire point. Every tile is drawn with *this* account's seed —
  sixty-one versions of you, not a catalogue of somebody else's samples.
- **Dev Components shows four seeds side by side**, plus one animated avatar
  beside a still one. One avatar tells you nothing about whether a style
  makes different people look different, which is the only thing that
  matters here (§ Judging a screen before the data exists).

### Chat details

`app/(users)/chat/details/[id].tsx`, with the three shared-content tabs in
`components/chat/ChatSharedContent.tsx` and the queries in
`lib/chatDetails.ts`.

- **Tapping the person in a chat's header opens the conversation, not the
  person.** It used to go straight to their public profile. Inside a chat,
  that tap is almost always about *this conversation* — the photo they sent
  last month, the link somebody pasted, silencing the thread, getting out of
  it — and a profile answers none of those. Their profile is one row down the
  screen it opens, and the avatar there still goes to it.
- **The name is the same target as the avatar.** Two adjacent things that
  look like one control have to behave like one.
- **Search runs on the whole history, not the loaded page.** The chat holds
  one page and streams the rest; "where is that photo from May" is exactly
  the question that page cannot answer, so the details screen queries the
  pair's messages directly. Wildcards in the term are escaped — a search for
  "50%" that matches everything is worse than no search.
- **A search result goes to the message.** Tapping one used to
  `router.push` the chat route with no message reference at all, so every hit
  did the same thing: opened a *second* copy of the conversation on top of
  details, which loaded the newest page and sat at the bottom. The results
  were decorative — you could find a message and then not go to it, and the
  back stack read chat → details → chat. It now hands the id to the
  conversation already on the stack (`lib/chatFocus.ts`) and goes **back**
  into it, pages backwards until that message is loaded, scrolls it to the
  middle and tints it for a couple of seconds. **The mark is not optional**:
  landing in the middle of an old conversation with nothing indicating which
  line matched is barely better than landing at the bottom.
- **A handoff that rides a `router.back()` is module state, not a route
  param.** Details is pushed *from* the chat, so the conversation is already
  mounted with its history and scroll position; pushing a duplicate to carry
  a parameter is what created the bug above. The slot holds one request and
  is emptied by whoever takes it, so it cannot replay on an unrelated
  re-focus, and it is keyed by partner so it cannot fire in the wrong
  conversation.
- **Media is every picture in the conversation, both directions, and chat
  has no `video_url`.** The media query selected and filtered on
  `messages.video_url`, a column that has never existed: PostgREST answered
  the whole query 42703, the throw landed in the screen's catch, and the tab
  said "No images or videos" to everyone about every conversation. It read
  like a filter bug — "it must only be showing theirs" — and was a dead
  query. A chat message keeps its first picture in `image_url` and all of
  them in `image_urls`, video included, told apart by extension with the same
  `isVideoUrl` the bubbles use. **A tab whose emptiness is indistinguishable
  from a failed query has to prove it ran**; this one had been empty since it
  shipped and nobody could tell.
- **One message of four pictures is four tiles**, so the tile id carries the
  index — keying on the message id alone renders one and silently drops
  three, the same shape of bug as the links rule below.
- **Media is a contact sheet**: three across at a 2pt gutter, no captions.
  The job is recognising a photo you already remember. Cards with titles
  would fit a third as many on a screen and answer nothing extra. Tapping one
  opens the chat's own `ChatImageViewer`, so a photo looks the same whether
  it is opened from the conversation or from here.
- **A link is a row, and one message with three links is three rows.** You
  are looking for a link, not for the message that carried it — though the
  row carries the date so it can be placed in time.
- **Each tab fetches the first time it is opened**, not on mount. Three
  queries over a long history to fill two lists nobody has asked to see is
  three waits charged to the screen opening.
- **Mute and block live here.** Mute is per device, in AsyncStorage, through
  `lib/mutedConversations.ts` — the inbox's swipe action writes the same
  store, and the inbox re-reads it on focus, because a mute set here that the
  list still shows as unmuted is indistinguishable from a mute that does not
  work.
- **Both halves render on fixtures** in Dev Components, with one tab left
  deliberately empty: none of the three look like anything on empty data, and
  a year-long conversation is not something anybody can conjure to check a
  grid's gutters (§ Judging a screen before the data exists).

### Tagged products

`components/post/TaggedProductsCard.tsx` in a post,
`components/post/TaggedProductStrip.tsx` in a grid tile — picked in
`components/modals/CreatePost.tsx` from `lib/taggableItems.ts`, stored on the
post as `tagged_products`.

- **Anyone can tag anything.** Tagging used to be limited to your own
  products, which made it a merchandising tool for people who already had a
  shop. A post about somebody's shop is worth more to that shop than a post
  *by* it: the seller gets an audience they do not have to own, and the
  poster gets to point at the thing they are actually talking about. Services
  are taggable for the same reason, so `TaggedProduct.kind` decides whether
  tapping it lands on a product screen or a service detail.
- **The card always names the seller.** "Sold by Tashi Weaves" is not
  decoration — the item usually belongs to somebody other than the poster
  now, and a card that omitted them would read as the poster's own shop. The
  picker names them too, before the choice is made rather than after.
- **A service has no price, and must not read as free.** `taggedItemPrice`
  returns nothing for one, and the card shows who provides it in that space
  instead of "Nu. 0".
- **The card sits above the author row, not below the caption.** When a post
  is about something for sale, that is the post's *subject* — the eye should
  land on it, the way RedNote puts linked goods at the top of a note. The tag
  pills this replaced were a caption you had to go looking for. In detail
  mode the author row floats over the media, so the card goes directly under
  the media instead: the same place in the reading order.
- **One card, however many are tagged.** Up to five can be; the first is the
  one anybody acts on and the rest are a "+N more" that opens the existing
  tagged-items sheet. Five stacked cards push the post itself off the screen.
- **The grid says so too.** A post that is about something for sale carries
  `TaggedProductStrip` on its tile — home feed, both profiles' Posts tabs,
  and the Liked and Commented grids alike. A tag is only worth anything to
  the seller if it is visible where people are actually browsing, and a grid
  that showed nothing made the whole thing conditional on opening the post
  first.
- **The strip is the card at tile scale, not a badge.** A 26pt thumbnail,
  the name, the price, and "+N" — the same facts in the same order as the
  card, because a bag icon says "this post has a tag somewhere in it", which
  is a riddle rather than an offer. It cannot be the full card: at ~175pt
  wide that would take more height than the caption and push the picture off
  the tile.
- **It is the one thing on a tile allowed an accent**: a hairline of the
  brand blue over the faintest wash of it. The rest of the grid is grey on
  white by design (§ Colour), so that much is enough to find at a glance in
  a scrolling waterfall — and no more than that, or a screen of tiles
  becomes a row of coloured boxes competing with the photographs, which is
  the thing the grid is for. A filled blue pill was the wrong end of the
  same idea.
- **It runs wider than the caption above it.** The tile pads its body by 9
  and the strip pulls 5 of that back on each side, so it reads as a band
  across the card rather than one more line of text in the stack.
- **Tapping a tag opens the product, not the post.** Somebody who taps a
  price wants the thing; the picture around it is already the way into the
  post.
- **And it previews before it navigates.** A tag — on the grid strip, on the
  card, or pinned to the picture — brings up `ProductPeekSheet` over what you
  were reading, at **70% of the screen**: the pictures, the price, two lines
  of description. Checking a price should not cost somebody their place in
  the feed, and a full navigation for that question is what it used to cost.
  A flick down puts it away. (A tagged *service* still navigates: it has no
  such sheet, and half a pattern is worse than none.)
- **The carousel shows part of the next picture — 80% current, 20% next.** A
  paging carousel that fills its frame exactly reads as a single photograph
  until somebody happens to swipe it. `snapToInterval` rather than
  `pagingEnabled`, because the page is deliberately narrower than the frame.
- **Pulling up does not open another screen; this one becomes it.** The
  sheet renders the *real* `ProductDetailContent` from its first frame and
  lends it the animated carousel through `heroSlot`. There is no preview
  layout and no crossfade between two of them — the only thing that changes
  on the way up is the pictures' geometry, from 80%-with-a-peek to the
  full-bleed 100% the screen uses, while every word beneath them stays
  exactly where it is. A preview that summarised the product in its own
  words and then swapped to the screen's was a visible cut however well the
  two were faded; this has nothing to cut between.
- **The hero is inside the screen's own scroller, not above it**, so the
  pictures and the text are one surface: scrolling past them in the sheet
  behaves as it does on the screen, because it *is* the screen.
- **Nothing in the transition animates a layout property.** The first
  version grew the sheet's `top`, the carousel's `paddingHorizontal`, and
  every picture's `width`, `height`, `marginRight` and `borderRadius` — so
  each frame re-laid out a horizontal scroller full of images, and it
  juddered. Everything is a transform or an opacity now: the sheet is
  full-height and *translated* to its resting place, the header's room is
  always reserved and the content rides up over it, and the peek is the
  finished carousel *scaled*.
- **The picture reaches the sheet's own edges — top, left and right.** No
  gutter, no strip of chrome above it: the only white in a preview is the
  band of detail underneath, which is what the preview is *for*. The grab bar
  floats over the top of the picture as a hint rather than occupying a row,
  and the header's room is reserved but ridden over entirely until the sheet
  becomes the screen.
- **The peek is the layout; opening it is a scale, grown from the top-left.**
  The pictures are laid out at the *preview's* size — 80% of the screen each,
  flush left — and the row is scaled up by 1/0.8 as the sheet opens, landing
  the picture full-bleed. The origin is the top-left corner because that is
  the corner that must not move; a centred scale slides the picture up and
  out of the sheet on the way open. The scroll offset lives inside the scaled
  container and scales with it, so every other picture stays aligned for
  free. It has to be this way
  round: a `ScrollView` clips to its own frame, so scaling *down* from a
  full-width layout shrinks the clip too and the next picture has nowhere to
  appear — the peek simply vanishes. Snapping stays in layout space, which
  the scale never touches, so it works at every point of the travel.
- **While it is a preview, the content does not scroll — a vertical drag
  anywhere opens it.** Reading a screen through a 70% window is a letterbox,
  and leaving the scroller live made the pull-up feel like a second, hidden
  gesture you had to find on the pictures. The first upward movement is the
  transition, which is what the sheet looks like it should do. Once open the
  gesture inverts: the scroller has the vertical, and the sheet takes it back
  only at the very top, where a downward drag means "put it back" rather than
  "scroll up past the beginning".
- **Room for the header is made continuously, never switched.** The strip
  above the pictures is the grab handle at rest and grows into exactly the
  space the floating header occupies (status bar + bar) as the sheet opens,
  so when that header fades in there is nothing for it to push. Switching
  the scroller's `paddingTop` at the end of the travel is the difference
  between an arrival and the content jumping down by an inch.
- **Never two ways out at once.** The sheet's close button fades as the
  screen's own back button arrives.
- **The sheet owns the status bar until it is the screen.** RN merges
  `StatusBar` props last-mounted-wins, and the content is mounted *inside*
  the sheet — so without `ownsStatusBar` it would set dark icons over the
  sheet's dark scrim and they would disappear.
- **Vertical belongs to the sheet, horizontal to the carousel.** The drag
  declares `activeOffsetY` / `failOffsetX`, or it swallows every swipe
  between pictures — the two gestures start identically and the outer one
  wins by default.
- **One sheet, mounted once** (`contexts/ProductPeekContext.tsx`). Three
  surfaces show tags and a sheet per card would mean one per tile in a
  scrolling grid. With no provider above it the hook degrades to a plain
  push, so a tag is never a dead tap.
- **It hangs off `GridCard`'s `belowTitle` slot, never a `taggedProducts`
  prop.** That card draws products, listings and services as well as posts,
  and a prop naming one kind of content is the first crack in a
  content-agnostic tile. The strip is passed in by the screens that show
  posts.
- **The picker is a search, not a list.** "Everything in the app" cannot be a
  scroll, and an empty query returns the newest of both kinds rather than
  nothing — somebody tagging a thing they just saw should not have to know
  its name to find it. Products and services are interleaved, because a list
  that always opens on one kind reads as though the other is an afterthought.

### Prices that make sense

`lib/priceSanity.ts`, shown by `components/ui/PriceSanityNote.tsx` and
wired by `hooks/usePriceSanity.tsx` into every form that takes a price.

- **A car for Nu 100 is a typo, and it is the buyer who wastes the trip.**
  The listing forms read the words the seller has already typed, work out
  roughly what is being sold, and say whether the price is anywhere near what
  that kind of thing goes for here.
- **Wide bands on purpose.** A scrap car and a new Prado are both inside the
  car band. The cost of a wrong warning is much higher than a missed one — a
  seller nagged about a price that was right stops reading the form.
- **It never refuses.** An advisory line under the field while typing, and
  one dialog on submit whose right-hand action is "Post anyway". The seller
  knows more about their own thing than a keyword table does; what this buys
  is the accidental Nu 100 car, not an argument about a cheap one.
- **Silence is the usual output.** No keyword matched, an accessory word
  anywhere in the text, a free or swap listing — all say nothing. **The
  accessory list is the important half**: a phone case is not a phone and
  costs a hundredth as much, and warning about it is the single most likely
  way this becomes noise nobody reads.
- **The listing's kind decides what its number means.** A rent is monthly, a
  vacancy is a salary, free and swap have no price to be wrong about. One
  band table cannot answer all three, so the context is passed in.
- **Bands are Bhutan-specific and will go stale.** They are one table in one
  file for exactly that reason, and Dev Components has a live playground —
  type a listing and a price, see what it is read as — so the table can be
  corrected against real listings rather than guesses
  (§ Judging a screen before the data exists).

### A post that is really a listing

`lib/sellingIntent.ts`, offered by
`components/post/SellingIntentSuggestion.tsx` from inside the composer.

- **A post selling something scrolls past once and is gone.** The same thing
  as a product or a marketplace listing keeps its price, its category and its
  place, and stays findable. The app has two surfaces built for that, so when
  the caption says selling, the composer offers them.
- **It suggests, it never redirects.** Nothing is blocked, nothing is
  rewritten, and "keep writing — this stays a post" is spelled out on the
  card. Plenty of posts mention money without being listings, so a wrong
  guess has to cost a glance and nothing more.
- **It names the phrase that set it off.** "'for rent' reads like a rental
  listing" can be argued with; a card that simply appears cannot.
- **Two things have to be true before it fires**: a phrase that means selling
  (or one that names a marketplace kind — hiring, for rent, swap, giving
  away), or a price *and* a phrase that means "contact me about it". A number
  on its own is a receipt, a recipe, or a complaint about the cost of onions.
  "Not for sale", "sold out" and "looking to buy" switch it off entirely, and
  a post that already tags a product is left alone — it is pointing at a
  listing already.
- **Which surface leads depends on who is asking.** A verified shop is
  offered Shopping first; everyone else gets the marketplace first with
  verification explained second — the same order, for the same reason, as
  `VerifyToSellNotice` (§ Shopping vs marketplace).
- **The draft goes with them.** Both forms take the caption as a title and a
  description. Retyping what you just wrote is the reason people abandon the
  move, and a suggestion that costs more than it saves is not worth making.
- **Dismissed is dismissed**, for that draft. A suggestion that comes back
  after being refused is not a suggestion.
- **Dev Components has the playground**, with a verified/unverified toggle.
  The false positives are what it is for: the phrase list is a guess about
  how people write here, and it should be corrected against real captions
  (§ Judging a screen before the data exists).

### The create menu

`components/create/LiquidCreateMenu.tsx`, opened by the "+" in
`components/ui/FloatingTabBar.tsx`.

- **The "+" does not open a sheet. It becomes the four things it can make.**
  Four droplets separate out of the tab bar's yellow circle and settle into
  an arc above it — post, product, setlog, story. A bottom sheet listing
  three rows was a menu bolted onto a button; this is the button, continued.
- **The liquid is a real gooey filter, not a metaphor.** Everything is SVG
  circles inside `feGaussianBlur` → `feColorMatrix`: blur the group, then
  throw its alpha through a steep contrast. Two circles far apart stay two
  circles; as they approach, their blurred edges overlap enough to survive
  the threshold and fuse, with a concave neck between them. The separation is
  not drawn — it falls out of the geometry, which is the difference between
  liquid and four views flying apart.
- **The source loses volume as the droplets leave**, dipping to under three
  quarters of its radius at the moment of separation and only partly
  recovering. A source that stayed the same size reads as a spawner, not as
  one body of liquid. Each droplet also **overshoots its own radius**
  mid-flight and settles back — surface tension — and they leave **in
  sequence**, ~55ms apart, so the mass necks and pinches four times instead
  of exploding once.
- **When it is idle, the edges move and nothing else does.** Every blob —
  the four droplets and the source — is a closed curve through eight points,
  and it is each *point's radius* that oscillates, on its own frequency and
  its own phase, with the whole deformation turning slowly so the surface
  travels around the blob. The centres never move. A droplet that drifted
  around its resting place would read as floating, which is a different
  thing and a worse one: what a bubble does is hold still while its skin
  moves.
- **Eight points, seven per cent, unrelated frequencies.** Eight is where a
  closed quadratic curve stops looking like a polygon and starts looking
  like a membrane; sixteen costs twice the arithmetic and looks identical.
  Seven per cent of the radius is a visible ripple that is still
  unmistakably a circle. And the frequencies must not be multiples of one
  another — eight points in step is a pulse, which reads as mechanical.
- **The curve is smooth by construction**, drawn through the midpoints of
  consecutive points with each point as the quadratic control, so no amount
  of wobble can produce a corner. The ripple starts only after a droplet has
  landed: a blob rippling while it is still travelling reads as unstable
  rather than as alive. The icons hold still, because the blobs do.
- **One frame callback, not an animation per value.** A shared UI-thread
  clock that every blob does its own arithmetic against, switched off with
  the menu — a callback still ticking behind a closed modal is a phone kept
  awake for a menu nobody opened. `useReducedMotion` turns the idle motion
  off entirely; the separation still plays, because that is a transition and
  it ends.
- **Text and touch targets live outside the filter.** A label inside a goo
  filter is smeared into paste, and a filtered group is a poor thing to
  hit-test; the icons, labels and pressables are plain views anchored on the
  same origin, carrying the same offsets.
- **The origin comes from the bar's own constants**, exported for it
  (`PILL_HEIGHT`, `PILL_FLOAT_GAP`). Two copies of those numbers is a menu
  that erupts from the wrong place, on one device size only.
- **The "+" rotates into a close mark** and stays the way out. A menu that
  covers its own trigger with a scrim and offers no way back through it
  makes people hunt for the edge of the screen.
- **Choosing runs the whole thing backwards before anything opens.** The
  action fires on the collapse finishing, not on the tap, so the screen
  that arrives replaces a settled button rather than cutting a half-played
  animation.
- **Live is not in it.** Four is what an arc over a 56pt bar holds without
  the outer two reaching the screen edges; going live is a different kind of
  act and gets its own entry point when it earns one.
- **If the filter ever fails, the menu still works.** Nothing depends on it
  for layout or hit testing — the circles simply draw unmerged and it stops
  being liquid (§ iOS/Android parity: `react-native-svg` has native filter
  views on both, and Dev Components is where to confirm it on a device).

### Setlog

`components/setlog/SetlogFeed.tsx` and `components/setlog/SetlogDayGrid.tsx`,
behind the Messages screen's second tab, with the log's day at
`app/(users)/setlog/[id].tsx` and the camera at `.../capture.tsx`.

A log is a closed group who each record a moment on the hour. Capture itself
is the phone's own camera; what this app builds is everything around it —
the hour that gives a clip its place, the closed group it is visible to, and
the day that assembles out of both. The rest of these rules follow from
keeping that surface small.

- **The camera is a card, and its controls are on the picture.** The
  preview fills four fifths of the screen, inset 12 at radius 18, and each
  of its four corners carries exactly one translucent circle: capture
  top-left, self-timer top-right, camera flip bottom-left, flash
  bottom-right — with the zoom stops in a row above the bottom pair. A
  camera screen with a tray of controls beneath it reads as a form with a
  photo attached; this reads as a viewfinder. The clamp on the card's height
  only bites on a small phone, where 80% would leave no room for the
  shutter.
- **Tap cycles, hold opens the list.** Every control advances to its next
  value on a tap, and shows all of them on a hold — so the common case is
  one touch and the rare one is still reachable, without a second row of
  chrome for either. The exception is the capture orb: length and
  resolution are one decision about the take, five lengths crossed with
  three resolutions is not something to tap through, so a plain press opens
  its panel.
- **The full list is a blurred context menu on the picture**, not the app's
  `BottomSheetModal` (§ Sheets). A sheet from the bottom edge slides the
  viewfinder away, and every choice here is about what the camera is doing
  *right now*, so it has to be made while the frame is still visible. It
  keeps the sheet's substance — a labelled group, one row per option, a
  check on the live one — and only where it appears is different. The check
  **leads** the row and holds its column whether or not it is drawn, so the
  labels stay in one line. The scrim is the way out; there is no close
  button, because it is a glance at a list, not a screen.
- **The blur is what makes it a menu rather than a panel.** `BlurView` over
  the whole frame behind it and again on the menu itself, so the choice is
  plainly in front of the camera rather than part of it.
- **It grows out of the control that opened it**, and shrinks back into it
  on the way out — pinned to that control's corner and scaled from exactly
  that point via `transformOrigin`, never a centred scale, which would swell
  out of the middle of the frame and then settle somewhere else. A menu that
  appears where you pressed needs no explaining; one that appears anywhere
  else has to be found again every time. 220ms out on `Easing.out(cubic)`,
  150ms back on `Easing.in(cubic)`, with the backdrop fading on the same
  value, so the whole thing is one movement.
- **The exit runs before the unmount.** The menu owns its own dismissal and
  calls back only when the animation finishes — a menu that blinks out of
  existence loses the thread back to the control it came from, which is the
  only thing the entrance was for.
- **The menu is the one thing that does not turn with the frame.** A system
  menu is aligned to the screen, never to the picture, and a menu that
  rotated would be the only sideways text anyone had to read in order to
  make a decision.
- **The frame toggle is a row in that menu**, not a control of its own. It
  is set once and then left alone, and the zoom scale wanted the space.
- **A setting with no visible value is a setting nobody trusts.** Resolution
  lost its pill when it moved into the capture panel, so the line under the
  card carries it instead.
- **Auto flash is a bolt with an `A`.** A bare bolt is what "on" looks like;
  using it for both left the two states telling the same story in the same
  picture, with only a label elsewhere disagreeing.
- **The four orbs are dark, not light** — `rgba(17,24,39,0.45)`. A control
  over a viewfinder has to stay readable against a white wall as well as a
  night sky, and only the dark one does both.
- **The shutter is this app's mark inside the camera's ring** — the Namzoed
  logo in a 64pt circle, its border going red while recording. A white disc
  is every camera ever made; this one says whose camera it is.
- **Back camera by default**: what you are pointing at is the usual subject,
  and the flip is one tap away in the corner.
- **The record line is the timeline.** A 3pt rule across the foot of the
  card filling left to right over exactly the take's length — never a
  spinner that only means "working".
- **Every mode stops itself.** 2s, 5s, Jumpcut (10s), Timelapse (30s) and
  Photo, cycled from the top-left orb. There is no free-running record
  button anywhere in Setlog, and 2s is still the default, because it is
  still the length that removes the "I have to make this good" tax.
- **Speed is playback, not capture.** Nothing re-encodes on the device, so a
  timelapse is thirty real seconds played back at 6× and a jumpcut ten at
  2×. `CAPTURE_MODES` holds the rate and `SlotPlayer` applies it — one
  place, so the grid and the player can't disagree about how fast an hour
  ran.
- **Zoom is the stops in a row, iOS-style**, with the live one in amber —
  the same licence the record ring takes for red, because both are the
  camera's own conventions rather than this app's palette. **The digits turn
  with the frame** like every other glyph on the card; the row keeps its
  place along the edge.
- **0.5× is a lens, not a zoom level.** `CameraView`'s `zoom` cannot reach
  past the wide-angle camera, so that stop sets `selectedLens` to the
  ultra-wide instead, and everything from 1× up is the `zoom` prop — a
  fraction of *that lens's* maximum rather than an optical factor, which is
  why ×2/×4/×8 are positions along a range and not promises about focal
  length. **The stop is shown only where the device reports the lens**
  (`onAvailableLensesChanged`, iOS-only), so it is absent on Android and on
  any phone without one: a stop that did nothing would be worse than one
  that is missing. Flipping to the front camera takes the lens with it, and
  the selection falls back to 1× rather than asking for a camera that is no
  longer there.
- One more honest limit, stated where it bites: `videoQuality` is honoured
  on Android and ignored by iOS, so the column stores *what was asked for*,
  not a fact about the file.
- **Every clock reads the way this phone's clock reads.** `lib/timeFormat.ts`
  is the only place that decides: the stamp on a clip, the hours on the day
  grid, the prompt window and the hour pickers all come from it. Setlog wrote
  its own "3pm" everywhere, which is the wrong answer for half the world and
  for anybody who has turned 24-hour on — and a stamp is read as *the time*,
  so half the app disagreeing with the lock screen is not a small thing.
- **`expo-localization` first, `Intl` second.** `uses24hourClock` is the OS
  setting itself on both platforms; `Intl` is right on iOS, where the toggle
  reaches the locale, but on Android it answers from the *locale* — an en-US
  phone switched to 24-hour still reports h12. The module is loaded through a
  guarded `require`, so the app behaves identically whether or not it has
  been installed and rebuilt, and the answer is cached: it is a system
  setting, not something to re-derive per row in a scrolling feed.
- **24-hour prints the minutes; 12-hour doesn't.** "15" alone is a number
  rather than a time, so the hour label is "15:00" — while "3:00pm" in a grid
  tile is two characters of noise per cell, so twelve-hour keeps "3pm". The
  two conventions are not the same string with a different suffix.
- **The preview can force either** (Dev Components › Setlog › Clock), because
  otherwise half these layouts are only ever seen by half the people testing
  them — "15:00" is wider than "3pm", and it is the day grid's tiles that
  pay for it. The override is a fixture: it is cleared when the preview
  closes, so it can never leak into the app as a setting.
- **The clock is the subject of the frame**, centred on it — not a badge in
  a corner. The hour is what a log is about: the same minute, everybody,
  wherever they are. It reads live until the shutter, then freezes at the
  moment it was pressed and stays over the take, so a clip is *stamped* with
  when it happened rather than captioned with it afterwards.
- **The camera reads landscape by default, and everything drawn on the
  picture turns with it** — the clock, every orb's glyph, every pill's
  label. This is a vlog camera, so the frame worth having is wide, and
  furniture that reads upright in the hand would be on its side in every
  clip. **One shared value is what all of them read**, so the screen can
  never end up half-turned — a rotation applied per control is a rotation
  that gets forgotten on the next control added — and so the change of frame
  is one movement of the whole screen rather than eight things separately
  arriving at the same angle.
- **The turn is animated, on the UI thread** — 280ms, `Easing.out(cubic)`,
  from a Reanimated shared value. Furniture that jumps between two angles
  reads as a re-layout; furniture that swings reads as the screen being
  turned, which is what it is. It has to be a worklet rather than a JS-driven
  animation because it runs against a live camera preview, the one thing on
  this screen that must never drop frames (§ Feedback and motion). The stored preference
  arriving on mount snaps instead: that is not a change the user made, and
  only a press animates.
- **Turn the glyph, never the button.** An orb is a circle and reads the
  same either way; it is the mark inside it that has to stand up. Rotating
  the buttons themselves would move the four corner controls off the
  corners.
- **The frame follows a button and nothing else.** Not the accelerometer:
  `responsiveOrientationWhenOrientationLocked` was tried and removed,
  because type that swings round on its own whenever the phone tips past an
  angle nobody was thinking about is worse than type that stays put — and
  the same tip meant nothing on Android, where that callback never fires. A
  control you press behaves identically on both platforms and only moves
  when you ask it to.
- **Portrait is a choice, and it is remembered.** The frame toggle sits with
  zoom and resolution because it is the same kind of setting — decided once,
  then left alone — and it persists in `AsyncStorage`. It sets how the app's
  own furniture reads; the video's own orientation is the phone's business,
  written into the file by the OS from how the device was held.
- **The "turn your phone sideways" hint shows while the frame is landscape
  and the camera is idle**, and goes when you start recording or switch to
  portrait. Nothing watches the phone, so it cannot know you have already
  turned it — which is the honest cost of the button, and a cheaper one than
  furniture that moves by itself.
- **A photo's rotation is baked into its pixels at capture**, by
  re-encoding through `expo-image-manipulator` with no operations. Left as
  an EXIF tag it is honoured by some surfaces and ignored by others, which
  is why a portrait photo came back on its side while video — whose
  orientation is written into the container — did not.
- **The title comes after the recording, never before**, written over the
  video in the place it will live, directly under the clock. A text field in
  front of a camera is a form; the same field over a clip you already have is
  a remark about it. It is optional and skipping it is one tap ("Post without
  a title") — most clips are untitled, and the prompt must never become a
  field you have to clear to get past. It is stored as text, not burned into
  the pixels: there is no video encoder on the device, and text kept as text
  stays sharp at every size and can be corrected.
- **A clip's mode is stored, never inferred from its length.** A 30s
  timelapse and a 30s video are the same number of milliseconds and are
  meant to be watched differently, so `capture_mode` is its own column and
  guessing between them is forbidden — it would play somebody's ordinary
  video at 6×. Clips from the system camera carry `native`, which is the
  honest answer: the app knows a photo from a video and how long the video
  was, and nothing else.
- **A slot is a local `(day, hour)` pair, never a timestamp.** "3pm" has to
  mean 3pm to everyone in the log, including the member who is abroad.
- **The hour is what a clip is filed under, and what the prompt runs on —
  never a quota.** Record as often as you like. A unique constraint on
  `(setlog_id, user_id, day, slot_hour)` originally read the hour as a
  limit, and being told "you've already recorded this hour" is the app
  refusing a moment for no reason. Nothing in the UI may imply otherwise
  either: the day grid's line under a recorded hour is *"Add another to
  3pm"*, not a notice that you are finished.
- **Every clip owns its storage path** — `<day>_<hour>_<time>` — so an
  upload is never an overwrite. The per-hour path it replaced made every
  second clip in an hour an `upsert`, and there was no UPDATE policy on the
  bucket, so it failed with "new row violates row-level security policy".
  Photos hit it first, being the easiest thing to take twice in a row.
- **The day grid draws recorded hours plus the open one, never all 24.** A
  screen of empty grey cells reads as a day you failed at; the same grid
  with four full tiles reads as a day in progress. The open, unrecorded hour
  is the only tile in the accent — it is the one thing on the screen you can
  still act on — and tapping it is how you record, because a full-width
  button at the bottom of a screen is what § Header rules out.
- **Late is shown, never punished.** A clip recorded after its hour says
  "added late" on the player and nowhere else. Nothing is greyed out, no
  streak breaks, and a quiet member never breaks the day for everyone else.
- **No counts of anything social.** No likes, no followers, no view counts,
  no ordering but the clock. The only number on the grid is how many of the
  log recorded that hour, and it sits under the faces rather than replacing
  them. This is the product, not an omission.
- **Clips are private, so they are read through signed URLs.** The
  `setlog-clips` bucket is the one non-public bucket in the app; nothing
  returns a permanent link. A closed graph whose media is fetchable by
  anyone holding a path is not closed.
- **Those signatures last a week, and the reason is the video cache.**
  `expo-video` keys its cache on the source URI, so an hourly URL makes the
  same clip a new entry every hour — the bytes are paid for again and again,
  and the 512MB budget set in `app/_layout.tsx` fills with duplicates of a
  handful of clips. A stable URL is what makes that cache work at all. The
  cost is a leaked link staying good for a week; for a closed group's own
  clips that is the right trade, and not one to copy for anything more
  sensitive.
- **A past day is cached forever; only today revalidates.** Capture is
  real-time only and a clip files under the recorder's own local day, so
  yesterday's feed is a finished answer — `isFeedImmutable` is the whole
  policy. An empty day is cached too: nothing recorded is also a finished
  answer, and re-asking it every visit is the same round trip for the same
  nothing. "All time" is never cached, being a window whose answer changes
  whenever anyone records.
- **Rows are cached, URLs are not.** A signed URL frozen into a cached row
  is a link that dies silently; they live in their own cache with their own
  expiry and are re-attached on read, re-signed in one batch only for the
  paths that are missing or close to expiring.
- **Your own clip is written through, never refetched.** The row and the
  author are both in hand the moment it uploads, so asking the server what
  you just did is a round trip that can only return what you already know.
- **Somebody else's clip arrives by realtime, not by polling.** Inserts are
  filtered against the logs you are actually in; the day on screen refetches
  and any other day is simply dropped from the cache, so it reloads if it is
  ever looked at again.
- **The cache goes with the session.** `clearQueryCache()` on logout — it
  holds one account's rows and week-long signed URLs into a private bucket,
  which would otherwise outlive the account on a shared phone and still
  play.
- **Recording is what creates a log.** The plus opens the camera, not a
  form; the clip lands in the log that is simply yours, which
  `ensure_personal_setlog()` creates on your first post and nobody ever
  names. A name field and an invite step in front of a two-second video are
  three decisions guarding the one thing that is supposed to cost none. A
  log resolved this way is created at *upload* time, never on arrival, so
  backing out of the camera leaves nothing behind.
- **Joining is a thing you do to somebody else's log, never the way into
  your own.** There is still no member picker, and `join_setlog` is the only
  way in — so nobody lands in your day because somebody else typed their
  name. The cap (12) is a trigger, because RLS can't count siblings.
- **On the Squad half, joining leads and starting one follows.** A squad you
  start alone is an empty room; a code from a friend is a squad with a day
  already running in it. So an empty Squad tab is a *join card* — the clip
  card's own geometry, drawn as a dashed outline, the whole of it opening
  the code field — with "Start a squad" as a quiet row beneath. Never two
  equal buttons: that would put the lonelier of the two answers on the same
  footing as the one that works. Once you are in a squad the card is gone
  and both are rows, join still first.
- **Starting one lands you inside it, not on a receipt.** `StartSquadSheet`
  takes an optional name — `setlogDisplayName` prints one for a squad nobody
  named, so the field is a way to tell two apart, not a gate — and then
  pushes straight to the log, where Invite and the code are. A screen that
  stops to congratulate you is a screen between you and sending the code.
- **A log with no name prints one anyway** — `setlogDisplayName`, one
  fallback in one place, so "Your log" can't drift into "Untitled" on the
  next screen.
- **The two halves of the tab are two different screens, on purpose.** Your
  Logs and Squad Logs were the same feed with a different filter, and that
  made the second one answer a question nobody had asked: a squad is not
  "your day with other people's clips shuffled in".
- **Your Logs is a feed of clips.** A card per recording, full width of the
  group inset at 16:9, newest first, and each one **plays**. A grid of
  thumbnails is the wrong shape for two-second videos — there is no still
  frame worth choosing out of two seconds, and a wall of frozen frames reads
  as an archive rather than as a day.
- **Squad Logs is a list of rooms** (`components/setlog/SquadLogs.tsx`). The
  questions it answers are *which squad*, *who is in it*, and *is today
  running* — none of which a wall of two-second videos answers. A row is the
  faces in joining order (four, then `+n`), the name, and one line of
  activity: "3 of 5 recorded today", or that nothing has started. That is
  still the only number Setlog prints, and it is about participation, never
  popularity. The clips are one tap away in the log's own day, which is
  where an hour with five people in it can be read as an hour instead of as
  five separate cards.
- **The squad list has no day label.** A day filter is a caption on a
  stream; a room is not a stream, and the day you want is chosen inside the
  log you opened.
- **Only what you can see plays.** The tab's `onViewableItemsChanged` (60%,
  120ms) hands the cards a set of ids, and a card off that list renders its
  ground and its stamp rather than a second video decoder — the hook cannot
  be skipped, so the player lives in a child the parent chooses not to
  mount. Ten simultaneous decoders is how a feed like this stops scrolling.
  Cards are **muted**: a feed that makes noise as you scroll past is a feed
  people scroll past once, and sound belongs to the full-screen player.
- **A tap on a card plays it full screen**, looping until it is dismissed —
  that is what a card of a video is offering, and it is the same
  `SlotPlayer` the day grid and the export reel use, handed a single clip.
  A lone clip loops rather than closing at the end: shutting after two
  seconds is right for an hour played through, and is the screen closing in
  your face for something you deliberately opened.
- **The log's day grid is on the hold, not the tap.** It is a different view
  of a different thing — an hour-by-hour grid of everyone in a log — and a
  tap that landed there instead of playing the clip under your finger was
  answering a question nobody asked.
- **A card carries the stamp it was recorded under** — the clock in the
  middle, the title beneath it, in the same type as the camera put them
  there. Whose it is and which day sit bottom-left, out of the stamp's way,
  and the by-line is dropped entirely on your own clips: "You" on every
  card in your own feed is noise.
- **The day is a centred underlined label at the head of the cards**, not a
  filter row — "Today" by default, because a log is about the day you are
  having and the archive is somewhere you go on purpose. It is a *caption on
  the list*, so it heads the cards and scrolls away with them rather than
  sitting in a fixed row over the tab. The rule under it is drawn, never
  `textDecorationLine`, so it carries the weight and spacing the app's other
  underlines have (§ Tabs and pills).
- **A chevron after it is what says it can be changed.** Underlined type
  reads as a heading, and nobody taps a heading — so without it the whole
  archive was a thing you had to already know was there. It is a 15pt
  `ChevronDown` in the label's own ink, and the rule runs under both: what is
  underlined is the control, not the word.
- **Tapping it opens one sheet with all three answers**: Today, a day off a
  calendar, or All time. They are one decision — how far back am I looking —
  so they are one sheet, not a filter row with a date picker hidden behind
  it. Today is stored as *the day that today is*, so one value goes on the
  wire instead of a mode and a date that can disagree, and `null` is all of
  it.
- **The day is applied in the query, not to the result**, so a day cannot
  come back empty merely because the newest thirty clips are older than it.
  It filters on `day`, the recorder's own local date (a UTC range would cut
  the evening off in Thimphu), and the empty copy says which day came back
  empty.
- **The calendar is the app's own, and the mark is why.**
  `components/setlog/SetlogCalendar.tsx` draws the month in the sheet, and a
  day with a log carries the **Namzoed mark under its number** — the same
  thing the shutter does inside the camera's ring, saying whose recording it
  was. A platform picker draws the days a phone knows about and nothing this
  app knows about, so every day in it looks alike; the one thing worth
  knowing on a calendar of a diary is *which days have anything in them*,
  which is the only reason anybody opens it. The mark sits under the numeral
  rather than behind it — a day is a number first, and a number read through
  a logo costs more than it says — and the cell keeps that height whether or
  not it is drawn, so a busy month and an empty one are the same grid.
- **Drawing it ends a platform split rather than adding one.** The native
  picker was a squat inline calendar on iOS and a dialog owned by the
  activity window on Android — which had to be opened imperatively to keep
  it from landing *behind* the sheet, the trap `DateOfBirthPrompt`
  documents. One calendar, in the sheet, identical on both, is what replaced
  it. Future days are drawn and unpressable rather than absent, so the month
  keeps its shape; the forward chevron stops at the current month, because
  nothing was recorded in the future.
- **Marks are read a month at a time, and a past month is read once.** Only
  the `day` column, only for the logs in the scope the feed is showing —
  `listLoggedDays` — because the calendar needs to know *whether*, not what,
  and an unbounded scan of everything ever recorded is the wrong price for a
  marker. A month that is over cannot gain a clip, so it is served from
  cache forever and only the current one is re-asked: the same policy
  `isFeedImmutable` states for the feed. The month opens on whatever is
  already in hand and repaints when the answer lands, and a month whose
  marks fail to load is a plain calendar, not a broken sheet.
- **The sheet scrolls; the calendar inside it does not.** Its cap is a
  percentage of the screen, and `BottomSheetModal` clips rather than scrolls
  — so the rows and the month scroll together on a short phone, instead of a
  second scroll surface being nested for the sake of six rows.
- **An empty feed shows the card that isn't there yet.** `SetlogEmptyCard`
  takes the clip card's own geometry — same width, same 16:9, same inset and
  radius — and draws it as a dashed outline on `#F9FAFB` with a plus in a
  circle and the reason beneath. A line of grey text on a white screen reads
  as a tab that failed to load; a placeholder in the shape of a clip reads as
  a day nobody has recorded into yet, which is what it is. The whole card is
  the tap and it opens the camera, so the empty state answers the question it
  raises. While the answer is still loading it carries the word and no plus:
  there is nothing to offer until the day has come back.
- **The mongoose sleeps on it**, between the plus and the sentence. A day
  with nothing in it is a quiet day, not a failure — and that tone is the
  whole difference between this feature and a streak counter. It is absent
  while the day is still loading, along with the plus: there is nothing to
  be asleep about until the day has actually come back empty.

- **The footer is one white group, not three stacked cards** — export,
  settings and join are rows, and a card each is the "card per item" shape
  § People lists rules out. The export row is absent entirely on a day with
  nothing in it, rather than present and inert. The Squad half keeps the
  same group with its own rows — Join with a code, Start a squad, Setlog
  settings — and no export, because what you export is *your* day.
- **Nothing exports before it has been shaped.** The export screen is two
  buttons — Reel and Collage — and each opens an *editor*. It has no preview
  to look at and no export to fire, because the shape of the thing is the
  interesting decision and it was the one the screen used to skip. Two cards
  that exported on the spot, with the only choice being which, is what that
  replaced.
- **The clock and the title survive every export, exactly as recorded.**
  They are what the clip *was*, not decoration added on the way out, so no
  editor writes them, edits them or leaves them off.
- **The stamp is one component**, `components/setlog/ClipStamp.tsx`, used by
  the feed card, the reel's panes and the collage's cells alike. It had
  already drifted once — the collage drew it in a corner while everything
  else centred it, so a photo looked captioned by a different app than the
  one that took it. **Centred is what the stamp *is***, not a per-surface
  decision, and the type scales to the height of whatever it sits on: a
  collage cell three across cannot carry a 52pt clock, and shrinking it by
  hand per surface is how that drift started.
- **The phone keeps its own recordings.** A clip used to be captured to a
  temporary file, uploaded, and the file swept up — so the device that made
  the video downloaded it back the next time anybody looked at it. It is
  copied into the media store under its clip id the moment the row exists
  (`keepRecordedClip`), which costs one local copy and is why your own log
  opens instantly however old it is.
- **The store is in the documents directory and bounded by size, never by
  age.** `Paths.cache` is the folder the OS empties whenever it wants the
  space, and a week-old cull is precisely the rule that makes *old* clips
  the slow ones — in a feature whose whole point is looking back. 512MB,
  least-recently-used evicted first.
- **Everything reads media through `resolveClipUrls`**: a `file://` where
  there is one, a signed URL where there is not. A fully-cached day costs no
  network at all, not even the round trip that used to sign twenty paths
  nobody needed. The feed also warms what it is missing in the background,
  so tapping a clip plays from disk.
- **An editor never opens on an empty screen.** The chooser downloads the
  half being opened before it navigates — `lib/setlogMediaCache.ts` — and
  the button counts the day down while it does. Four downloads at a time:
  one at a time made the count meaningful and the wait twenty round trips
  long. The editors show several clips at once, and streaming
  those at the moment a screen opens gives a grid of black rectangles
  filling in one by one, which is the worst possible first frame of a thing
  whose whole job is to be looked at. The wait happens where somebody has
  just chosen to wait, which is the only place a wait is welcome.
- **For the collage this is correctness, not polish.** `captureRef`
  flattens what is *on screen*, so an image still loading flattens as a grey
  square — a collage exported before its photos arrived would ship the
  holes.
- **A download that fails is not fatal.** The clip keeps its signed URL and
  streams as it used to; one bad file must not stop an editor from opening.
  The editors re-check on arrival, so opening one directly still works, and
  a day opened twice downloads once.
- **Both editors wear the same chrome**, `components/setlog/EditorChrome.tsx`
  — not the standard header (§ Header). On a screen where the *thing being
  made* is the whole point, the controls float over it as circles rather
  than taking a strip off the top: close on the left, the one filled action
  on the right, and everything that shapes the output behind a sliders
  button in the bottom corner. **The options belong in a sheet, not under
  the stage** — a row of steppers below the preview competes with the
  preview for the same glance, and it steals the height that is the thing
  you are judging.
- **Four ways out, in the two corners**: close top-left, save and share
  top-right (share filled — the one primary), and the named apps in a pill
  bottom-left. Only Instagram can be handed an image directly, through the
  pasteboard on iOS; the rest open the OS sheet with the file attached,
  which is also what happens when the app is not installed. A button that
  opens the wrong thing beats one that does nothing, and neither beats
  saying so.
- **Namzoed leads the pill, and it is the only target that isn't an exit.**
  Every destination on that row sent a day *out* of the app the day was
  recorded in, which left the one audience already here — the people in the
  clips — as the only one that couldn't be reached. It is first in the group
  for that reason, and carries `ImagePlus`, the same mark the create menu
  gives a post, rather than a mascot: the row is chrome, and § The mascot
  keeps the mongoose to teaching and waiting.
- **It opens the real composer, seeded — never a second posting path.**
  `components/setlog/PostToNamzoed.tsx` hands the finished file to
  `CreatePost` as `initialMedia`, and the composer runs it through
  `addPickedMedia`, the same function a picked file goes through. That is
  what keeps the Vision scan, the content rating, tagging, location and
  publish identical to any other post. A share button that wrote its own row
  would be a way to post that moderation never saw.
- **A collage becomes a post; a reel becomes a post that is also a Reel.**
  There is no reels table — `fetchVideoReels` reads the feed and keeps the
  posts whose media is a video — so "post or reel" would be a choice with
  nothing behind it. What decides is whether the export is a picture or a
  video, which was already chosen on the export screen. Say which one they
  are getting; don't offer a control that cannot be wrong.
- **The in-app route skips the link the others need.** A share to a named app
  needs an uploaded URL because Android cannot hand a local file to an
  arbitrary app; the composer uploads its own copy into the posts bucket, so
  filing a second one under the log is a write nothing ever reads. Same
  capture, one fewer request — `buildFile(needsLink)`.
- **Saving to the camera roll goes through `expo-media-library`**, loaded
  by a guarded `require` rather than a static import. It is present and
  linked today; the guard is what keeps the export screens working in any
  build where it is not, with a button that explains itself instead of an
  app that fails to start.
- **The options are a context menu, not a sheet** —
  `components/setlog/EditMenu.tsx`, the same blurred, anchored, screen-aligned
  shape the camera's capture menu takes. Toggles carry a check on the left;
  anything with more than two answers is a row with a chevron that swaps the
  menu for its own list, rather than a sheet stacked on a sheet. Every change
  applies to the thing behind it immediately, which is the only reason to put
  options over the picture instead of under it.
- **Sound is on in an editor.** The feed mutes because it scrolls past; here
  somebody came to watch, and a silent vlog is half of one.
- **No progress rule on the reel.** It was one more thing on the picture
  saying something the pane already said.
- **The reel editor's one real decision is the split** — 1, 2 or 3 clips at
  a time — because that is the format's own idea: the day read side by side
  rather than one thing after another. Sound is the other, and there is
  nothing else worth offering. A player per pane, mounted only while its
  pane is on screen: three decoders is the point of the format, thirty would
  be the end of it.
- **The pane group advances on the longest clip in it**, on a timer, not on
  `playToEnd`. With two or three playing at once there is no single "the
  clip ended", and advancing on the first cuts the others off mid-sentence.
  It loops the day rather than stopping — a reel that ends on a frozen pane
  looks like it broke.
- **The reel is rendered off the phone.** No encoder exists on the device
  (`expo-video` plays, `expo-camera` records, neither concatenates), so
  Save and Share write a job into `setlog_renders` and a worker with ffmpeg
  builds the file (`render-worker/`). The editor's settings *are* the job's
  parameters, which is why they had to exist before this could.
- **A job row, not a request that blocks.** A render outlives the screen
  that asked for it: somebody can back out, lock the phone, and come back to
  a finished reel. Progress goes over the stage as a percentage rather than
  a spinner — a reel takes long enough that a number is the difference
  between waiting and wondering.
- **The same reel is never built twice.** A finished render with identical
  settings is reused; the settings are what make it a different reel, not
  the tapping. And the file is **downloaded before it is handed on**, since
  a signed URL passed to another app stops working when its hour is up —
  a share that breaks a day later for no visible reason.
- **With no worker deployed, nothing hangs.** Jobs sit at `queued` and the
  app gives up after three minutes saying exactly that, telling the two
  failures apart: a renderer that never picked the job up reads differently
  from one that is taking too long.
- **The collage editor puts the grid in the recorder's hands** — columns and
  rows, both steppers. A collage somebody is about to post has a shape they
  want more than it has every photo they took, so rows may cap it, and the
  screen says **how many are being left out** rather than dropping them
  quietly.
- **The collage is laid out at export size and scaled down for the
  preview**, never laid out small and scaled up — `captureRef` flattens what
  is actually on screen, so anything else ships a blurry file. The preview
  reserves its own height by hand, because a scaled child still lays out at
  full size.
- **Reading order is chronological order.** The collage fills left to right,
  top to bottom in the order the photos were taken, and the reel plays
  oldest first — the opposite of the feed, because a day read as a story
  runs forwards. Columns follow the count: one photo is not a grid, four
  want a 2×2, more keep the 3-wide rhythm.
- **The watermark is a toggle, not a fixture.** A mark nobody chose is an
  advert for the app rather than a day; a mark somebody asked for is theirs.
  Same for the text overlay and the background — all three shape the file,
  so all three belong in the menu next to the grid, and none of them are
  decisions the app makes on somebody's behalf.

- **A queue nobody is serving says so in ten seconds, not three minutes.**
  A running worker claims the oldest queued row within one poll of its own,
  so a job still untouched after twelve seconds means nothing is listening —
  and three minutes of "Waiting for the renderer…" before the same verdict
  is indistinguishable from a hang. The message names the state of the app
  rather than blaming the export ("The reel needs a renderer"), and points
  at the collage, which is on-device and works regardless.
- **Setlog has its own settings screen**, reached from the footer group,
  and it holds two different kinds of setting. **Camera defaults** —
  frame, length, quality, flash, zoom, self-timer, which camera — are a way
  of holding *this phone*, so they live in `AsyncStorage` and never leave
  it. **The hourly prompt** follows the person, so it lives on their
  profile. Nothing on that screen is a setting you *have* to visit: every
  camera default can also be changed on the camera itself.
- **The camera's own controls change one take, never the default.** A
  one-off 30-second clip must not quietly become what the camera opens on
  tomorrow. The frame is the single exception, because it is a way of
  holding the phone rather than a property of a take.
- **The hourly prompt is off by default and stays off.** The prompt is the
  loop, and it is also the most intrusive thing this app could do. Its
  window defaults to 8am–10pm for when it *is* turned on: a prompt that can
  fire at 4am is a prompt that gets the app deleted.
- **The first visit shows an offer, not the OS dialog.** A card: what the
  prompt does, "Not now" and "Turn it on". The OS dialog comes only after
  someone has said yes to that. Firing `requestPermission` on mount was
  wrong twice over — iOS shows its real dialog once per install, so
  spending it the instant a screen opens spends it before anyone knows what
  they are agreeing to; and when the SDK is unavailable or permission is
  already granted, that call returns *silently*, so the screen appeared to
  do nothing at all.
- **The "already asked" flag is set when they answer, never before.** The
  first version marked it up front, so a silent no-op burned the one chance
  to offer it — which is why the key carries a `_v2`.
- **A switch that is on while the phone refuses to deliver says so**, in
  red, with the one place it can be changed. The OS state is read back after
  every change rather than assumed from the switch: those two can disagree,
  and only one of them decides whether anything arrives.
- **Notifications about Setlog are gated on the app version.** Setlog ships
  in the version being built now; the build people are running today is
  older and has no Setlog tab, so a push about it would open a screen that
  does not exist for them. `SETLOG_FEATURE_VERSION` is the one place that
  number is written, and it tracks `app.json` — set higher than the version
  actually being built, the gate closes on everybody, the build with the
  feature included. The switch is unavailable below it, the write
  refuses it a second time, and **every opt-in records the version it was
  made on**, which `setlog_prompt_recipients` filters by. The gate lives in
  a database view rather than in a sender, so the next thing that sends one
  of these cannot forget it. The version is cleared on opt-out, so a stale
  one can never read as a live subscription.
- **Setlog has a bar of its own** — `components/setlog/SetlogNavBar.tsx`,
  three items: **Your Logs**, **Squad Logs**, **Camera**. It stands in for
  the app's floating pill, which is hidden on this tab, so its geometry is
  copied from `FloatingTabBar` on purpose: same height, same
  continuous-corner capsule, same blur, same float off the home indicator.
  Two bars in one app that sit in the same place and look *almost* alike is
  worse than either one alone.
- **The third item is an act, not a place.** Camera is a filled circle
  rather than a third tab, because you never end up "on" it — you come back
  from it. The plus row that used to head the feed is gone with it: a screen
  with a camera button in its navigation does not need a second one in its
  list. The one plus left in the list is the empty card's, and
  it is a placeholder standing in for the missing clip rather than a second
  camera row — it is gone the moment anything exists.
- **Your Logs and Squad Logs split by log, not by author.** Your Logs is the
  personal log the camera creates and nobody else is in; Squad Logs is every
  shared log you are a member of, everyone's clips in them, your own
  included — a shared log read as a stream with your own half missing is not
  the day the group had. Which room a clip is in is what decides who can see
  it, so it is the thing worth splitting on. The scope is part of the cache
  key, and an insert invalidates both, since a realtime row does not say
  which feed it belongs to.
- **Both halves render on fixtures** in `components/dev/SetlogPreview.tsx`,
  with the open hour pinned to 3pm so the preview reads the same whatever
  time it is opened. Neither half looks like anything on empty data, and the
  fixture's Empty view renders the real `SetlogEmptyCard`, not a stand-in.
  The **Day picker** view is there for the same reason: a calendar is only
  worth looking at with marks on it, and a month of days you would have to
  record by hand is exactly the data nobody can conjure — the fixture marks
  a run of days and a scattering, and never a day in the future. The two
  **Squad** views cover the half you cannot reach without a second account
  and somebody else's code: three squads that print the three different
  activity lines, and the empty state whose whole job is getting you into
  one.

- **The prompt is offered in two places and stored in one.** The switch and
  its window live on the Setlog settings screen *and* in Settings ›
  Notifications, because that second screen is where somebody looks when a
  notification is missing — a notifications screen listing every kind the
  app sends except the hourly one reads as proof Setlog sends nothing. Both
  read and write `profiles.setlog_prefs`; nothing is duplicated into
  `notification_prefs`, because a second switch storing a second answer is
  how a person ends up opted in on one screen and out on the other.
- **A switched-on row the sender cannot act on is repaired on sight.** The
  sender skips anyone with no `timezone` (it cannot know what hour it is for
  them) or an `app_version` below the build Setlog shipped in — and both can
  be true of a row that says "on", because the timezone column arrived after
  some opt-ins and nothing rewrites the version when the app updates. That
  is the worst failure available here: the switch reads on, nothing arrives,
  and no error is raised anywhere. `repairSetlogPrompt` re-stamps both from
  the device whenever the prompt is read, and only when they are wrong.
- **There is a "send me one now".** Four moving parts — an opt-in row, a
  cron job, an edge function and OneSignal — and silence names none of them.
  The test row fires the in-app half and the push half for you alone and
  reports which arrived, which is the difference between "the scheduler
  never ran" and "push is broken".
- **The prompt fires from `supabase/functions/send-setlog-prompt`**, on a
  single hourly pg_cron job. One schedule serves every time zone: the
  function reads each person's IANA zone off their prefs and decides whether
  it is currently *their* hour, so a window of "8am to 10pm" means 8am where
  they are. A window that wraps past midnight is read as two ranges rather
  than treated as empty.
- **Four reasons it stays silent**, each deliberate: outside their window;
  a build older than `MIN_APP_VERSION`; they already recorded that hour
  (nobody is nudged to do what they have just done); or they were already
  prompted for it — `reference_id` is `<day>-<hour>`, so a cron that fires
  twice cannot notify twice.
- **Both halves go out together**, in-app row first and push second, so a
  failed push still leaves the prompt waiting in the app. The push carries a
  `collapse_id` per person: 4pm replaces 3pm on the lock screen instead of
  stacking an unread hour every hour of the day. Tapping it opens the
  camera, not the tab — landing on the tab would be one more tap to do the
  thing the notification just asked for.

**Not built yet, and deliberately named here so nobody assumes otherwise:**
the server-side montage that stitches a day
into one video, per-clip emoji reactions, video thumbnails on the grid
tiles, renaming a log after the fact, retitling a clip from the player
(`retitleClip` exists; nothing calls it), licensed music, and **the stitched
video export** — the reel plays in the app, but turning a day's clips into
one file needs a server-side ffmpeg render, which is the one piece of this
feature that cannot be done on the device at all. The capture ritual and the day it assembles are
what exists.

### Mentions

`utils/mentions.ts`, `components/ui/MentionText.tsx`, and the picker in
`components/comments/MentionSuggestions.tsx`.

- **The `@` is how you write a mention, not what one looks like.** Once
  somebody has been picked out of the list the symbol has done its job, and
  leaving it in makes the sentence read like a machine wrote it. The name
  renders alone, bold, and opens that profile.
- **Bold, not blue.** The app's blue already means "a link to a topic"
  (§ Hashtags); two blues in one sentence meaning two different things is
  worse than one that is simply heavier.
- **The composer shows the name, never the markup.** Picking somebody writes
  "Karma Dorji" into the field; `@[Karma Dorji](8f3c…)` sitting in the one
  place the writer is looking is the storage format leaking out, and it made
  a finished mention read like something had gone wrong. The hook remembers
  who was picked and rebuilds the links on submit (`toStorage`), so nothing
  about how a mention is stored, rendered or notified changes.
- **Rebuilding claims ranges in the original text, once.** Replacing names
  one at a time as it goes is the obvious version and it is wrong: after
  "Karma Dorji" becomes markup, a shorter "Karma" picked later matches
  *inside* it and nests one mention in another. Longest names claim first,
  whole words only, and a name the writer has since edited simply stays
  plain text — guessing which edit still meant that person risks a mention
  that quietly points at somebody else, which is worse than one that quietly
  stops being a link.
- **Stored as `@[Name](uuid)`.** The id travels with the name because a name
  is not an identity — two people share one and anybody can change theirs,
  and the link has to survive both. The name is stored beside it rather than
  looked up per render: a comment list would otherwise need a query per
  author mentioned, and the stored copy is what the writer actually saw.
- **`plainMentionText` for anywhere it cannot be tapped** — a notification
  body, a push, a preview line. `@[Karma](8f3c…)` on somebody's lock screen
  is the storage format leaking out of the app.
- **Anyone on the app can be mentioned, but the order is not flat.** People
  you follow who follow you back, then people you follow, then people who
  follow you, then everyone else; within a tier a name that *starts* with
  what was typed beats one that merely contains it. Limiting the list to
  people you know would make it impossible to bring somebody into a
  conversation they are part of.
- **The `@` half of a composer is a hook, not a copy** —
  `hooks/useMentionComposer.ts`. A post's comments are `CommentsModal` from
  the feed and `InlineComments` when the post is open: the same button, two
  components, and mentions were wired into only one of them, so typing `@`
  under an open post did nothing at all. Anything with a comment composer
  takes the hook; nothing reimplements the picker.
- **The caret is tracked by the hook, not read off the TextInput.** "Which
  `@` am I inside" is a question about the cursor, and the cursor after a
  keystroke is not the one `onSelectionChange` last reported — that event
  lands *after* `onChangeText`, so a picker waiting for it looks at the new
  text with the old caret and concludes there is no `@` being typed. The
  caret is advanced by the size of the edit instead, and the selection event
  only corrects it when the user moves the cursor themselves.
- **The field's `selection` is controlled for exactly one frame** — the one
  after a name is inserted, when the caret has to land past it. Controlling
  it permanently fights the native caret on both platforms, snapping the
  cursor back a character mid-word.
- **A mention renders as the name wherever it renders.** `MentionText` in
  every comment list, not raw `@[Name](uuid)` in one of them: a comment
  written in one composer is read in the other, and the storage format
  leaking into a comment list is the same bug as it leaking into a push.
- **A bare `@` opens the list.** The moment after the symbol is when the
  useful answer is "the people you talk to most", so it does not wait for a
  first letter. The follow graph is read once per composer session, not per
  keystroke, and the search is debounced.
- **Picking a name consumes the whole word**, not just the part left of the
  caret — somebody who types "@karma", moves back into the middle of it and
  then picks should not be left holding the tail of what they typed.
- **`MentionText` hands its plain runs to `HashtagText`**, so a comment gets
  both and neither feature has to know about the other. Both return
  fragments and must be used inside a parent `<Text>`, which is what keeps
  them inline mid-sentence.
- **Being mentioned is its own notification**, sent per person — a digest of
  "three people were mentioned" is a notification for nobody. Whoever is
  already being told about that comment (the post's owner, or the owner of
  the comment being replied to) is skipped, because two notifications for
  one sentence is the app talking over itself.

### Ratings, reviews and sellers

The marketplace rules, from the ecommerce requirements doc. They are as much
about honesty as about layout, which is why they live here.

- **A product's rating and its seller's rating are different things and are
  never merged.** A seller shouldn't be punished for a manufacturer's bad
  product, and a good product shouldn't be dragged down by one seller's slow
  delivery. They come from separate tables, and on screen they carry separate
  labels — a "Seller ratings" heading exists so nobody reads a shop's
  delivery score as the item's.
- **The star distribution is counted by the database, and every bar is a
  filter.** `product_rating_distribution`, never a reduce over the loaded
  page — that array is one page, so a client-side count is quietly wrong for
  any product with more reviews than fit in it. Shoppers lean on the
  distribution more than on individual reviews, and a distribution you can't
  tap is most of its value missing.
- **Rank on the Bayesian number, display the raw one.** `bayesian_rating`
  keeps one 5-star review from outranking 4.8 over a thousand; printing
  "4.09" on a product whose only review is 5 stars is correct maths and a
  confusing thing to show.
- **Verified-purchase is disclosed, not implied.** The badge appears only
  where the purchase is actually verified; the absence of a badge is the
  honest state, not a missing feature. The EU Omnibus Directive requires the
  disclosure and the FTC rule turns on the same distinction.
- **Helpful votes are rows, not a counter the client increments** — one per
  person, trigger-maintained, and never offered on your own review.
- **A metric that hasn't been measured renders as absent, never as zero.**
  "New seller" is true; "0% cancellations" on a shop with no orders is a lie
  that the page would be telling on the seller's behalf. Badges derive from
  the objective metrics only — stars are gameable, a cancellation rate is
  not — and require a minimum order history before they mean anything.
- **Every rating has a way to be left, on the page that prompts the
  question.** The read side of seller ratings shipped before anything wrote
  one, so every business profile said "No ratings yet" permanently — a page
  that can only ever report an absence. `SellerRatingSheet` is the write
  path: the three DSR dimensions, each optional, blank stored as null and
  never as zero, one row per person per business and editable forever. It
  opens from the **Rate** pill on `SellerCredibilityCard` — which sits with
  the seller, never under the product reviews — and once, unprompted, after
  somebody leaves a product review. Only once: the prompt is skipped for
  anybody who has already rated, because a question that returns after every
  review is nagging rather than asking.
- **A product review reaches the business, without being averaged into it.**
  The business profile's Reviews tab carries a second labelled line,
  **Product ratings** — one review-count-weighted number across everything
  that business sells (`fetchProductRatingRollup`), with a tap through to the
  catalogue it came from. Weighted, because a plain mean of per-product
  averages lets a single five-star review shout as loudly as fifty. It sits
  beside the trading score under its own heading and is never merged with it;
  the rule above is what the separate line exists to keep. A business whose
  products are reviewed but whom nobody has rated as a seller is no longer
  shown an empty tab — that state says which of the two is missing.
- **A service page carries its provider's reputation.** It had none at all:
  no stars, no reviews, no route to the provider's rating, which made every
  service a reputation dead end. It now shows the same
  `SellerCredibilityCard` a product does, worded for a provider
  (`kind="service"` — "Timeliness", not "Delivery"; "New provider", not "New
  shop"), with the same Rate pill. Services have no reviews of their own on
  purpose: what a buyer is judging is the person doing the work, and that is
  what `seller_ratings` already holds.
- **One gold for stars, everywhere.** `RATING_GOLD` (`#F5A623`) from
  `components/ui/StarRating.tsx`. Read-only stars are `StarRating`, tappable
  ones are `StarPicker` — the product review composer carried its own copy of
  both the picker and a second gold, which is how two surfaces end up looking
  like two apps.

### The business profile

Called **Business** everywhere a user can see it — never "work profile",
which is internal shorthand. It is a business page, not a shop page:

a carpenter with no products and a grocery with no services both live here,
and neither should see an empty tab for the thing they don't do.

- **The first visit is a setup screen, not an empty page.**
  `app/(users)/business/setup.tsx`. Tapping Business used to land on your own
  work profile, which before anything is filled in has no name, no type,
  nothing listed and no explanation — a blank page reads as a broken screen,
  and Edit was the only way out of it. The setup form asks the three things a
  page needs to exist and nothing else: a name, the kind of business (which
  decides what sections the page even shows — `lib/businessSections.ts`), and
  a line about it. Hours, a second number, the licence and what you sell all
  stay on the Edit hub, because none of them are needed to *have* a page.
- **Verification is not part of setup.** Selling on the catalogue needs a
  licence a person reviews; asking for a document before somebody has a
  business to attach it to is how a form gets abandoned. The page raises it
  in its own time.
- **The redirect uses `hasBusiness`, never the name alone**, for the reason
  below — and it waits for every read to finish, because bouncing somebody
  into a setup form on a slow connection is worse than a moment of empty
  page. It `replace`s, so a back gesture leaves the flow instead of cycling
  between the two screens.
- **"Has a business" means named OR has something listed**, never the name
  alone (`hasBusiness` in `lib/sellerService.ts`). Every profile carries a
  `service_providers` row from signup, so the name was the only way to tell a
  real business from an empty one — but sellers who listed products before
  the work profile existed never named anything, and judging by the name left
  their products live in shopping and unreachable from their own profile. The
  card decides for itself, because it is the thing that already has the
  counts; the display name falls back to the person's own, which is what a
  small shop is called anyway.
- **A business with no page of its own borrows the person's.** Plenty of
  sellers list products without ever naming a business — most small shops
  here *are* the person — so the work profile falls back to the owner's own
  name (`businessDisplayName`) and their avatar as the logo, rather than
  showing "Business" over a blank circle. `service_providers` already joins
  the profile, so this costs nothing.
- **The fallback is for display only; the editor stays honest.** Edit shows
  the name and logo fields as empty, because they are — a logo that looked
  set would be one with nothing to remove. And everything that *names* the
  business uses the same fallback: the header, the compact bar, the share
  sheet and the in-business search, or a share saying "Business" would read
  as somewhere other than the page it came from.
- **The Business card on a profile** sits with Norbu Wallet and History and
  is built the same way — no border, `bg-white/[0.07]`, `Briefcase` icon and
  "Business" on one line, the business name beneath. Its right-hand side
  shows **what the business sells**, not its logo — a logo says nothing a
  visitor doesn't already know from the profile they're looking at. In order:
  a product thumbnail with the price over it; one service's name when there
  is exactly one; **"N services" when there are several**, because naming the
  newest of five reads as "this is what they do" and is wrong four times out
  of five.
- Prices in tight spaces go through `compactPrice` (`utils/price.ts`): exact
  under five digits, then `K`/`M`/`B`. "Nu. 1,250,000" doesn't fit a 46pt
  thumbnail, and truncating a number mid-digit is worse than rounding it.

- **Tabs come from the business's TYPE, not from what it has listed.**
  `service_providers.category_id` (the same `service_categories` vocabulary
  the services use) maps to a section set in `lib/businessSections.ts` — a
  taxi service gets Fares and Reviews, a restaurant gets a Menu, a repair
  business gets Services and Portfolio. **Reviews is in every set**: a
  business with no ratings still has to say so, and an absent tab reads as a
  missing feature rather than an empty one.
- Deriving from *presence* instead was the earlier attempt and it half-works:
  a visitor never saw a taxi's empty Products tab, but the owner always did,
  because they needed somewhere to add the first item. A business that will
  never have products needs the tab gone for them too.
- **One account, many services — never one service per account.** The count
  was never what made pages generic; the missing type was. Splitting a
  multi-service business into several accounts fragments its ratings,
  followers and chat history, and `service_providers` is 1:1 with `profiles`
  anyway, so "one service per business" would really mean one per person.
- A business with no type set falls back to the full section set. Its type is
  filled from its first service, so a seller is never asked a question the
  app could answer for them — and only ever when it's blank, so a business
  that has chosen keeps its choice.
- **One reputation for the whole business.** A shop and a service provider
  are asked the same three questions about different transactions, so they
  share `seller_ratings` rather than running two systems to keep honest.
  Only the wording changes: Delivery for a shop, Timeliness for a service —
  "delivery" is the wrong word for a carpenter and "timeliness" is the wrong
  word for a parcel. `RATING_DIMENSION_LABELS` holds both sets.
- **That is not the product reviews.** Those live on each product and are
  about the item; these are about trading with this business. Keeping them
  apart is what the whole schema is arranged for.
- **The header mirrors the personal profile's** —
  `components/profile/BusinessProfileHeader.tsx`: per-user cover gradient
  behind the whole block, logo over it, identity to the right, counts
  beneath, white type throughout. The two pages should read as one app.
  Counts are what the *business* has (products, services, rating) — followers
  belong on the personal profile.
- **Editing is a hub, not a form.** The Edit button opens
  `EditWorkProfile`, built in the same shape as the personal profile's hub:
  the logo is the only thing edited in place, and every text field is a row
  that opens its own single-purpose screen with one Save and one thing to get
  wrong. A single long form makes each field feel optional, and a business's
  name and license are the two things a buyer has to be able to trust. Fields
  save one at a time, so a failed save can only ever lose one.
- **Its pages slide within it, on the same stack Settings uses.** The hub
  isn't inside the settings navigator, so it runs its own small stack of
  `SubPageLayer` levels (`components/settings/SubPageLayer.tsx`,
  `SUB_PAGE_SLIDE_MS`): each level owns a `makeMutable` translateX created
  when it's pushed, only the top level takes touches, and the left edge drags
  it back. Full-screen modals cross-faded in from nowhere and couldn't be
  dragged back; a pushed route meant closing the hub to open the next screen,
  so coming back landed on the business page instead of the row you left.
  Hardware back and `onRequestClose` pop a level first and only close the
  editor from the hub. Every level sits on the same `#F9FAFB` ground so a
  slide never shows a seam, and the bottom inset belongs to the layer, not to
  the page inside it.
- The pages themselves are the form screen the standard describes.
  **`paddingBottom: 34` and the counter go on every field, single-line
  included** (see `EditName`): the padding is the room the counter sits in,
  and applying it only to multiline leaves single-line text padded at the top
  and not the bottom, which reads as the text sinking in its box.
- **The business type is a page with a Save, not a sheet.**
  `components/profile/EditBusinessType.tsx` — the short list renders inline as
  selectable rows with a `Check` (§ Choice fields), and tapping a row only
  selects; Save commits. The sheet it replaced saved on tap, and the type
  decides which sections the business page shows, so a mis-tap silently
  reshaped the profile with nothing to undo it.
- **The license is a page, and the status is the first thing on it.**
  `components/profile/BusinessLicense.tsx`. Three states, each with its own
  icon, colour and one line of what it means: verified (`#0369A1`), being
  reviewed (amber `#B45309` — waiting is the expected path and must not read
  as an error), not uploaded (grey). A fourth case falls out of them: a
  document that exists but is `not_verified` was rejected or reset, so the
  *status* decides the wording, never whether a file is present. The document
  is shown at 3:2 rather than hidden behind a "View" action — checking that
  the right file went up is the main reason to open this at all — and the
  actions are rows in one block. Explanatory copy says what is *lost*
  ("your products stop appearing on shopping"), not just that verification
  resets. Picking and uploading belong to the screen that owns the provider
  row; the page only says what it wants done, and its picker goes through
  `presentSystemPicker` because it fires from inside a modal.
- **Services are edited from the hub, not from the business page.** The
  business page is the shop front — a visitor shouldn't share a screen with
  the owner's add/edit controls. They're a group of rows like every other
  group, with "Add a service" as the last row rather than a button floating
  beside a heading, and both open `components/profile/EditService.tsx` as a
  sub-page. That page is presentational: it owns the form and the save and
  nothing about where it sits, and reports back through `onSaved` so the list
  behind it refetches. Category is offered only when creating — moving an
  existing service between categories would silently change which businesses
  it's found alongside, and the business's own type with it.
- **Adding and editing services happens here**, as rows in a group with "Add
  a service" as the last one — not as a button beside a heading on the
  business page. A visitor shouldn't share a screen with the owner's
  controls; the business page is the shop front.
- Both open a **pushed screen** (`app/(users)/profile/service.tsx`), never a
  sheet. Editing a service is somewhere you go, not something you glance at
  over the page beneath — and a route gets the back gesture, the header and
  the keyboard behaving as they do everywhere else, for free.
- Its **category is chosen only when creating**. Moving an existing service
  between categories would silently change which businesses it's found
  alongside, and the owner's business type with it.
- **The page pins like the personal profile.** The fixed bar sits outside the
  scroller, the full header scrolls away beneath it, and the tab row is the
  sticky child at `stickyHeaderIndices={[1]}`. The bar's height is measured,
  never hardcoded — the status bar varies by device, and a constant leaves a
  sliver of the tabs behind the bar or a gap below it.
- **The bar is transparent at rest and fills in on scroll**, with the
  business avatar rising into it — the personal profile's behaviour. A
  permanently filled bar reads as a second, differently-coloured surface
  stacked on the header rather than the same one continuing.
- **The avatar in the bar is left-aligned**, not centred as on a personal
  profile: a business is identified by logo *and* name together, and centring
  the logo puts it where a title belongs.
- **Bar actions move with the scroll, they don't swap.** At rest: the Edit
  pill (on your own business) and Search as an icon. As the avatar rises in,
  the pill collapses to nothing and Search grows into the width it vacated,
  revealing the "Search in Business" label once there is room for it.
  Everything is interpolated from the one scroll value; nothing mounts or
  unmounts, so there is no frame where the layout jumps.
- Three things make that read as smooth rather than merely animated. The pill
  **collapses its width**, not just its opacity — a pill that fades but keeps
  its width leaves a hole the field can't grow into. Its inner button is
  **pinned to its measured width**, so narrowing the wrapper clips it rather
  than reflowing it; without that the label squeezes and wraps, which looks
  like distortion rather than motion. And the label on the search control
  fades in *after* the width (from 55%), because fading it with the width
  shows it clipped mid-word.
- Order in the track: avatar, then search, then the Edit pill — search grows
  rightward into the space the pill beside it vacates.
- It needs one measurement of the track and one of the pill: you can't
  interpolate to "the rest of the row" without knowing how wide the row is.
  **Apply the animated width only once that measurement exists** — applying
  it from the first frame is circular, because the width interpolates from a
  value that starts at 0, and the content can't lay out inside a wrapper that
  is already 0 wide. It never measures, so it never appears. Same guard as
  the profile-preview island's `measured ? … : null`.
- **The Edit pill is the personal profile's, to the letter** — `Edit3` at 13
  and `strokeWidth={1.8}`, `px-3 py-1.5 bg-white/15 border border-white/30`,
  radius 999. Two profiles offering the same affordance should offer it in
  the same shape.
- **The rating sits under the trade line**, with the identity rather than in
  the counts row: it's part of who the business is, not a statistic. Shown as
  **five stars** plus the number and count (`components/ui/StarRating.tsx`,
  the one implementation) — the shape reads at a glance in a way a bare
  number doesn't, which is the whole reason it goes there. Absent until there
  is a rating; "0.0" reads as rated badly, not unrated.
- **Tab content sits on `GRID_BACKGROUND`, not white.** Content on white,
  screens on grey: a white panel behind white cards makes them disappear.
- **Search is scoped to the business** (`BusinessSearchModal`) — its products
  and services, filtered from what the page already loaded. The question on a
  shop front is "do they have X", not "who sells X", which global search
  already answers.
- **The tab block keeps the personal profile's rounded top corners**, pulled
  up over the header by `TAB_BAR_CORNER_OVERLAP` so the curve sits on the
  gradient, with a band of the header's tint filling what the corners curve
  away from and `overflow: "hidden"` clipping the edge fades to it. Without
  the overlap the tabs start below the header as a square block, which is
  visibly not the same treatment.
- **Visibility switches sit beside what they control** (Show email, Show
  phone), not in a settings screen elsewhere: deciding whether to publish a
  phone number is a decision about that number.
- The owner's services management lives under the **Services tab**, not above
  everything — the header already shows the business's identity, so having it
  on screen by default made the page read as the same block twice.
- **The credibility strip is what this page is for** and what a personal
  profile must never have: verification badge, response time, on-time rate.
  Same rule as everywhere — an unmeasured rate is absent, never zero, and an
  unanswered rating dimension shows a dash rather than 0.0, because a buyer
  who skipped the question hasn't rated it badly.
- Leave posts, likes, saves and comments off. Those are the person; this is
  the business, and keeping them separate is what stops the work profile
  reading as a duplicate with a badge.

### The services directory

`app/(users)/(tabs)/services/index.tsx` lists what kinds of service exist;
`app/(users)/services/[slug].tsx` is one kind, and
`app/(users)/services/search.tsx` searches across them.

- **The tab opens onto services, not onto a list of kinds of service.** It
  was a directory — one white group of rows, each a category you tapped
  through to reach anything real — and that was the right answer to the wrong
  question. Home, Shopping and Marketplace all open onto *content*; four tabs
  on one bar, three showing things and one showing a table of contents, is
  the inconsistency worth fixing. The grid is `MasonryGrid` + `GridCard` at
  `LISTING_CARD_RATIO`, identical to Marketplace's, because a service with a
  photograph is the same kind of tile as a listing with one.
- **The categories became the filter row**, exactly as the kinds of listing
  are on Marketplace: plain text, active `17 mbold`, inactive `15 medium`,
  18pt gap, scrolling horizontally because there are twenty of them. This is
  also what finally solves the long-name problem the old tiles had — "Medical,
  Legal and Financial Services" has the width of a scrolling row to be read
  in, where a four-across tile cut it in half.
- **A card shows the service, the provider and the kind.** No price: a
  service has none (§ Tagged products), and the corner a price would sit in
  carries the category instead — the one thing being filtered on.
- **Only live services are in the grid.** A paused one is a tap into a screen
  that says it is unavailable, which is worse than an absence.
- **A category is still one tap away, and so is every provider in it.** The
  per-category screen (`services/[slug].tsx`) is unchanged; the filter row is
  now the way to it as well.
- **The tab has no title and no tagline.** Categories and Marketplace go
  straight from the bar into their content, and a "Services" heading over a
  screen of services is the restatement § The conversation list rules out —
  it cost a fifth of the first screenful. The "ALL SERVICES" rule-and-caps
  divider went with it: a section label is 13 semibold sentence case (§ Type),
  and with one group on the screen it labelled nothing anyway. It comes back
  as "All services" only when the bookings group is above it to be told
  apart from.
- **The "eight, then More" shortlist went with the directory.** Nineteen
  categories were a wall as a vertical list; as a horizontal filter row they
  are one flick, and hiding eleven of them behind a disclosure would now cost
  more than it saves. The order is still the data file's own — roughly how
  often each is wanted — and `service_card / category_select` is still
  recorded, so the day something ranks that row, this is where it happens.
- **Bookings are their own group, and never a filter.** A ground or a room is
  booked by the slot rather than by contacting somebody, so the two rows sit
  above the grid on "All" — as `SettingsChrome` rows, the app's own. Putting
  them in the filter row would make them look like kinds of service they are
  not, and hiding them under a category would bury them.

### Managing what you sell

`app/(users)/listings.tsx` — a route around
`components/modals/ManageListingsOverlay.tsx`.

- **Two tabs, because there are two things you can put up.** Saved things
  are somebody else's listings kept for later — a different job, with its own
  home in Settings › Saved Posts — and a third tab of them made a screen
  about *selling* half about *browsing*.
- **One destination, five doors.** The "+" menu's Product, the Marketplace
  tab's empty state, both profiles' Products tabs and the hamburger menu all
  arrive at the same screen. It used to be an overlay mounted inside the
  profile, so everything else that wanted it had nowhere to point — you could
  add a product from a menu and then have nowhere to go to edit it.
- **Listing something and finding what you listed are one job.** The screen
  can create as well as manage: **New** is the header's one text action, and
  the same action repeats in the empty state. A form with no list behind it
  leaves somebody holding a product they cannot find again.
- **It is the app's own grammar, not its own look.** What this replaced was
  a blurred "premium header" over filled pill tabs and shadowed cards — a
  screen that read as a different app than the one around it. Now: grey
  ground, one white group at radius 18, hairline separators inset to where
  the text starts, plain text tabs with the standard 24×2 underline
  (§ Tabs and pills), and no full-width button anywhere but the delete bar.
- **A row is a thing you own, so a hold selects it.** Deleting is the only
  destructive act here, and it sits behind a hold, a count in the title, and
  a confirmation — never behind a swipe a scroll can trigger by accident.
  The confirmation names what is going: removing a bookmark and taking a
  listing down are not the same act.
- **The two "new" forms are screens, and the same screen twice.**
  `app/(users)/listings/new-product.tsx` and `.../new-marketplace.tsx` are
  built from one kit (`components/listings/ListingForm.tsx`) so they cannot
  drift: grey ground, white borderless fields, `text-xl` input, no labels
  above anything, counters floating inside the field, choices as rows that
  open a `ChoiceSheet`, and the primary action as the header's only text
  action — pale until there is something to post. They replaced a bottom
  sheet with a blurred backdrop, bordered fields, an inline `<Picker>` and a
  full-width green button at the foot: five things § Form screens rules out,
  in one form.
- **The kind of listing is the one thing that stays a chip row.** Five short
  words chosen constantly, where a sheet would make a one-tap decision two —
  and it comes first, because it decides what the rest of the form even
  means (a vacancy has no price; a giveaway's is zero).
- **Which half you land on is decided by whether you have a shop.**
  `canListProducts` — a verified work profile — is the one rule. With one you
  open on Products, without one on Marketplace, because that is the surface
  built for selling your own used things. An explicit `?section=` overrides
  it: somebody who tapped "Products" stays on Products.
- **The Products tab is never hidden from people without a shop.** It
  explains what a shop is and offers the way to get one, which is the
  difference between a locked door and a signpost — the same tone
  `VerifyToSellNotice` takes, and the database enforces the rule either way.
- **An empty tab offers the action it is empty of**, rather than describing
  the category back to you ("Items in this category will appear here" told
  nobody anything). The one exception is Products without a shop, where what
  has to be explained is not "add one" but what a shop is.

### Shopping vs marketplace

Two selling surfaces, and the difference is who may sell on them.

- **Shopping** (`products`) is for registered shops: a seller needs a
  verified work profile — a business license reviewed and
  `service_providers.verification_status = 'verified'`. The database enforces
  it on insert, so the rule holds for any client including an old build.
- **Marketplace** (`marketplace`) is for everyone: second hand, rent, swap,
  free, job vacancies. No verification, because passing on something you own
  isn't running a shop.
- **The shop IS the work profile.** There is no separate store entity —
  `service_providers` already carries the license and the verification
  status, and a second table would give the app two answers to the same
  question. Ratings and metrics key off `service_providers.id`.
- **A personal profile's Marketplace tab shows marketplace listings**;
  a verified seller's products live on their work profile, which is the shop
  front and carries the shop's ratings above them.
- **Refuse early and point somewhere.** Someone without a shop who opens the
  product form gets `VerifyToSellNotice`, which leads with "list in the
  marketplace" and offers verification second — most people who open that
  form want the marketplace and don't know there's a distinction. Never let
  them fill in a form and then fail.
- **An unverified seller is an "Individual seller", never an "unverified
  seller".** They're using the surface built for them, not failing at a
  different one.

### A service is a product-shaped page

`components/ServiceDetailContent.tsx`, with
`components/ServiceDetailOverlay.tsx` for grid taps and the same peek sheet
tagged products use.

- **One page shape for both.** The two had drifted into different apps — a
  product got a fixed 4:5 hero, a glass header floating over it and a white
  content card; a service got a 45%-of-screen parallax hero that morphed
  height as you scrolled, and its own everything. They answer the same
  question (a picture, a name, who is behind it, one way to get in touch),
  and a seller who lists both had to learn two screens.
- **Where a product prints a price, a service prints its provider.** A
  service has none (§ Tagged products), and the row that names who does the
  work is the fact somebody is actually deciding on — not an empty space
  where money would be.
- **The same three behaviours, from the same code.** Growing out of a grid
  tile, the edge-swipe back, and the drop-on-the-dome — all
  `components/ui/GrowIntoScreenOverlay.tsx`, which the product overlay was
  refactored into rather than copied from. Two copies of that animation is
  two copies of a thing nobody wants to debug twice; the overlays differ
  only in where the hero settles, which drop target, and which content.
- **The dome messages the provider, not the seller.** Same gesture, correct
  noun — and the drop carries the service's own context into the chat, the
  way a product's does.
- **A tagged service previews like a tagged product.** One `ProductPeekSheet`
  handles both: the pictures, the pull and the screen it becomes are
  identical in shape, and only the fetch and the content component differ. A
  second sheet would be the same file with two words changed, drifting from
  the first time either was touched.

### Detail screens

Media first and full-bleed, then the author row, then body text, then pill tags,
with actions in a fixed bottom bar. Wrap the content in `ContextDrop` for the
edge-swipe back (and a drop target where there's a contextual action worth
having). Photos open a full-screen viewer on a black backdrop — pinch to zoom,
X to close, actions as translucent cards at the bottom, joined into one block
rather than floating separately.

---

## Editing a picture

`components/create/media/` — the editor (`MediaEditor`), the shader
(`FilteredImage`), what is drawn on top (`OverlayLayer`), the export
(`exportEdit`) — over the model in `lib/mediaEdit.ts`.

**Nothing is destroyed until Done.** The editor edits a *description* of
edits sitting beside an untouched original, so reopening a picture already
in the composer finds the crop where it was left and the filter still at
60%, rather than a flattened JPEG that can only be edited further by
damaging it again. The composer keeps both: the original for re-editing, the
rendered file for uploading.

- **The canvas is the crop window, in every tab.** One renderer, one frame:
  the aspect you chose with the picture panned and pinched behind it. Crop
  only adds the grid and hands the gestures to the picture; the other tabs
  hand the same gestures to what is drawn on it. So a filter is always
  judged on the composition you actually kept — which is why crop is first.
- **Five tabs, in the order a photograph is worked on**: what is in the
  frame, the look, the fine tuning, what you write on it, what you point at.
  Beauty filters, blemish removal and thirty presets are a different product.
- **A filter is a set of the same sliders the Adjust tab exposes**, plus a
  tint — never a baked LUT. Picking a preset can therefore never put a
  picture somewhere the manual controls cannot reach, and one Strength
  slider dials the whole thing back without unwinding each control.
- **Preview and export are the same arithmetic.** Both run `FRAGMENT` in
  `FilteredImage`: on screen in a `GLView`, on export in a headless context
  at full size. An editor whose output differs from what was on screen is
  the one bug an editor cannot have. GL rather than a tinted `View`, because
  React Native has no blend modes or colour matrix — an overlay can fake a
  tint and none of saturation, contrast, unsharp mask or vignette.
- **Three passes, each skipped when it is a no-op.** Geometry
  (`expo-image-manipulator`, natively and losslessly) → colour (one GL pass)
  → overlays (flattened with `captureRef`). A picture nobody edited comes
  back as the file that was picked, byte for byte: most posted pictures are
  untouched, and re-encoding all of them to serve the few that aren't is a
  tax nobody sees and everybody pays.
- **Straightening auto-crops.** A free rotation leaves transparent wedges in
  the corners; `inscribedRect` takes the largest upright rectangle that
  still fits. The alternative is publishing pictures with white triangles in
  them.
- **Positions are fractions of the picture, never points.** Words placed on
  a 340pt preview have to land in the same spot in a 1080px export, and a
  tag pinned to a jacket has to stay on the jacket at whatever width the
  feed draws it. The centring trick throughout is a full-size wrapper that
  centres its child and translates by `(x − 0.5) × W` — it puts an item's
  middle on the point without measuring the item.
- **Pinned tags are data, never paint.** A tag pinned to a spot rides along
  in the post's existing `tagged_products` JSON as a `pin` (image index plus
  x/y and which side the label opens toward), so it cost no migration, stays
  tappable, prices live, and can be removed later. Burning it in would make
  a shopping post a photograph of one. **The card under the picture still
  lists every tag**: a label on the picture is a shortcut, never the only
  way in.
- **Typing happens in a sheet, not on the picture** — a keyboard over the
  canvas hides the half you are writing on. Text carries a shadow rather
  than an outline (RN has no text stroke) or an optional plate, because
  white words on a bright sky are unreadable without one of them.
- **The filmstrip approximates; the canvas is the truth.** Thumbnails are
  the picture with a cheap tint over it rather than eight live GL contexts —
  a thumbnail's job is to say *warmer*, *cooler*, *flatter*, *grey*, and the
  real render is already on the canvas the moment one is tapped.
- **Positioning the picture runs on the UI thread.** The crop drag used to
  `setState` per frame, re-rendering the GL canvas, the overlays and five
  panels sixty times a second — so the picture lagged behind the finger by
  however long that took. The drag moves a transform through shared values
  and React hears about it once, on release, when the crop rectangle
  actually has to be derived. Anything dragged over a live GL surface has to
  work this way (§ Feedback and motion).
- **A field the keyboard can cover needs its exit somewhere else.** The text
  tool's Done and Cancel sat at the top of a *bottom-anchored* sheet, which
  the keyboard covered whole — and its field is multiline, so return makes a
  newline rather than finishing. That left no way off the screen at all. The
  bar is pinned to the top of the screen now, tapping the darkened area
  commits, and the tag sheet — same shape, same trap — rides above the
  keyboard on a `KeyboardAvoidingView`.
- **Three ways out of a text field, not one.** Done, Cancel, and the tap
  outside that every editor of this kind trains people to try. Multiline
  stays, because a caption on a photograph legitimately wraps; it is only
  acceptable *because* return is no longer the key that has to end it.
- **A failed export returns the original, with the description intact**, so
  a render that goes wrong loses a filter and never a photograph.
- **It previews on fixtures** — Dev Components › "Picture editor — edit,
  export, compare" — with the original and the exported file side by side
  and a list of which passes ran. Whether the export matches the preview is
  invisible until the two are next to each other, and a "no-op" edit that
  re-encoded anyway shows up in the same place.

---

## Teaching the app

`components/tutorial/`, `contexts/TutorialContext.tsx` and the tours in
`lib/tutorialTours.ts`, listed for replay in Settings › How Namzoed works.

**A tutorial is played, not read.** What this replaced was a carousel of
captioned screenshots with a Next under it, and everybody swiped it away
without reading a word — because the thing being described was never under
their finger while they were reading about it. A step here points at a real
control on the real screen and, wherever there is something to do, ends when
that control is *actually used*.

- **The hole is a hole.** The scrim is four panels — above, below, left and
  right of the control — never one sheet with a transparent patch, because a
  transparent patch still swallows the touch. The control keeps every one of
  its own touches, so the press that closes the step is the press that opens
  the menu. Everything else is covered, which is the other half: there is
  exactly one thing to do.
- **A step that can be finished by reading is a step that teaches nothing.**
  `advance: { on: "action" }` waits for the app to say the thing happened;
  `{ on: "next" }` is for a remark that has nothing to press, and a tour made
  only of those is a carousel with extra steps.
- **The instruction lives on the control, the reason lives in the card.**
  The card carries the tour's name, "3 of 4", a title and two lines — and
  either a Got it, or the sentence saying what to press. Never both: a Next
  beside a "press the plus" is permission to not press the plus.
- **A stray tap pulses the ring; it never dismisses.** Somebody tapping the
  scrim has not found the control yet, and a tutorial that vanishes on the
  first stray touch is one nobody finishes. **Skip** is a word in the same
  place on every step, and holding it turns the tips off for good — one
  control, two intentions.
- **A gesture gets a finger, not a sentence.** The context-drop step draws a
  hand travelling the first stretch of the drag, on a loop, on the UI thread,
  in the place the drag starts. "Swipe in from the left edge" is the
  instruction people read twice and still get wrong.
- **Nothing may trap the app.** A step whose control cannot be measured —
  never wrapped, or gone from the screen — degrades to the same card with no
  hole and *no scrim at all*. A spotlight with nothing lit and no way past
  is worse than no tutorial.
- **A React Native `Modal` is its own window**, so an overlay at the root is
  behind every one of them — and half of what these tours teach lives inside
  one. Each such surface mounts its own `TutorialOverlay` with a host id and
  only the topmost draws. A second card behind a modal is the bug this
  prevents.
- **Anchors are measured, not guessed**, and re-measured on a slow tick
  while their step is live: a control can arrive late in a sheet that is
  still opening, move with a list, or re-lay-out with the tab bar.
- **A tour auto-starts exactly once, ever.** `arrive(screen)` on the screen
  it belongs to; "seen" is written the moment it *starts*, not when it
  finishes, so walking away from one does not mean being ambushed by it
  tomorrow. Seeing it again is a deliberate act from Settings. One at a time,
  too — the first one gets to finish.
- **Nothing starts before the account is known.** This was the repeat nobody
  could explain: on a cold start `currentUser` is briefly null, so a tour
  would run, be marked seen against the `anon` key, and then be offered
  *again* the moment the real id arrived and its own empty record was read.
  A null user id now refuses to start anything.
- **The session keeps its own record**, beside the stored one. Two screens
  mounting in the same frame, or a screen remounting on a tab switch, can
  both announce themselves before a write has landed — so `startTour` marks
  the ref synchronously as well as persisting, and refuses a tour already
  started this launch.
- **The dev preview does not consume a tour's one airing** (`markSeen:
  false`). Looking at one in Dev Components must not rob the next fresh
  install on that device of it.
- **The plus tour is where the app says what it is for.** Namzoed is somewhere
  people follow people, and a new seller who lists twelve products before
  ever posting has a page nobody reads. The Post step says so plainly, once,
  at the moment the choice is being made — and the product tour ends on the
  same point rather than leaving it to be discovered.
- **Every tour is replayable and none is mandatory.** Settings lists them
  all, sends you to the screen the tour lives on, and starts it once that
  screen is in front — a spotlight on a screen still sliding in lands on
  nothing.
- **The mongoose is the guide, and its face follows the step.** Every
  tutorial card leads with `components/ui/Mascot.tsx` — keen where there is
  something to press, level where it is only explaining, puzzled on the
  gesture nobody guesses, startled where the drop lands. A face is most of
  what makes a walkthrough feel played rather than read, and it carries the
  same character from the first tip to the last. It sits *beside* the words,
  never over them, and every step has one: a guide that appears and
  disappears between steps reads as a bug rather than a character.
- **It previews on fixtures** — Dev Components › "Tutorials — spotlight on
  real controls" — because this is a thing you otherwise see once per
  account and then never again without clearing storage. The fixture runs the
  real tours through the real overlay against stand-in controls registered
  under the same anchor ids, including one low on the screen, so the card's
  flip above the hole can be seen doing it.

---

## Feedback and motion

- **Pull-to-refresh** uses `PullToRefresh` (the app's `CircularLoader` fading in
  as you drag), never the platform `RefreshControl` spinner.
- **Loading**: `CircularLoader` inline; `LoadingOverlay` for blocking work.
  Skeletons (`GridSkeleton`, `PostSkeleton`) for first loads of known layouts.
- **Screens paint from cache first.** `lib/queryCache.ts` — memory for the
  session, AsyncStorage across restarts, stale-while-revalidate on top. The
  feed, marketplace, categories, profile, messages and Setlog all seed from
  it, which is why they open with content rather than a skeleton.
- **A ranked grid keeps its order for the day.** `hooks/useRankedFeed.ts`:
  the order is drawn once per person per Bhutan day (ids only, from the
  `feed_order_*` functions), rows are fetched a page at a time as you scroll,
  and pull-to-refresh adds what was posted since on top without moving
  anything already there. Never reshuffle on open or on refresh — a new
  order puts photos the phone doesn't have at the top of the screen, and
  most people here pay for every one of them on mobile data. A reshuffle is
  only ever an explicit control (the service category's Shuffle button).
- **The cache is bounded, and that is not optional.** AsyncStorage on
  Android is one SQLite table with a ceiling around 6MB, and raising it
  needs a native rebuild — so a cache that only grows does not fail loudly,
  it starts losing writes silently, because every caller treats storage as
  best-effort. The budget is 3MB, entries over a week old are dropped at
  startup, and the oldest are evicted back under budget after every write.
- **Cache the head of a list, never the whole pool.** `CACHE_SEED_LIMIT`
  (60, four pages). A cached pool exists to paint the first screenful
  instantly, not to reproduce a ranking offline — the fetch that replaces it
  is already in flight before anyone scrolls that far. An entry over 900KB
  is kept for the session but not persisted, and says so in dev: one screen
  caching everything is one screen evicting every other screen.
- **The cache goes with the session.** `clearQueryCache()` on logout. It
  holds one account's rows, and for Setlog week-long signed URLs into a
  private bucket, which would otherwise outlive the account on a shared
  phone.
- **Dev Components shows what it is holding** — entries, kilobytes, and
  buttons to prune or clear. Cache growth that nobody can see is cache
  growth nobody fixes.
- **Every store on the phone is bounded, and the image cache was the one
  that wasn't.** `expo-image` defaults to no disk limit, which in an app that
  is mostly pictures means it grows until iOS decides the phone is full — and
  iOS only trims caches under genuine pressure, which is how apps end up as
  an opaque multi-gigabyte "Documents & Data" that people reinstall to
  escape. `lib/storageManager.ts` owns the caps for both media caches and
  `applyStorageLimits()` re-applies them at every launch, because
  `Image.configureCache` configures the process rather than the device.
- **Storage is a screen people can open, not a number they have to guess
  at.** `components/settings/DataStorage.tsx` (Settings › Data and storage)
  — the total, a stacked bar of what it's made of, and a per-type clear.
  RedNote's own control is a single Clear; Telegram's is clear-by-type plus
  hard caps. This takes the type breakdown and the caps.
- **Data saver is on by itself on mobile data.** `lib/dataSaver.ts`, the
  first row of Data and storage: *On mobile data* (the default), *Always*,
  *Never*. Default on, because the people it is for are the ones who will
  never go looking for it. "Mobile data" is the phone's verdict — cellular,
  or any connection the OS marks as metered, which is how a hotspot is
  caught. The row's description says what it is doing on *this* connection
  ("On now — you're on mobile data"), because a mode alone doesn't tell you.
  While it is on:
  - sized pictures are 1.5x at quality 60 instead of 2x at 70, read when the
    URL is built so nothing already on screen downloads again;
  - grids reveal half a screen ahead instead of one and a half;
  - an inline feed video is its poster and the 64pt play button until tapped
    (`components/post/VideoTapToPlay.tsx`). No player exists before the tap,
    because creating one — even paused — starts the download. A video with
    no poster shows black, never its first frame, for the same reason;
  - Reels gives a player only to the reel on screen, not the list window.
  The full-screen image viewer still loads the original: opening a picture
  is asking for it.
- **Caps, never "delete after a week."** Telegram offers both; age is the
  wrong axis in an app with Setlog in it, whose whole purpose is looking
  back — "oldest first" throws away precisely what the feature exists for.
  A budget with least-recently-used eviction keeps what you return to and
  drops what you don't, and the feed cache already expires on its own.
- **Each figure is measured from the thing that holds it, never estimated.**
  `getCurrentVideoCacheSize()` for video, a recursive walk of the cache
  directory for pictures, the real file listing for Setlog, the cache index
  for feed data. Vendor cache directory names are deliberately not
  hardcoded — they move between library versions, and a figure that silently
  reads zero is worse than one that is approximately right. Where two
  sources overlap, say which is exact: video is subtracted from the cache
  directory total because both libraries verifiably cache inside it.
- **A row that cannot lose anything does not ask.** Posts, drafts, messages
  and saved items live on the account, so the cache rows clear on one tap.
  Setlog clips are local originals and ask first, because clearing them
  costs real downloads. A confirmation on a harmless action is how people
  learn to tap through the ones that matter.
- **The size is the button.** A row reading "842 MB" that clears when tapped
  says both things in one control; a size plus a separate "Clear" spends two
  controls' width on one action. An empty store shows "None" in grey and
  isn't pressable — "0 B" reads as a measurement that failed.
- **The gap between a push and the screen it pushes to is covered.** The
  stack animates with `animation: "none"`, so a push into a heavy screen —
  chat above all — shows nothing at all for a beat: the screen you were on
  just sits there, and the tap reads as one that didn't take. It is worst
  after a `ContextDrop` "Contact Author"/"Message Seller" drop, where the
  gesture has already ended and the dome is gone, so nothing on screen is
  saying anything is happening. `beginNavHandoff()` immediately before the
  push and `endNavHandoff()` from the destination puts the standard
  `LoadingOverlay` over that wait — `utils/navHandoff.ts`, hosted once by
  `NavHandoffOverlay` in the root layout.
- **It is a module-level store, not a context, and it is hosted above the
  Stack.** The two ends of the handoff sit on opposite sides of a
  navigation: the screen that begins it is usually being replaced by the one
  that ends it, so no component spans both, and an overlay owned by the
  departing screen would vanish exactly during the wait it is there to
  cover. (`useAppRouter`'s debounce is module-level for the same reason.)
- **A wait under 120ms gets no overlay, and no wait holds the app.** The
  scrim only goes up once the navigation has visibly taken too long — one
  that fades in and straight back out is a flicker, and a push that was
  quick enough not to need explaining should not be explained. In the other
  direction a handoff nobody ends is dropped after 5s: a scrim that blocks
  every touch in the app is not something to leave to a callback that might
  not fire.
- **The destination ends it when it is the destination**, not when it
  mounts. Chat calls `endNavHandoff()` when `isLoadingPartner` clears, so
  the one wait stays one wait — ending at mount would hand it to that
  screen's own skeleton halfway through and put a flicker in the middle of
  it.
- **Never gate a whole screen on a spinner.** A screen renders its chrome on
  the first frame and each section reports its own state — the header fills in
  when its row lands, grids pass their own `loading` to `MasonryGrid` (which
  draws `GridSkeleton` from it), and images come in through `ProgressiveImage`
  on their blurhash. A full-screen spinner in front of a white page is what
  `app/(users)/profile/[id].tsx` used to do, and it hid six sequential round
  trips behind it.
- **Fetch in parallel, render as each lands.** Nothing waits on a request it
  doesn't use: fire every query together and let each one update its own
  slice. A chain of `await`s in one `loadData` is a screen that takes as long
  as the sum of its queries.
- **Result messages**: `PopupMessage`, not `Alert`. `Alert` is for destructive
  confirmations only. `PopupMessage` is `DialogCard` with a type on it — see
  § Dialogs for the shell and the one-filled-action rule both obey.
- **Between native modals**, always `await waitForIosModalDismiss()`
  (`utils/modal.ts`) before presenting the next one — on iOS a modal presented
  into another's dismissal never appears, and the promise behind it may never
  settle.
- **Around a system picker, `LoadingOverlay` must be `presentation="inline"`.**
  Its default is a native `Modal`, and one of those on screen when an
  `ImagePicker` is launched makes the picker fail to present silently, with its
  promise never settling (the screen spins forever); dismissing it to get out of
  the picker's way mid-presentation orphans its window and freezes every touch
  in the app. So: launch every picker through `presentSystemPicker`
  (`utils/modal.ts`), show the inline overlay over the wait before it appears,
  and switch to the modal one for the upload once an asset is in hand. The gap
  is never left bare — the user is back on the underlying screen by then, with
  nothing else to show their tap registered.
- **Optimistic writes**: switches and toggles move immediately and roll back on
  failure, rather than lagging a round trip behind the finger.

---

## Auth screens

Sign in, sign up, forgot password — `components/auth/AuthChrome.tsx` is the
shell all three wear, and none of them styles a field, a button or a back
chevron of its own.

They are three views of one moment, "prove who you are", and they used to be
three designs: one on white and one on the app background, one with the back
chevron floating absolutely in a corner and the others with none, `FormInput`
with a border on a grey field on some, and Ionicons, MaterialIcons and Entypo
between them. Sitting one tap apart, that drift shows in a single screenshot.

- **They follow § Form screens**: grey ground `#F9FAFB`, **white fields**. The
  field being lighter than the page is the entire separation — no borders.
  These screens had it inverted.
- **One filled thing per screen.** The primary action is a full-width filled
  button at the foot, and this is a **deliberate departure from § Header**,
  which says the primary action lives in the header and never as a full-width
  button. That rule is about content screens, where a header exists and the
  content is the point. An auth screen has no header, no content and exactly
  one thing to do; putting "Sign in" in a corner as text would hide the only
  reason the screen exists. The rule underneath it — one filled action — still
  holds.
- **The heading is one colour.** The old ones split "Welcome"/"Back!" and
  "Create an"/"Account" across the brand navy and the accent gold on two
  lines. That is colour carrying hierarchy, which § Icons and § People lists
  rule out everywhere else; weight and size do it here. The logo sits above
  the heading at 56pt rather than floating opposite it at 112.
- **A subtitle says what the screen wants**, so the instruction is not a
  bulleted aside below the field ("• We will send you an OTP…") or absent.
- **No screen title in the chrome.** The heading is directly beneath it and a
  bar repeating it would be the same word twice — so the header row carries
  the chevron and nothing else.
- **Icons are lucide, `#9CA3AF`, `strokeWidth` 1.8** (§ Icons: one weight, one
  colour per surface). The Google mark stays as its own SVG and Apple's stays
  white on black, because both are trademarks with rules of their own.
- **Disabled means dimmed, not greyed.** The button keeps its colour at 45%
  so it is still recognisably the way forward while it is not yet usable.
- **Consequences sit under the button that causes them.** The terms line moved
  beneath "Create account"; it also stopped naming a red "Register" button
  that says something else, in the app's one destructive colour.

- **A one-time code is one white box per digit** (`AuthCodeField`), no
  borders — the box holding a digit is marked by the digit, not by a heavier
  outline. It takes the screen's existing state and refs rather than owning
  them: the focus-advance and backspace behaviour already worked, and moving
  it inside would be rewriting working logic to change how it looks.
- **A countdown is grey until it nearly runs out**, red only under thirty
  seconds. Red from the first second is red nobody reads by the last, and
  § Colour keeps that hue for things that can actually go wrong.
- **A requirement says whether it has been met** (`AuthHint`): a `Check` that
  turns green, not a static red bullet. A rule that cannot tell you it is
  satisfied is a rule you re-read every time — and "your password needs six
  characters" is not a destructive event. This replaced two red bullets plus
  a separate "✗ Passwords don't match" line: three things saying what two
  ticks say, one of them with a glyph § Icons rules out.

## Form screens

The detail for single-purpose edit screens. `components/settings/EditBio.tsx` is
the source of truth for these values.

### Screen background

- Screen root: `bg-gray-50` (light grey), not white.
- Input field background: `bg-white` — the field is deliberately lighter than the
  screen behind it (inverse of the old pattern, which was white screen / grey field).
- The grey must extend behind the status bar, not stop at a white strip above it. If the
  screen is rendered inside a shared wrapper (e.g. `app/(users)/settings/index.tsx`),
  the wrapper's own top-inset container and any sliding sub-page container need to pick
  up the same `bg-gray-50`. That file's `SUB_PAGE_BACKGROUNDS` map is where a new
  sub-page declares its own ground — the settings areas are `#f5f5f5`, these form
  screens `#F9FAFB`, and the container behind the status bar reads from it.
- Status bar icons must be forced to `dark-content` on the screen itself
  (`<StatusBar barStyle="dark-content" />` from `react-native`), rather than relying on
  the global default — a screen mounted underneath in the stack may have set
  `light-content`, and RN's `StatusBar` merges props last-mounted-wins.

### Header

Three-part row:

- **Left:** `<ChevronLeft size={28} color="#374151" />` in a `py-1 -ml-1` button,
  calling `onClose`. These screens open from a row on a hub, so back is a level
  up, not a modal to cancel out of — the chevron matches the hub's own header and
  the direction the screen slid in from. (This was a grey "Cancel" text button
  originally; if you find one still saying Cancel, it predates this.)
- **Center:** screen title, absolutely centered against the row's full height (wrap it
  in an absolute `top:0,bottom:0,left:0,right:0` View with
  `justifyContent:"center", alignItems:"center"` — a bare absolutely-positioned `Text`
  does not center reliably against sibling buttons) — `text-xl font-medium text-gray-900`.
- **Right:** primary action as text, not an icon or full-width button —
  `text-xl font-medium`, color state-dependent:
  - Empty / no content to save: light blue `#93C5FD`
  - Has content: darker blue `#0369A1`
  - `disabled` when empty or while saving.
  - Loading state swaps the text for `<CircularLoader color="#094569" size="small" />`.
- Row container: `flex-row items-center justify-between px-4 pb-4 pt-2`. Buttons use
  `py-1` only (no horizontal padding) so their text baseline lines up with the centered
  title instead of drifting from extra side padding.
- No save button below the field. Save lives only in the header.

### Field

- Label above the field (e.g. "Bio") — removed. Don't add one back.
- Character/word counter — not above the field. Floats inside the field itself, bottom
  right corner: absolutely positioned `right: 12, bottom: 10` inside a `position:
  relative` wrapper around the `TextInput`. `text-xl text-gray-400`.
- `TextInput` / placeholder text size: `text-xl`.
- No border on the field (`border border-gray-200` removed). The `bg-white` vs
  `bg-gray-50` screen contrast is what separates it visually, not a border.
- Corner radius: `borderRadius: 12, borderCurve: "continuous"` — this is the app-wide
  `MODAL_RADIUS` constant from `constants/theme.ts`. Always pair a radius with
  `borderCurve: "continuous"` (Apple's squircle corner smoothing) — never a radius alone.

### Hub screens

`EditProfile` is not a form — it's the index for the ones above. One field per
screen, so each has a single Save and a single thing to get wrong.

- Photos are the only things edited on the hub itself: the profile photo is
  centered at the top with a white circular camera badge on its lower right, and
  the cover is a row with a 165x55 (3:1, the aspect it's cropped to) preview of
  the current one — big enough to read the photo in place without opening the
  viewer. Both save immediately on pick — no Save step.
- Tapping either photo opens the same full-screen viewer the profile screen uses
  (`ProfileImageViewer` / `CoverImageViewer`, black backdrop, X to close), and
  the camera-or-library choice lives on that viewer via its optional
  `onTakePhoto` prop — never a source-picker sheet stacked on top of it. Close
  the viewer first and launch the system picker from an effect, after
  `waitForIosModalDismiss()`.
- The header keeps the centered title with a `ChevronLeft` on the left, the
  same as the form screens it opens — the whole flow reads as one stack of
  screens rather than a hub plus a set of modals.
- Everything else is a row: label on the left (fixed `width: 96` so the values
  line up), current value right-aligned in `#6B7280` (`#9CA3AF` "Not set" when
  empty), `ChevronRight` at the end. Rows group into one white
  `MODAL_RADIUS` block, separated by `border-t border-gray-100`.
- There is **no** right action — nothing on the hub is saved from it. Keep the
  right-hand spacer so the title stays optically centered.
- Rows navigate by pushing another settings sub-page: the hub takes an
  `onNavigate?: (modal: string) => void` prop, wired to `handleNavigation` in
  `app/(users)/settings/index.tsx`, and every destination is registered in that
  file's `renderModalContent` switch and its `SUB_PAGE_BACKGROUNDS` map.
- The hub refetches the profile on mount. `currentUser` comes from
  AsyncStorage and can predate a column, which would show every row as
  "Not set".

### Multi-field screens

Some screens genuinely need more than one control (Birthday: a date, a
visibility switch, and a choice of what to show). Those follow the form rules
above, plus:

- Controls stack directly on the grey, separated by `marginTop: 12` — no cards,
  no section headers.
- Still no labels above fields; a placeholder or the row's own text carries it.
- Save's active state means "there is something to save": live only when the
  screen is **dirty** and required fields are filled. Unchanged = pale blue and
  disabled, same as an empty single-field screen.
- A multiline field with an in-field counter needs `paddingBottom` (~34) on the
  `TextInput` so the last line can't run under the counter.
- **A form presented as a modal is still a form screen.** Full height, grey
  ground, the same three-part header — not a blurred sheet with a full-width
  coloured button at the bottom. `components/modals/ReportUserModal.tsx` is
  the reference: `Modal` with `animationType="slide"`, `insets.top`/`bottom`
  padding, its own `dark-content` status bar (the screen underneath may have
  set `light-content`), and a `KeyboardAvoidingView` around the scroller.
  Submit is the header's text action, in the same two blues as Save — a
  destructive-sounding form does not earn a red button.
- **Choice fields are rows, not inline pickers.** A `<Picker>` can't match this
  styling on both platforms (squat wheel on iOS, spinner dialog on Android), so
  a choice renders as a white row — icon, current value in `text-xl` (`#111827`
  when set, `#9CA3AF` placeholder when not) — opening `BottomSheetModal` with
  the options as `text-xl` rows and a `Check` (`#0369A1`) on the selected one.
  A short list can instead render inline as a white block of selectable rows
  with the same `Check` (see EditBirthday).
- Explanatory copy goes *below* the control it explains, `text-base
  text-gray-400 mt-3 px-1`, never as a label above it.
- **A rule the screen can check as you type is shown as an `AuthHint`, not as
  a popup after you press.** `components/settings/ChangePassword.tsx` is the
  reference: three white password fields on the grey (no labels — the
  placeholder is the name, a `Lock` at `#9CA3AF`/1.8 leading, the eye as the
  trailing accessory), then `AuthHint` ticks for "at least 6 characters",
  "both new passwords match" and "different from your current one". Save is
  live only when all three are green, so the disabled action and the ticks
  are the same statement said twice on purpose — one says *that* you cannot
  continue, the others say *why*. It previously enforced every rule on press
  and answered with an error popup, which is the screen telling you at the
  end what it knew at the second keystroke. Importing `AuthHint` from
  `components/auth/AuthChrome.tsx` is deliberate: `app/reset-password.tsx` is
  the same moment on the auth side, and two screens that pick a password
  twice should not disagree about how a requirement looks.
- **Settings chrome, not auth chrome, for a password screen inside Settings.**
  Change Password wears the § Form screens header — chevron, centred title,
  Save as header text — not § Auth screens' full-width filled button. That
  departure is licensed only for screens with no header and exactly one thing
  to do, and a settings sub-page is neither.

---

## Legal documents

Terms of Service and Privacy Policy, through
`components/settings/LegalDocument.tsx`. A legal document is read, not
browsed, so it is a document: § Grounds' grey, § Groups and rows' white
blocks on it, § Header's chevron and centred title (via `SettingsScreen`),
and hierarchy from weight and size alone.

- **Numbered clauses, one icon colour.** The clause number is real
  information — it is how a document gets cited — so it stays, inline with
  the heading. The section icon is `#9CA3AF` at `strokeWidth` 1.8 for the
  whole document (§ Icons), not a coloured tile per section.
- **Sub-clauses are rows in the group**, separated by the standard inset
  hairline, not by a coloured left border or a tinted box each.
- **Colour is not a section marker.** These two documents between them used
  ten hues for eighteen sections — primary, secondary, blue, purple, green,
  indigo, red, orange, teal, pink — plus amber, green, red, blue and grey
  callout boxes. None of it carried meaning, and § Icons rules out exactly
  this. Where a contrast really is the point (what the platform does vs what
  it does not), a label says so: "What we do" / "What we do not do", not a
  green box against a red one with a tick and a cross in them.
- **No hero, no footer card.** Both were a navy panel with a badge in a
  translucent circle, and the terms' footer asked the reader to press an "I
  Agree" button that does not exist on the screen — it is opened read-only,
  from Settings and from a link on sign-up. The opening paragraph became the
  lede on the grey; the closing one went. What is left at the foot is the one
  fact a reader needs: "Last updated … · Version …".
- **The gradient trap.** Those tiles were `bg-gradient-to-br from-… to-…`.
  React Native has no gradient background and NativeWind drops the class, so
  every white icon in them was sitting on nothing, invisible on a white card.
  **There are no CSS gradients** — a real one is `expo-linear-gradient`, and
  a Tailwind gradient class in this codebase is always a bug.
- **Whoever presents them pays the top inset.** Inside Settings the sub-page
  stack already does; presented as a modal of its own (sign-up's terms link),
  wrap them in `SafeAreaView edges={["top"]}` over the same grey, so the
  ground runs behind the status bar rather than stopping at it.
- **A horizontal strip inside the home feed is a `ScrollView` with
  `removeClippedSubviews={false}`, never a nested `FlatList`.** The home
  screen's vertical list runs with `removeClippedSubviews` on, which detaches
  a nested horizontal list's children while the row itself stays laid out —
  the strip keeps its full height and draws nothing. It is the worst class of
  visual bug to chase: no error, no failed request, the data present and the
  component correct, just a white band where the content is. `Banner.tsx` sat
  like that above the feed; the ForYou and closing-sale rows had already been
  moved to plain `ScrollView`s with the flag explicitly off, so the fix was to
  finish the job. Virtualising a strip whose entire data set is what one
  screen shows was never buying anything.
- **A slot that reserves height paints something while it waits.** The banner
  carries a neutral `#EFEFEF` ground under the image and drops any banner
  whose image fails, so the space reads as loading or is not there at all —
  never as a blank white box the size of content. A reserved slot showing the
  page's own background is indistinguishable from a bug, including to whoever
  wrote it.
- **A setting that changes nothing is worse than no setting.** Appearance
  offered four badge-tier gradient "chat bubble styles" with a live preview
  of each, gated by which badge you owned. None of them did anything: the
  chat screen destructured `bubbleSkin` from the appearance context and
  never read it, because the gradient bubble rendering had been taken out of
  the message list and the control was left behind. The user-visible result
  is the worst available — you make a choice, the app saves it, nothing
  changes, and the honest conclusion to draw is that you were ignored. The
  section is gone, along with `bubbleSkin` in `AppearanceContext` and the
  dead read in the chat screen. **A control ships after the thing it
  controls, never before**; if a feature is removed, its setting goes in the
  same change.
- **One selection mark, and colour is not it.** The badge list marked the
  active row with a coloured border, a tinted card background, *and* a
  filled "ACTIVE" pill in the tier's accent — three signals in a colour that
  also means something else (the tier), on a row that already shows the
  badge. It is the `Check` in `#0369A1` now, the same one EditBirthday,
  Tutorials and every other list under Settings uses. § Icons rules out
  colour as a marker and a badge list is where that earns its keep: the hue
  belongs to the badge, so spending it on state leaves you hunting for which
  row is on.
- **A placeholder screen is a bug with a nice icon.** Community Guidelines
  and Help articles both shipped as a centred glyph over "…will be displayed
  here", under a hand-rolled header (`ArrowLeft`, left-aligned title, a
  bottom border) that matched nothing else under Settings. Two costs, and the
  second is the expensive one: the screen is empty, *and* it is a second
  chrome nobody will remember to keep in step. A screen with no content yet
  still wears `SettingsScreen`/`LegalScreen` and says what it will hold.
  No screen under Settings is in this shape any more; the last one was
  `SellerPolicy.tsx`.
- **A marketplace has rules for both sides of the counter.** Legal carried a
  Seller Policy and nothing for buyers, which reads as a platform that
  polices one party and leaves the other to find out. `BuyerPolicy.tsx` and
  `SellerPolicy.tsx` are written in parallel — payment is section 5 in both,
  "when it goes wrong" section 7 in both — so the same transaction can be
  read from either side and the two cannot quietly drift into contradicting
  each other. Both stop where the Terms stop: NamZoed is not a party to the
  sale and holds nobody's money, so neither document promises a refund, an
  escrow or an arbitration there is no mechanism for. **Say what the app
  cannot do plainly and early** — the Buyer Policy's first section is exactly
  that, because a buyer who knows there is no escrow behaves differently at
  the moment it matters, and a document that lets them assume otherwise has
  done them harm. Where a rule is a community rule applied to selling, both
  point at the Guidelines instead of restating it; two documents wording the
  same rule differently is worse than one of them being shorter.
- **Community Guidelines is a legal document, so it is built like one.** It
  uses the `LegalDocument.tsx` kit — numbered sections, one icon colour, the
  lede on the grey, "Last updated … · Version …" at the foot — because it is
  the third document reached from the same lists and arriving somewhere that
  looks unrelated is how people lose the thread. Every section maps to a
  mechanism that exists (the report sheets and their reasons, the composer's
  content ratings, listings, reviews, live, Mongoose); a rule with nothing
  behind it teaches people the list is decoration and they stop reading it.
- **Help articles are questions, and they open in place.** A row reading
  "Listings" tells you nothing about whether your question is behind it;
  "Why can nobody see my listing?" is either yours or it isn't, and you know
  at a glance. Answers expand inside the card (220ms `easeInEaseOut`, the
  same ease `ProductReviews`/`InlineComments` use, chevron rotating 180°) —
  a three-line answer given its own pushed screen charges a navigation to
  read it and another to check the next one. **One open at a time**: a column
  of everything expanded is the wall of text the screen exists to avoid. The
  whole screen is one `ARTICLES` array, so a new article is an entry — no
  component, no route, no case in the settings switch. An answer that grows
  past a screenful stops being an article and becomes a `LegalDocument`.
- **A sub-page that moves onto the settings grey must update its entry in
  `SUB_PAGE_BACKGROUNDS`** (`app/(users)/settings/index.tsx`), or the bands
  above and below it stay the colour it used to be. Converting a placeholder
  to settings chrome is always two edits — see § Grounds for why that map is
  exhaustive rather than defaulted.
- **A shortcut into Settings opens the hub its Settings row opens, not a page
  inside it.** `?modal=<name>` (`app/(users)/settings/index.tsx`) seeds the
  sub-page stack with a single level, and closing it leaves Settings
  altogether rather than revealing a list the user never browsed to — so
  landing a level too deep strands them with no way to reach the siblings.
  The drawer's **Help center** passes `modal=support`
  (`components/settings/SupportSettings.tsx`, titled "Help Center", with Help
  articles / How Namzoed works / Contact us / Send feedback), which is exactly
  what the Settings list's own Help Center row pushes; it passed
  `modal=helpCenter`, the articles page one level inside that, and the same
  button in two places showed two different screens. **A shortcut's target is
  whatever `onPress` the equivalent Settings row calls `handleNavigation`
  with — copy that string, don't pick the one whose name matches the label.**

---

## Setlog's day header

- **Export, settings and join are icons above the day, not rows below the
  feed.** They were a white group of labelled rows at the foot of the list,
  which put the two most occasional things in Setlog — a settings screen, and
  a code you are given once — at the bottom of a feed you have to scroll past
  everything to reach, drawn with the visual weight of content. They are
  chrome for the day above them, so they sit with it
  (`FeedActions` in `components/setlog/SetlogFeed.tsx`).
- **The export icon is a `Film`, not a share arrow.** That screen makes a
  reel and a collage of the day; the OS share sheet is one tap further on,
  inside it. An arrow there promises the share menu and delivers an editor.
- **Icon-only is a real cost, and it is only payable by a short, fixed set.**
  A glyph with no label is learnable, not self-explanatory; three of them,
  always in the same order, always in the same place, is learnable in one
  use. A growing or reordering set is not, and this is where "just add
  another icon" stops being free. **Every icon-only control carries an
  `accessibilityLabel`** — dropping the visible label is a visual decision and
  must not become an unusable screen for anyone reading it aloud, so the
  label that left the screen is the one the reader hears.
- White circles on the feed's grey, matching the cards' relationship to the
  same ground — chrome that belongs to the surface rather than a toolbar
  floating over it.

---

## The day collage

`components/setlog/DayCollage.tsx` for the picture, `lib/collageLayout.ts`
for the arrangement, `app/(users)/setlog/collage.tsx` for the editor.

- **The reel is stitched on the phone, by the platform's own encoder.**
  `modules/setlog-stitcher` — AVFoundation (`AVMutableComposition` +
  `AVAssetExportSession`) on iOS, Media3 Transformer (`Composition` +
  `EditedMediaItemSequence`) on Android. It replaced a Node worker running
  ffmpeg, which meant a host, a service-role key, a queue, and no reel at all
  until somebody deployed one. The usual React Native shortcut — ffmpeg-kit —
  was retired in January 2025 and its binaries pulled, so the real choice was
  a server or the platform APIs, and both platforms have one built for
  exactly this job and hardware accelerated besides. It is now faster than
  the thing it replaced, and it works on a plane.
- **The reel fills the frame too**, and by the same reasoning as the collage:
  `max` instead of `min` on the fit ratio on iOS, `LAYOUT_SCALE_TO_FIT_WITH_CROP`
  on Android. Aspect is never distorted; the overflow is cropped from the
  centre and simply not drawn. Letterboxing every portrait clip into a
  portrait frame made the background most of the picture. The background
  colour still exists for the gap between panes and the occasional sliver —
  it is a ground, not a mat.
- **Two native implementations answer to one JS contract, and anything only
  one of them can do is clamped in that contract.** Multi-pane composition is
  written on iOS and not on Android, so `stitchReel` pins `split` to 1 for
  both and the editor offers one layout — a reel that arrives three-up on one
  phone and one-up on the other is worse than one that is the same
  everywhere. The clamp lives in the single place both platforms pass
  through, never in one of them.
- **A `require`d asset is not a file.** The watermark is resolved through
  `expo-asset` to a `file://` URI before it is handed over: in a release
  build a bundled image lives inside the app package, and neither encoder can
  open a bundle reference.
- **Code that can only run in an environment you do not have still has to be
  runnable in the one you do.** The ffmpeg worker shipped having never once
  executed, and it did not work: its filter graph joined the stream labels
  into the comma-separated chain (`[0:v],scale=…,…,[p0]`), and a comma beside
  a label declares an empty filter, so ffmpeg rejected every graph with
  `No such filter: ''`. `render-worker/build-segment.test.js` runs the real
  encoder over generated clips in ten seconds on a laptop, with no Supabase,
  no queue and no host. The same rule applies to the native module: the iOS
  composition typechecks against the real SDK without a device, and the parts
  that cannot be checked that way are the parts to be sceptical of.
- **The export fills the frame, and the crop that costs is measured, shared
  and capped.** This reverses the rule that stood here — "nothing is cropped,
  ever" — and the reversal was asked for after seeing it: holding the block
  inside a 22pt margin with a 40pt caption band under it and centring the
  remainder meant a collage arrived as a small picture in a large field of
  background. Filling a fixed frame with photographs of whatever shape the
  phone was held in **cannot** be done without losing some of them; that is
  geometry. What the layout owes is to lose as little as possible:
  - the arrangement is chosen to need the least stretch (§ coverage score);
  - stretching the block to the frame's height multiplies every row by the
    same factor, so **every cell is cropped by exactly the same proportion**
    — no photo takes the hit for the others;
  - past `MAX_CROP` it stops and leaves an even band instead.
  `MAX_CROP` is 2.0 because it was measured, not chosen: across realistic
  aspect mixes the ceiling buys 44% edge-to-edge at 1.25, 79% at 1.5, 91% at
  1.8 and 98% at 2.0, and the curve flattens there — beyond it you buy 2%
  more bleed by allowing a photo nobody would recognise. **A constant that
  trades one good thing against another is a measurement, and the table
  belongs next to it** (`lib/collageLayout.ts`).
- **What the original grid did is still wrong**, and this is not a return to
  it: nine square cells on `cover` cropped every photo to a square
  regardless, which is a fixed shape imposed on the day. The crop here is
  whatever is left after the arrangement has done its best, it is the same
  for every photo, and it is bounded.
- **The caption goes over the photographs, never in a band of its own.** Date,
  count and mark sit on a short bottom scrim; a solid strip would be the
  margin coming back under a different name. The type carries its own shadow
  rather than depending on a light or dark ground, the same trade `ClipStamp`
  makes over a clip.
- **Square corners and no outer margin at full bleed.** A rounded corner at
  the frame's edge leaves a wedge of background in each corner of the
  exported file, which reads as a mistake rather than as a radius. The gap
  between cells stays as a thin rule of background — with no margin left, it
  is the only thing separating one photo from the next.
- **The photos decide the shape, not a grid.** Rows are contiguous runs in
  the order the photos were taken; everything in a row shares a height, and
  that height is whatever makes the row exactly as wide as the block
  (`h = (W − gaps) / Σ aspect`). **Order is never rearranged** — reading
  order is chronological order, which is the only reason a day is worth
  exporting as one picture, and masonry columns (shortest-first) would
  scatter the morning through the afternoon.
- **Pick the row count by coverage, not by nearest height.** A set of row
  breaks fixes the block's *proportions*, so each candidate is a candidate
  shape and the best one is whichever is closest to the frame's — scored as
  `min(h, H) / max(h, H)`. Scoring by "whose height is nearest" instead
  looks equivalent and is not: a block slightly too tall scales down and
  still covers most of the frame, while one far too short cannot be scaled up
  without overrunning the sides. That mistake laid six portrait photos out as
  one thin strip covering 36% of a landscape canvas where two rows cover 67%.
- **Two frames, portrait 4:5 and landscape 3:2.** Portrait is the tallest a
  feed post can be before the platform crops it for you, which is the whole
  point of choosing it; landscape is the photographic shape, for a day that
  was mostly wide. Same layout at two proportions, not two designs.
- **Whatever is left over is an even mat, not a gap at the bottom** — the
  block is centred both ways. A generous mat is what a framed print looks
  like, and it is the honest price of not cutting anything; the alternative
  is a crop.
- **Measure before laying out.** The editor asks `Image.getSize` for every
  file once it is on disk and renders only then. Assuming square and
  correcting on load would reflow the collage under the recorder's hands, and
  a photo drawn at the wrong ratio is the one thing this is supposed to make
  impossible. A file that will not report its size is treated as square, and
  ratios outside 0.4–2.6 are clamped — those are measurement failures, and
  one loose in a row squashes every photo beside it.
- **The `ViewShot` must carry the collage's exact size.** `captureRef`
  captures the view's own laid-out frame, and a `ViewShot` with no size is a
  flex child like any other: nested in the scaled preview box it was
  stretched to `PREVIEW_W` (~361pt) while `DayCollage` inside it drew at its
  real 540, so the exported file came out 1083×2025 instead of 1620×2025 and
  everything past 67% of the width was cut off. It went unnoticed for as long
  as the collage was a square 3-column grid, because losing the right-hand
  column just looked like the grid; two photos in a row cut one of them in
  half. **Anything captured at a size other than the size it is previewed at
  states its own width and height**, on the `ViewShot` and on every parent
  between it and the transform. A `__DEV__` check compares the captured
  file's aspect to the frame's and warns, because the failure is silent
  otherwise and looks like a design decision.
- **No columns/rows stepper.** There is no grid to set any more, so the
  editor offers the two things still open: the shape, and how much of the day
  goes in. What is left out is said plainly, never dropped silently.

---

## Judging a screen before the data exists

A feature whose look depends on data someone would have to create by hand —
several services, one business of each type, a seller with and without
ratings — gets a fixture-driven preview in **Settings › Dev Components**,
under its SCREENS section.
`components/dev/BusinessProfilePreview.tsx` is the reference;
`components/dev/EditBusinessPreview.tsx` is the second, and covers the
license states — "being reviewed" and "verified" are set by a reviewer,
not by the seller, so the only other way to see those screens is to edit
`verification_status` by hand in Postgres.
`components/dev/AddFriendsPreview.tsx` is the third: every state of the
QR flow needs two accounts and a second phone to reach otherwise.
`components/dev/CollagePreview.tsx` is another: what decides a collage's
arrangement is the mix of aspect ratios in a day, and the awkward mixes —
six portraits in a landscape frame, one panorama among squares, a single
tall photo — take a day of shooting to produce and would never be made on
purpose. Its cells are empty wells at their true shapes rather than stock
photographs, because a fixture that pasted images into cells would crop them
to the cell and hide the one bug the screen exists to catch.
`components/dev/AppearancePreview.tsx` is another: which early-access
badges you own is set by a backfill against named accounts, so on any
normal test account Appearance has exactly one state — the empty one — and
"none", "one" and "all four" are three different screens.
`components/dev/MessagesListPreview.tsx` is the fourth, and covers the
conversation row — an unread count, an unsent draft, a muted thread and a
name long enough to collide with the timestamp are all things you cannot
conjure in your own inbox on demand.
The composer's attachment card is previewed in Dev Components itself rather
than in a screen of its own — one fixture per kind, on the pill's own grey,
with the collapse on a button, because what it looks like is a question of
which of its four lines the source fills in (§ Sharing something into a
chat).

- **Compose the real components, never lookalikes.** A preview built from
  copies tells you how the copies render, and it won't break when the real
  screen changes — which is the only thing that keeps it worth trusting.
- Give it controls for the axes that change the *layout*, not every prop:
  business type, verified or not, owner or visitor.
- **Start a preview where the user starts.** The business profile is reached
  from the personal one, so the preview opens there and taps through —
  previewing the destination alone skips the step where you find out whether
  the card leading to it says anything useful. That is how the "N services"
  problem above was found.
- **Include the empty states**, and make them togglable rather than the only
  thing shown. They're what most users see first and the least likely to have
  been looked at — but a preview that can *only* show empty is no use for
  judging the populated case, which is the one being designed.
- If a component fetches its own data, split it: a presentational view taking
  props, and a thin wrapper that fetches and renders it (`ShopReviews` /
  `ShopReviewsView`). The preview then exercises the real presentation
  without a database, and production keeps one call site.
- **A component that owns form state takes a `preview` stand-in instead of
  being split.** Splitting works when the view is a function of fetched data;
  a sheet whose state is what the user is half-way through typing would need
  a dozen props threaded through to say the same thing. So `SellerRatingSheet`
  (and `BusinessProfileHeader` before it) takes one optional prop that stands
  in for the round trips — supplying what the fetch would have returned, and
  making the write a no-op. Presence of that prop is the whole switch: there
  is no second code path to keep in step, and a preview still cannot touch
  the database.
- **Fixtures should not be uniformly good.** All-five-star ratings hide how a
  mixed set reads and leave the dimension row showing three identical
  numbers; include a poor one, one with no comment, and a value that
  exercises formatting (a 1,250,000 price, for `compactPrice`).

---

## Screens still to migrate

These predate the standard and are the reason it exists. Each should move to the
patterns above; they're listed roughly in the order they'd pay off:

- **Profile** (`app/(users)/profile/index.tsx`, `[id].tsx`) — grids are already
  `MasonryGrid` and the public profile's "..." sheet has moved to the action
  sheet pattern above, but the header stack (cover gradient, matte panel,
  stats, action cards) is bespoke and heavily layered. Simplify toward: cover,
  avatar, name, one metadata line, one row of actions, plain-text tabs.
- **Feed grid / cards** (`components/FeedPost.tsx`, home grid) — bring the card
  footer, radii and type in line with `GridCard`, and drop per-card colour.
- **`ContextDrop`** — the gesture and dome are right; what it wraps isn't yet.
  Revisit once the detail screens below are migrated.
- **Post details** (`components/PostDetailOverlay.tsx`, `app/(users)/post/[id].tsx`)
  — media-first layout, author row, pill tags, fixed action bar, per the Detail
  screens section.

## Keeping this accurate

Update this file in the same change that alters the UI — a new pattern, a
different accent, a new radius, a different row height, a screen migrated off
the list above. Not afterwards, and not "when it settles": the next change is
built against whatever this says, so an unrecorded decision gets quietly
reverted by the following one.

A standard that drifts from the code is worse than none, because it gets cited.

When a value here changes, also update the reference implementation named for
that pattern — the table at the top points at real files, and those files are
what get copied.

