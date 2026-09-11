/**
 * DevComponents ("DevComp")
 *
 * Dev-only playground for previewing shared UI elements — loading
 * indicators, popups, overlays — in their different states without having
 * to dig up real data to trigger them. Only reachable from Settings when
 * __DEV__ is true (see app/(users)/settings/index.tsx) — never shown in a
 * prod bundle.
 *
 * Add new sections here as more reusable components need a place to preview
 * their states: a SectionHeader + a row of trigger buttons is the pattern.
 */

import CircularLoader from "@/components/ui/CircularLoader";
import LoadingBar from "@/components/ui/LoadingBar";
import AddFriendsPreview from "@/components/dev/AddFriendsPreview";
import AppearancePreview from "@/components/dev/AppearancePreview";
import CollagePreview from "@/components/dev/CollagePreview";
import BusinessProfilePreview from "@/components/dev/BusinessProfilePreview";
import StoragePreview from "@/components/dev/StoragePreview";
import SellerRatingSheet from "@/components/SellerRatingSheet";
import MessagesListPreview from "@/components/dev/MessagesListPreview";
import SetlogPreview from "@/components/dev/SetlogPreview";
import TutorialPreview from "@/components/dev/TutorialPreview";
import MediaEditorPreview from "@/components/dev/MediaEditorPreview";
import {
  clearQueryCache,
  pruneQueryCache,
  queryCacheStats,
} from "@/lib/queryCache";
import {
  clearMediaCache,
  enforceBudget,
  mediaCacheStats,
} from "@/lib/setlogMediaCache";
import EditBusinessPreview from "@/components/dev/EditBusinessPreview";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import ComposerContextCard, {
  type SharedContextMeta,
} from "@/components/chat/ComposerContextCard";
import AvatarStylePicker from "@/components/modals/AvatarStylePicker";
import TaggedProductsCard from "@/components/post/TaggedProductsCard";
import PriceSanityNote from "@/components/ui/PriceSanityNote";
import SellingIntentSuggestion from "@/components/post/SellingIntentSuggestion";
import LiquidCreateMenu from "@/components/create/LiquidCreateMenu";
import { detectSellingIntent } from "@/lib/sellingIntent";
import { checkPrice, detectPriceBand, formatNu } from "@/lib/priceSanity";
import type { TaggedProduct } from "@/types/post";
import ChatSharedContent, {
  type ChatSharedTab,
} from "@/components/chat/ChatSharedContent";
import type {
  ChatLinkItem,
  ChatMediaItem,
  ChatVoiceItem,
} from "@/lib/chatDetails";
import GeneratedAvatar from "@/components/ui/GeneratedAvatar";
import { DEFAULT_AVATAR_STYLE, dicebearPngUrl } from "@/lib/dicebear";
import { Image as ExpoImage } from "expo-image";
import { beginNavHandoff, endNavHandoff } from "@/utils/navHandoff";
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import PrivacyPolicy from "@/components/settings/PrivacyPolicy";
import TermsOfService from "@/components/settings/TermsOfService";
import PopupMessage from "@/components/ui/PopupMessage";
import PostFeedbackOverlay from "@/components/modals/PostFeedbackOverlay";
import PostGridReportOverlay from "@/components/modals/PostGridReportOverlay";
import { ArrowLeft, FlaskConical } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

interface Props {
  onClose: () => void;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 12, marginTop: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.6, color: "#9ca3af" }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function Swatch({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      {children}
      <Text style={{ fontSize: 11, color: "#6b7280" }}>{label}</Text>
    </View>
  );
}

function TriggerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderCurve: "continuous",
        backgroundColor: "#f3f4f6",
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#111" }}>{label}</Text>
    </TouchableOpacity>
  );
}

type PopupKind = "success" | "error" | "warning" | "white" | null;

/** A conversation with a year behind it — the only state where the media
 *  grid's gutters, the link rows and the empty tabs can be judged at all. */
