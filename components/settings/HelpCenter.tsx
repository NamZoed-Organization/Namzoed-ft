/**
 * Settings › Help Center › Help articles.
 *
 * It was a placeholder — an icon and "Help articles and support content will
 * be available here" — under a hand-rolled header. The hub above it
 * (`components/settings/SupportSettings.tsx`) already offers tutorials,
 * contact and feedback, so what this screen owes is the short written answer
 * you want at the moment you are stuck, without leaving the app for a web
 * page that does not exist yet.
 *
 * Questions, not topics. A row reading "Listings" tells you nothing about
 * whether your question is behind it; "Why can nobody see my listing?" is
 * either your question or it isn't, and you can tell at a glance.
 *
 * Answers open in place. A one-paragraph answer given its own pushed screen
 * makes you pay a navigation to read three lines and pay another to check
 * the next one — the accordion lets somebody scan five questions in the time
 * one push would take. Long answers are the argument for a sub-page, and
 * none of these are long; if one grows past a screenful it should become a
 * real document on `LegalDocument.tsx` instead of a bigger row.
 *
 * ARTICLES is the whole screen. Adding one is adding an entry — it needs no
 * component, no route and no case in the settings switch.
 */

import {
  SettingsGroup,
  SettingsScreen,
} from "@/components/settings/SettingsChrome";
import { ChevronDown } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Text,
  TouchableOpacity,
  UIManager,
  View,
  StyleSheet,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** The same 220ms ease the other expanding lists use (ProductReviews,
 *  InlineComments) — an answer opening is the same gesture as a thread. */
const animate = () =>
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, "easeInEaseOut", "opacity"),
  );

interface HelpCenterProps {
  onClose?: () => void;
}

interface Article {
  q: string;
  /** Paragraphs. Keep an answer to what fits on a screen without scrolling. */
  a: string[];
}

interface ArticleGroup {
  /** A § Groups and rows section label — plain text, as everywhere else
   *  under Settings. No icon: these head a list of sentences, and a glyph
   *  beside "Safety" is decoration the questions underneath do not need. */
  label: string;
  items: Article[];
}

const ARTICLES: ArticleGroup[] = [
  {
    label: "Your account",
    items: [
      {
        q: "What is my NamZoed ID?",
        a: [
          "It is the short id under your name on your profile, and it is what your QR code carries. Sharing it is how somebody adds you without typing your name and hoping they picked the right person.",
          "Tap the NamZoed ID line on your own profile to open your code. Scan, in the menu or in your profile's top bar, is the other half — it reads somebody else's.",
        ],
      },
      {
        q: "I scanned a code. Why are we not following each other?",
        a: [
          "A scan on its own never follows anybody. It sends a request, and both of you confirm — you in the sheet that comes up after the scan, them on their Add Friends screen.",
          "Until they confirm, it sits under Waiting for them. That is deliberate: pointing a camera at a code you happened to see should not connect you to a stranger.",
        ],
      },
      {
        q: "Can I change my name or username later?",
        a: [
          "Your display name, bio, photo and location are editable at any time from Edit Profile. Your NamZoed ID is fixed, because codes people have already saved and shared point at it.",
        ],
      },
      {
        q: "What happens when I delete my account?",
        a: [
          "Your profile, posts, listings, reviews and messages are removed, and your NamZoed ID is retired rather than reissued. It cannot be undone, and an account cannot be recovered afterwards.",
          "If what you want is a break rather than an ending, blocking and turning off notifications gets you most of the way there and is reversible.",
        ],
      },
    ],
  },
  {
    label: "Buying and selling",
    items: [
      {
        q: "How do I list something?",
        a: [
          "Manage Listings, in the menu, is where everything you have listed lives and where a new one starts. The + on the home screen and the Marketplace tab's empty state both arrive at the same place.",
          "A listing needs your own photos of the actual item, the real price, and the condition said plainly. Those three are also most of what the Community Guidelines ask of a seller.",
        ],
      },
      {
        q: "Why can nobody see my listing?",
        a: [
          "Check that it is still active in Manage Listings — a listing marked sold or closed stays in your list but leaves the marketplace.",
          "Beyond that, a listing with no category, no price or a single blurry photo simply loses to the ones that have them. It is not hidden; it is last.",
        ],
      },
      {
        q: "How does payment work?",
        a: [
          "It does not go through Namzoed. You agree with the other person how to pay — in person, or however you both trust — and the app is where you found each other and where you talk.",
          "That means nobody here can reverse a transfer for you. Meet where you can see the item, and be careful with anybody who wants money before you have.",
        ],
      },
      {
        q: "The item was not what the listing said.",
        a: [
          "Say so in a review, with what actually arrived — that is what reviews are for, and it is the part other buyers act on.",
          "If the listing was deliberately misleading, report the product from its menu as well. A review warns the next buyer; a report is what gets the listing itself looked at.",
        ],
      },
    ],
  },
  {
    label: "Posts, live and comments",
    items: [
      {
        q: "What do General, Sensitive and 18+ mean?",
        a: [
          "They are the rating you set when you post. Sensitive covers injury, blood, medical procedures and distressing scenes — it stays up behind a cover somebody chooses to lift. 18+ is for adults only. Explicit content is not allowed at any rating.",
          "The composer suggests one and you can change it. Setting it honestly is what lets somebody scroll past something they did not want to see.",
        ],
      },
      {
        q: "Who can see what I post?",
        a: [
          "Posts are public to people using the app unless the post itself says otherwise. Location is attached only when you add it, per post.",
          "Your Saved tab is yours alone — saving something is never visible to whoever posted it.",
        ],
      },
      {
        q: "Can I edit or delete something after posting?",
        a: [
          "Posts, comments and listings can be deleted from their own menu. A live stream ends when you end it and is not editable afterwards, which is why the guidelines draw the line earlier for live than for anything else.",
        ],
      },
    ],
  },
  {
    label: "Messages",
    items: [
      {
        q: "Who can message me?",
        a: [
          "Anybody can start a conversation about a listing you posted — that is how a marketplace works. Blocking ends it, immediately and without a reason.",
        ],
      },
      {
        q: "What is Setlog?",
        a: [
          "The second tab on Messages: short video notes to a person instead of typed ones. Same conversation, recorded rather than written.",
        ],
      },
    ],
  },
  {
    label: "Deliveries",
    items: [
      {
        q: "What is Mongoose delivery?",
        a: [
          "Booking somebody to carry something across town for you. It is in the menu, under the wallet.",
          "Say where it is going and what is in it. A rider may refuse a parcel they were not told about, and nothing from the prohibited list in the Community Guidelines may be sent at all.",
        ],
      },
    ],
  },
  {
    label: "Safety",
    items: [
      {
        q: "How do I report something?",
        a: [
          "Every post, product, profile and comment has a report option in its menu, with a reason to pick and room to explain. The person you report is not told who reported them.",
          "Report it rather than arguing with it underneath — the argument is what spreads it.",
        ],
      },
      {
        q: "What happens after I report?",
        a: [
          "The content is reviewed against the Community Guidelines. Depending on what it is, it may be removed, the account may lose a feature for a period, or it may be suspended or closed.",
          "Not everything ends in a removal, and a report that changes nothing is not a report that was ignored.",
        ],
      },
      {
        q: "Somebody is in danger.",
        a: [
          "Contact the police first. Reporting it here does not reach anyone faster than they do.",
        ],
      },
      {
        q: "What should I never share?",
        a: [
          "Your password, and any code sent to you to sign in. Nobody working on Namzoed will ask you for either, in chat or anywhere else.",
          "Somebody else's phone number, address, CID or private messages do not belong in a post or a review, whatever the argument is about.",
        ],
      },
    ],
  },
  {
    label: "Reviews",
    items: [
      {
        q: "Who can leave a review?",
        a: [
          "Somebody who actually dealt with the seller, product or service. Reviewing your own listing, a competitor's, or one a friend asked you to rate is a guidelines violation and the review is removed.",
        ],
      },
      {
        q: "A seller offered me a discount for five stars.",
        a: [
          "That is not allowed — it is the one thing that makes a rating worthless. Report the seller, and leave the review the transaction actually earned.",
        ],
      },
    ],
  },
];