const CHAT_MEDIA_FIXTURES: ChatMediaItem[] = [
  "photo-1506905925346-21bda4d32df4",
  "photo-1470071459604-3b5ec3a7fe05",
  "photo-1441974231531-c6227db76b6e",
  "photo-1501785888041-af3ef285b470",
  "photo-1439066615861-d1af74d74000",
  "photo-1426604966848-d7adac402bff",
  "photo-1418065460487-3e41a6c84dc5",
].map((id, i) => ({
  id: `m${i}`,
  url: `https://images.unsplash.com/${id}?w=400`,
  kind: i === 2 ? "video" : "image",
  createdAt: new Date(2026, 7, 20 - i * 3).toISOString(),
  mine: i % 3 === 0,
}));

const CHAT_LINK_FIXTURES: ChatLinkItem[] = [
  {
    id: "l1",
    url: "https://www.bhutan.travel/trek/snowman-trek",
    text: "This is the one I meant https://www.bhutan.travel/trek/snowman-trek",
    createdAt: new Date(2026, 7, 18).toISOString(),
    mine: false,
  },
  {
    id: "l2",
    url: "https://maps.google.com/?q=27.4712,89.6339",
    text: "https://maps.google.com/?q=27.4712,89.6339",
    createdAt: new Date(2026, 6, 2).toISOString(),
    mine: true,
  },
];

const CHAT_VOICE_FIXTURES: ChatVoiceItem[] = [];

/** The three shapes a tagged item comes in: a product at full price, one on
 *  discount, and a service — which has no price at all and has to say so
 *  without reading as free. */
const TAGGED_PRODUCT: TaggedProduct = {
  id: "p1",
  kind: "product",
  name: "Handwoven kira, raw silk",
  price: 8500,
  image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=200",
  owner_name: "Tashi Weaves",
};

const TAGGED_DISCOUNTED: TaggedProduct = {
  ...TAGGED_PRODUCT,
  id: "p2",
  name: "Bhutanese cedar incense, 40 sticks",
  price: 1200,
  current_price: 890,
  is_currently_active: true,
  discount_percent: 26,
  image: "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=200",
  owner_name: "Norbu Crafts",
};

const TAGGED_SERVICE: TaggedProduct = {
  id: "s1",
  kind: "service",
  name: "Airport transfer, Paro to Thimphu",
  image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=200",
  owner_name: "Karma Dorji",
};

/** One of each kind the composer's attachment card has to carry — the card
 *  is four lines of text around a picture, so what it looks like is
 *  entirely a question of which of those lines the source actually
 *  populates. A profile has no price, a post has no seller. */
const COMPOSER_CONTEXT_FIXTURES: Record<string, SharedContextMeta> = {
  post: {
    id: "p1",
    title: "Karma Dorji's post",
    source: "post",
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
    caption:
      "Walked up to the monastery before sunrise. Worth every one of those steps — the whole valley was under cloud.",
    date: "2026-08-14T04:12:00.000Z",
    location: "Paro",
    username: "karma.dorji",
    isVerified: true,
  },
  product: {
    id: "pr1",
    title: "Handwoven kira, raw silk",
    source: "product",
    price: "8,500",
    imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400",
    caption: "Woven in Lhuentse, three months on the loom. One of a kind.",
    date: "2026-07-02T09:00:00.000Z",
    username: "Tashi Weaves",
    isVerified: true,
  },
  marketplace: {
    id: "m1",
    title: "Room for rent, Changzamtog",
    source: "marketplace",
    price: "12,000",
    caption: "Furnished single room, own bathroom, walking distance to town.",
    date: "2026-09-01T09:00:00.000Z",
    location: "Thimphu",
    username: "Sonam Wangmo",
  },
  profile: {
    id: "u1",
    title: "Pema Lhamo",
    source: "profile",
    imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
    caption: "Photographer. Thimphu, mostly.",
    username: "pema.l",
    isVerified: true,
  },
};

export default function DevComponents({ onClose }: Props) {
  const [popup, setPopup] = useState<PopupKind>(null);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [composerContext, setComposerContext] =
    useState<SharedContextMeta | null>(COMPOSER_CONTEXT_FIXTURES.post);
  const [showAvatarStyles, setShowAvatarStyles] = useState(false);
  const [sharedTab, setSharedTab] = useState<ChatSharedTab>("media");
  const [sharedFull, setSharedFull] = useState(true);
  const [priceText, setPriceText] = useState("Alto car 2012, good condition");
  const [priceValue, setPriceValue] = useState("100");
  const [sellText, setSellText] = useState("Selling my Alto 2012, Nu 250,000 negotiable");
  const [sellVerified, setSellVerified] = useState(false);
  const [showLiquidMenu, setShowLiquidMenu] = useState(false);
  const [showBusinessPreview, setShowBusinessPreview] = useState(false);
  const [showStoragePreview, setShowStoragePreview] = useState(false);
  const [showAppearancePreview, setShowAppearancePreview] = useState(false);
  const [showCollagePreview, setShowCollagePreview] = useState(false);
  // Two states worth seeing, because they are different sheets: a first
  // rating starts blank and says "Submit", an edit arrives filled in and says
  // "Update". Nothing here touches the database — see the sheet's `preview`.
  const [ratingSheet, setRatingSheet] = useState<"none" | "blank" | "edit">("none");
  const [showEditBusinessPreview, setShowEditBusinessPreview] = useState(false);
  const [showAddFriendsPreview, setShowAddFriendsPreview] = useState(false);
  const [showSetlogPreview, setShowSetlogPreview] = useState(false);
  const [showTutorialPreview, setShowTutorialPreview] = useState(false);
  const [showMediaEditor, setShowMediaEditor] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [legalDoc, setLegalDoc] = useState<"terms" | "privacy" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cacheStats, setCacheStats] = useState<{
    entries: number;
    bytes: number;
  } | null>(null);
  const refreshCacheStats = useCallback(() => {
    queryCacheStats().then(setCacheStats).catch(() => {});
  }, []);
  useEffect(() => {
    refreshCacheStats();
  }, [refreshCacheStats]);
  // Setlog's media store: the thing that decides whether a clip from three
  // weeks ago opens instantly or is fetched again.
  const [mediaStats, setMediaStats] = useState<{ files: number; bytes: number } | null>(
    null,
  );
  const refreshMediaStats = useCallback(() => setMediaStats(mediaCacheStats()), []);
  useEffect(() => {
    refreshMediaStats();
  }, [refreshMediaStats]);
  const [showMessagesPreview, setShowMessagesPreview] = useState(false);
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState(false);
  const [showGridOverlay, setShowGridOverlay] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#f0f0f0",
        }}
      >
        <TouchableOpacity onPress={onClose} style={{ marginRight: 12, padding: 4 }}>
          <ArrowLeft size={22} color="#111" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111", letterSpacing: 0.4 }}>
            Dev Components
          </Text>
          <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
            UI playground — dev builds only
          </Text>
        </View>
        <FlaskConical size={18} color="#7c3aed" />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Circular loader ─────────────────────────────── */}
        <SectionHeader
          title="LOADING — CIRCULAR"
          subtitle="Bounce trio — the app's standard loading indicator, flat 1x everywhere"
        />
        <View style={{ flexDirection: "row", gap: 24, marginBottom: 24 }}>
          <Swatch label='size="small"'>
            <CircularLoader size="small" speed={1} />
          </Swatch>
          <Swatch label='size="large"'>
            <CircularLoader size="large" speed={1} />
          </Swatch>
          <Swatch label="custom color">
            <CircularLoader size="large" color="#EDC06D" speed={1} />
          </Swatch>
          <Swatch label="on dark">
            <View style={{ backgroundColor: "#111", padding: 10, borderRadius: 8 }}>
              <CircularLoader size="small" color="#fff" speed={1} />
            </View>
          </Swatch>
        </View>

        {/* ── Loading overlay ──────────────────────────────── */}
        <SectionHeader
          title="LOADING — OVERLAY"
          subtitle="Small rounded card, centered on screen — used for async work with no natural place of its own to show progress (image picker opening, an upload before its success popup, the wait between a push and a heavy screen)"
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24 }}>
          <TriggerButton
            label="Preview (2s)"
            onPress={() => {
              setShowLoadingOverlay(true);
              setTimeout(() => setShowLoadingOverlay(false), 2000);
            }}
          />
          {/* The same overlay driven the way a navigation drives it — the
              only way to feel the delay before it appears, which is the
              whole design of the handoff (utils/navHandoff.ts). */}
          <TriggerButton
            label="Nav handoff (1.5s)"
            onPress={() => {
              beginNavHandoff();
              setTimeout(endNavHandoff, 1500);
            }}
          />
          <TriggerButton
            label="Nav handoff (80ms — no overlay)"
            onPress={() => {
              beginNavHandoff();
              setTimeout(endNavHandoff, 80);
            }}
          />
        </View>

        {/* ── The "+" opening as liquid ────────────────────── */}
        <SectionHeader
          title="CREATE — LIQUID MENU"
          subtitle="The tab bar's yellow circle separating into four droplets. Opens where the real + sits, so this is also the check that the geometry lines up on this device."
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24 }}>
          <TriggerButton label="Open" onPress={() => setShowLiquidMenu(true)} />
        </View>

        {/* ── Selling intent suggestion ────────────────────── */}
        <SectionHeader
          title="POST — LOOKS LIKE A LISTING"
          subtitle="What the composer offers when a caption reads as selling. Type a caption to see what fires — the false positives are the point of this playground, not the true ones."
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          <TriggerButton
            label={sellVerified ? "As a verified shop" : "As an ordinary user"}
            onPress={() => setSellVerified((v) => !v)}
          />
        </View>
        <TextInput
          value={sellText}
          onChangeText={setSellText}
          placeholder="Write a caption"
          placeholderTextColor="#9CA3AF"
          multiline
          style={{
            backgroundColor: "#fff",
            borderRadius: 10,
            borderCurve: "continuous",
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            color: "#111827",
            minHeight: 60,
            marginBottom: 10,
          }}
        />
        <View style={{ marginBottom: 24 }}>
          {(() => {
            const intent = detectSellingIntent(sellText);
            if (!intent) {
              return (
                <Text style={{ fontSize: 12, color: "#6b7280" }}>
                  Nothing offered — which is the right answer for most posts.
                </Text>
              );
            }
            return (
              <SellingIntentSuggestion
                intent={intent}
                canListProducts={sellVerified}
                onDismiss={() => {}}
                onListProduct={() => {}}
                onListMarketplace={() => {}}
                onExplainVerification={() => {}}
              />
            );
          })()}
        </View>

        {/* ── Price sanity ─────────────────────────────────── */}
        <SectionHeader
          title="LISTING — PRICE SANITY"
          subtitle="Type a listing and a price. The band is read out of the words, so this is the place to find out what the keyword table gets wrong before a seller does."
        />
        <View style={{ gap: 8, marginBottom: 8 }}>
          <TextInput
            value={priceText}
            onChangeText={setPriceText}
            placeholder="What is being sold"
            placeholderTextColor="#9CA3AF"
            style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              borderCurve: "continuous",
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: "#111827",
            }}
          />
          <TextInput
            value={priceValue}
            onChangeText={setPriceValue}
            keyboardType="numeric"
            placeholder="Price in Nu"
            placeholderTextColor="#9CA3AF"
            style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              borderCurve: "continuous",
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: "#111827",
            }}
          />
        </View>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 12, color: "#6b7280" }}>
            {(() => {
              const band = detectPriceBand(priceText);
              return band
                ? `Read as ${band.label} — ${formatNu(band.min)} to ${formatNu(band.max)}`
                : "Nothing recognised, so nothing is said. That is the common case.";
            })()}
          </Text>
          <PriceSanityNote
            check={checkPrice({ text: priceText, price: Number(priceValue) })}
          />
        </View>

        {/* ── Post: tagged products card ───────────────────── */}
        <SectionHeader
          title="POST — TAGGED PRODUCT CARD"
          subtitle="Sits above the author row when a post tags something for sale. Anyone can tag anyone's item, so the card credits the seller — and a service has no price, which is the case that has to not read as free."
        />
        <View style={{ marginHorizontal: -16, marginBottom: 24, backgroundColor: "#fff", paddingBottom: 10 }}>
          <TaggedProductsCard products={[TAGGED_PRODUCT]} />
          <TaggedProductsCard products={[TAGGED_DISCOUNTED]} />
          <TaggedProductsCard products={[TAGGED_SERVICE]} />
          <TaggedProductsCard
            products={[TAGGED_PRODUCT, TAGGED_DISCOUNTED, TAGGED_SERVICE]}
            onMore={() => {}}
          />
        </View>

        {/* ── Chat details: shared content ─────────────────── */}
        <SectionHeader
          title="CHAT — SHARED MEDIA, LINKS, VOICE"
          subtitle="The three tabs on a chat's details screen. Media is a contact sheet at three across; Voice has no fixture on purpose, so the empty state is one tap away."
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          <TriggerButton
            label={sharedFull ? "Show empty" : "Show with data"}
            onPress={() => setSharedFull((v) => !v)}
          />
        </View>
        <View
          style={{
            marginHorizontal: -16,
            marginBottom: 24,
            paddingVertical: 12,
            backgroundColor: "#f5f5f5",
          }}
        >
          <ChatSharedContent
            tab={sharedTab}
            onTabChange={setSharedTab}
            loading={false}
            media={sharedFull ? CHAT_MEDIA_FIXTURES : []}
            links={sharedFull ? CHAT_LINK_FIXTURES : []}
            voice={CHAT_VOICE_FIXTURES}
            onOpenImage={() => {}}
          />
        </View>

        {/* ── Generated avatars ────────────────────────────── */}
        <SectionHeader
          title="GENERATED AVATARS"
          subtitle="What a profile with no photo of its own wears. Seeded on the account id, so four different seeds is what four different people look like — the thing you cannot judge from one."
        />
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          {["dev-seed-1", "dev-seed-2", "dev-seed-3", "dev-seed-4"].map((seed) => (
            <ExpoImage
              key={seed}
              source={{ uri: dicebearPngUrl(DEFAULT_AVATAR_STYLE, seed) }}
              style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#F5F5F5" }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ))}
        </View>
        {/* The animated one actually plays here — it is a WebView, and this
            is the only place outside a profile that draws one. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <GeneratedAvatar seed="dev-seed-1" style="thumbs" animation="medium" size={56} />
          <GeneratedAvatar seed="dev-seed-2" style="bottts-neutral" animation="none" size={56} />
          <Text style={{ fontSize: 12, color: "#6b7280", flex: 1 }}>
            Animated (thumbs, medium) beside a still one — if the left is
            frozen, the SVG never loaded.
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24 }}>
          <TriggerButton
            label="Open style picker"
            onPress={() => setShowAvatarStyles(true)}
          />
        </View>

        {/* ── Composer attachment card ─────────────────────── */}
        <SectionHeader
          title="CHAT — COMPOSER ATTACHMENT"
          subtitle="What a shared post / product / listing / profile looks like sitting in the composer, and how the input field grows into it. Tap a kind to swap it, Clear to watch it collapse."
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          {(["post", "product", "marketplace", "profile"] as const).map((kind) => (
            <TriggerButton
              key={kind}
              label={kind}
              onPress={() => setComposerContext(COMPOSER_CONTEXT_FIXTURES[kind])}
            />
          ))}
          <TriggerButton label="clear" onPress={() => setComposerContext(null)} />
        </View>
        {/* On the pill's own grey, since that is what it sits on in the
            composer — a white card judged against a white page reads as
            having no edges at all. */}
        <View
          style={{
            backgroundColor: "#EEF0F3",
            borderRadius: 26,
            borderCurve: "continuous",
            paddingBottom: 8,
            marginBottom: 24,
            overflow: "hidden",
          }}
        >
          <ComposerContextCard
            meta={composerContext}
            onOpen={() => {}}
            onRemove={() => setComposerContext(null)}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontSize: 15, color: "#9CA3AF" }}>Message</Text>
          </View>
        </View>

        {/* ── Horizontal loading bar (video buffering) ────── */}
        <SectionHeader
          title="LOADING — VIDEO BUFFERING BAR"
          subtitle="Center-out pulse — lives on the video's own timeline/scrubber, not floating over it"
        />
        <View style={{ gap: 14, marginBottom: 24 }}>
          <View>
            <Text style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Standalone</Text>
            <View style={{ flexDirection: "row", gap: 20, alignItems: "center" }}>
              <LoadingBar size="small" />
              <LoadingBar size="large" />
            </View>
          </View>
          <View>
            <Text style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
              On a mock video scrubber (as in ReelsViewer)
            </Text>
            <View
              style={{
                backgroundColor: "#000",
                borderRadius: 12,
                borderCurve: "continuous",
                padding: 14,
              }}
            >
              <LoadingBar height={2.5} style={{ width: "100%" }} />
            </View>
          </View>
        </View>

        {/* ── Cache ────────────────────────────────────────── */}
        <SectionHeader
          title="QUERY CACHE"
          subtitle="What the app is holding on disk, and the two buttons that change it"
        />
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            borderCurve: "continuous",
            padding: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}>
            {cacheStats
              ? `${cacheStats.entries} ${cacheStats.entries === 1 ? "entry" : "entries"} · ${(cacheStats.bytes / 1024).toFixed(0)}KB`
              : "—"}
          </Text>
          <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 2 }}>
            Budget is 3MB, under Android&apos;s ~6MB AsyncStorage ceiling. Pruned
            at startup: over a week old, then oldest-first back under budget.
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24 }}>
          <TriggerButton label="Refresh stats" onPress={refreshCacheStats} />
          <TriggerButton
            label="Prune now"
            onPress={async () => {
              await pruneQueryCache();
              refreshCacheStats();
            }}
          />
          <TriggerButton
            label="Clear cache"
            onPress={async () => {
              await clearQueryCache();
              refreshCacheStats();
            }}
          />
        </View>

        {/* ── Setlog media ─────────────────────────────────── */}
        <SectionHeader
          title="SETLOG MEDIA ON DISK"
          subtitle="Every clip this phone has kept. Your own recordings are copied here as they are made, so they are never downloaded back."
        />
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            borderCurve: "continuous",
            padding: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}>
            {mediaStats
              ? `${mediaStats.files} ${mediaStats.files === 1 ? "file" : "files"} · ${(mediaStats.bytes / (1024 * 1024)).toFixed(1)}MB`
              : "—"}
          </Text>
          <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 2 }}>
            Documents directory, not the cache directory — the OS empties that
            one. Budget 512MB, least-recently-used evicted first; never by age.
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24 }}>
          <TriggerButton label="Refresh" onPress={refreshMediaStats} />
          <TriggerButton
            label="Enforce budget"
            onPress={async () => {
              await enforceBudget();
              refreshMediaStats();
            }}
          />
          <TriggerButton
            label="Clear media"
            onPress={() => {
              clearMediaCache();
              refreshMediaStats();
            }}
          />
        </View>

        {/* ── Popups ───────────────────────────────────────── */}
        <SectionHeader
          title="POPUPS"
          subtitle="Tap to preview each PopupMessage variant"
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24 }}>
          <TriggerButton label="Success" onPress={() => setPopup("success")} />
          <TriggerButton label="Error" onPress={() => setPopup("error")} />
          <TriggerButton label="Warning" onPress={() => setPopup("warning")} />
          <TriggerButton label="White" onPress={() => setPopup("white")} />
          <TriggerButton
            label="Account required"
            onPress={() => setShowAuthPrompt(true)}
          />
          <TriggerButton
            label="Delete post"
            onPress={() => setShowDeleteConfirm(true)}
          />
        </View>

        {/* ── Screens ──────────────────────────────────────── */}
        <SectionHeader
          title="SCREENS"
          subtitle="Whole screens on fixtures, so a layout can be judged without first creating the data it needs"
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
          <TriggerButton
            label="Business profile — every type"
            onPress={() => setShowBusinessPreview(true)}
          />
          <TriggerButton
            label="Storage — used, fresh, lopsided"
            onPress={() => setShowStoragePreview(true)}
          />
          <TriggerButton
            label="Appearance — badge states"
            onPress={() => setShowAppearancePreview(true)}
          />
          <TriggerButton
            label="Rate a business — new"
            onPress={() => setRatingSheet("blank")}
          />
          <TriggerButton
            label="Rate a business — editing"
            onPress={() => setRatingSheet("edit")}
          />
          <TriggerButton
            label="Edit business — license states"
            onPress={() => setShowEditBusinessPreview(true)}
          />
          <TriggerButton
            label="Add friends — QR + request states"
            onPress={() => setShowAddFriendsPreview(true)}
          />
          <TriggerButton
            label="Messages list — row + list states"
            onPress={() => setShowMessagesPreview(true)}
          />
          <TriggerButton
            label="Collage — aspect mixes"
            onPress={() => setShowCollagePreview(true)}
          />
          <TriggerButton
            label="Setlog — logs + day grid"
            onPress={() => setShowSetlogPreview(true)}
          />
          <TriggerButton
            label="Tutorials — spotlight on real controls"
            onPress={() => setShowTutorialPreview(true)}
          />
          <TriggerButton
            label="Picture editor — edit, export, compare"
            onPress={() => setShowMediaEditor(true)}
          />
          <TriggerButton
            label="Terms of Service"
            onPress={() => setLegalDoc("terms")}
          />
          <TriggerButton
            label="Privacy Policy"
            onPress={() => setLegalDoc("privacy")}
          />
        </View>

        {/* ── Post overlays ────────────────────────────────── */}
        <SectionHeader
          title="POST OVERLAYS"
          subtitle="Long-press feedback overlays used on posts"
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
          <TriggerButton
            label="Post detail — Report overlay"
            onPress={() => setShowFeedbackOverlay(true)}
          />
          <TriggerButton
            label="Grid card — Report overlay"
            onPress={() => setShowGridOverlay(true)}
          />
        </View>

        {showFeedbackOverlay && (
          <View
            style={{
              width: "100%",
              aspectRatio: 4 / 5,
              borderRadius: 12,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: "#334155",
              marginBottom: 12,
              position: "relative",
            }}
          >
            <PostFeedbackOverlay
              visible={showFeedbackOverlay}
              onClose={() => setShowFeedbackOverlay(false)}
              onReport={() => setShowFeedbackOverlay(false)}
            />
          </View>
        )}

        {showGridOverlay && (
          <View
            style={{
              width: 180,
              aspectRatio: 3 / 4,
              borderRadius: 4,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: "#94a3b8",
              marginBottom: 12,
              position: "relative",
            }}
          >
            <PostGridReportOverlay
              visible={showGridOverlay}
              onClose={() => setShowGridOverlay(false)}
              onReport={() => setShowGridOverlay(false)}
            />
          </View>
        )}

        {/* Footer note */}
        <View
          style={{
            marginTop: 8,
            padding: 14,
            borderRadius: 12,
            borderCurve: "continuous",
            backgroundColor: "#faf5ff",
            borderWidth: 1,
            borderColor: "#ede9fe",
          }}
        >
          <Text style={{ fontSize: 11, color: "#7c3aed", lineHeight: 17 }}>
            Add new sections here as more shared components need a place to preview their
            states — a SectionHeader + a row of TriggerButtons is the pattern.
          </Text>
        </View>
      </ScrollView>

      <PopupMessage
        visible={popup !== null}
        type={popup ?? "white"}
        message={
          popup === "success"
            ? "Everything worked."
            : popup === "error"
              ? "Something went wrong."
              : popup === "warning"
                ? "Heads up — check this."
                : "Just a message."
        }
        onHide={() => setPopup(null)}
      />

      <SellerRatingSheet
        visible={ratingSheet !== "none"}
        onClose={() => setRatingSheet("none")}
        providerId="preview"
        buyerId="preview"
        businessName="Demo Shop"
        kind="shop"
        preview={{
          existing:
            ratingSheet === "edit"
              ? {
                  // Deliberately uneven, and with one dimension left
                  // unanswered: the sheet has to hold together when a buyer
                  // skipped a question, and "—" must never render as 0.
                  asDescribed: 5,
                  service: 3,
                  delivery: null,
                  comment: "Quick to reply, packaging could be better.",
                }
              : null,
        }}
      />

      <CollagePreview
        visible={showCollagePreview}
        onClose={() => setShowCollagePreview(false)}
      />

      <AppearancePreview
        visible={showAppearancePreview}
        onClose={() => setShowAppearancePreview(false)}
      />

      <StoragePreview
        visible={showStoragePreview}
        onClose={() => setShowStoragePreview(false)}
      />

      <BusinessProfilePreview
        visible={showBusinessPreview}
        onClose={() => setShowBusinessPreview(false)}
      />

      <EditBusinessPreview
        visible={showEditBusinessPreview}
        onClose={() => setShowEditBusinessPreview(false)}
      />

      <AddFriendsPreview
        visible={showAddFriendsPreview}
        onClose={() => setShowAddFriendsPreview(false)}
      />

      <MessagesListPreview
        visible={showMessagesPreview}
        onClose={() => setShowMessagesPreview(false)}
      />

      <TutorialPreview
        visible={showTutorialPreview}
        onClose={() => setShowTutorialPreview(false)}
      />

      <MediaEditorPreview
        visible={showMediaEditor}
        onClose={() => setShowMediaEditor(false)}
      />

      <SetlogPreview
        visible={showSetlogPreview}
        onClose={() => setShowSetlogPreview(false)}
      />

      {/* Embedded: this playground already fills the settings sub-page
          layer, so the dialog has a full-screen box to sit in. */}
      <AuthPromptModal
        visible={showAuthPrompt}
        onClose={() => setShowAuthPrompt(false)}
        message="Sign in to add friends"
        embedded
      />

      <DeleteConfirmationModal
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => setShowDeleteConfirm(false)}
        postContent="Walked up to Taktsang this morning and the cloud broke right at the top."
        embedded
      />

      {/* The documents take no data, but they are long and easy to break —
          reading them here beats walking Settings to find them. */}
      {legalDoc !== null && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            backgroundColor: "#f5f5f5",
          }}
        >
          {legalDoc === "terms" ? (
            <TermsOfService onClose={() => setLegalDoc(null)} />
          ) : (
            <PrivacyPolicy onClose={() => setLegalDoc(null)} />
          )}
        </View>
      )}

      <LoadingOverlay visible={showLoadingOverlay} />
      <LiquidCreateMenu
        visible={showLiquidMenu}
        onClose={() => setShowLiquidMenu(false)}
        onSelect={() => {}}
      />
      <AvatarStylePicker
        visible={showAvatarStyles}
        userId="dev-seed-1"
        currentStyle={DEFAULT_AVATAR_STYLE}
        currentAnimation="none"
        onClose={() => setShowAvatarStyles(false)}
        onSave={() => setShowAvatarStyles(false)}
      />
    </View>
  );
}