/** A question, and its answer opening underneath it in the same card. */
function ArticleRow({
  article,
  first,
  open,
  onToggle,
}: {
  article: Article;
  first: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const rotation = useSharedValue(open ? 1 : 0);
  // In an effect, not in the render body: writing a shared value while
  // rendering is the Reanimated warning that turns into a dropped frame on
  // the first tap, and the chevron is the one part of this that animates.
  useEffect(() => {
    rotation.value = withTiming(open ? 1 : 0, { duration: 220 });
  }, [open, rotation]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <>
      {first ? null : (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: "#f0f0f0",
            marginLeft: 16,
          }}
        />
      )}
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 15,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 15.5,
              fontWeight: "600",
              color: "#111",
              paddingRight: 12,
            }}
          >
            {article.q}
          </Text>
          <Animated.View style={chevronStyle}>
            <ChevronDown size={18} color="#C7C7CC" />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {open ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
          {article.a.map((paragraph, i) => (
            <Text
              key={i}
              style={{ fontSize: 14.5, lineHeight: 21, color: "#4B5563" }}
            >
              {paragraph}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );
}

export default function HelpCenter({ onClose }: HelpCenterProps) {
  // One key, not a set: reading an answer means you are done with the last
  // one, and a column of everything open at once is the wall of text this
  // screen exists to avoid.
  const [open, setOpen] = useState<string | null>(null);

  return (
    <SettingsScreen title="Help articles" onClose={onClose}>
      <Text
        style={{
          fontSize: 15,
          lineHeight: 22,
          color: "#4B5563",
          paddingHorizontal: 16,
          paddingTop: 2,
          paddingBottom: 18,
        }}
      >
        The short answers. If yours is not here, Send feedback on the screen
        before this one reaches a person.
      </Text>

      {ARTICLES.map((group) => (
        <SettingsGroup key={group.label} label={group.label}>
          {group.items.map((article, i) => {
            const key = `${group.label}:${article.q}`;
            return (
              <ArticleRow
                key={key}
                article={article}
                first={i === 0}
                open={open === key}
                onToggle={() => {
                  animate();
                  setOpen((prev) => (prev === key ? null : key));
                }}
              />
            );
          })}
        </SettingsGroup>
      ))}
    </SettingsScreen>
  );
}
