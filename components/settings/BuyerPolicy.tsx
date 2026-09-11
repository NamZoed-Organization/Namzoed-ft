/**
 * Buyer Policy.
 *
 * The other half of `SellerPolicy.tsx`. The Legal group had a policy telling
 * sellers what they owe and nothing telling buyers what they can expect —
 * which reads as a marketplace that only has rules for one side of the
 * counter, and left the most useful thing a buyer can be told (Namzoed does
 * not hold your money, so here is how to not lose it) written down nowhere.
 *
 * Same kit as the other three documents, and deliberately parallel to the
 * seller's: section 5 is payment in both, section 7 is what happens when the
 * transaction goes wrong in both, so the two can be read against each other.
 * Where a rule is really a community rule, it points at the Guidelines.
 */

import {
  LEGAL_ICON,
  LegalBullets,
  LegalClause,
  LegalScreen,
  LegalSection,
  LegalText,
} from "@/components/settings/LegalDocument";
import {
  Banknote,
  Eye,
  Flag,
  Gavel,
  Handshake,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Star,
} from "lucide-react-native";
import React from "react";

interface BuyerPolicyProps {
  onClose?: () => void;
}

const icon = (Icon: typeof ShoppingBag) => (
  <Icon size={20} color={LEGAL_ICON} strokeWidth={1.8} />
);

export default function BuyerPolicy({ onClose }: BuyerPolicyProps) {
  return (
    <LegalScreen
      title="Buyer Policy"
      onClose={onClose}
      updated="September 2026"
      version="1.0"
      lede="What you can expect from a seller on Namzoed, what is expected of you, and — the part worth reading before anything else — what this app can and cannot do for you if a deal goes wrong. It sits alongside the Seller Policy, which is the same transaction written from the other side."
    >
      <LegalSection index={1} title="What Namzoed is" icon={icon(ShoppingBag)}>
        <LegalText strong>
          Namzoed is where you find each other. It is not the shop.
        </LegalText>
        <LegalClause title="Who you are buying from">
          Every sale here is between you and another person or business. They
          set the price, hold the item and decide their own terms. Namzoed
          does not stock, inspect, price or dispatch anything listed.
        </LegalClause>
        <LegalClause title="What that means in practice">
          There is no escrow, no platform-held balance and nobody here who can
          reverse a payment you have made. That is not a gap we work around
          for you — it is the shape of the thing, and every rule below follows
          from it.
        </LegalClause>
        <LegalClause title="What we do instead">
          We hold sellers to the Seller Policy and the Community Guidelines,
          act on what you report, and remove sellers who break them. That
          protects the next buyer reliably and you only sometimes, which is
          why the care below is worth taking.
        </LegalClause>
      </LegalSection>

      <LegalSection index={2} title="Before you commit" icon={icon(Eye)}>
        <LegalBullets
          items={[
            {
              term: "Read the whole listing.",
              text: "Condition, what is included, and whether delivery is on top of the price.",
            },
            {
              term: "Look at the seller.",
              text: "Their other listings, their ratings, and what reviews say about how the handover went — not only about the item.",
            },
            {
              term: "Ask before you pay.",
              text: "Anything the listing does not answer, ask in the chat, where the answer is on the record.",
            },
            {
              term: "Be suspicious of a price that makes no sense.",
              text: "The most common loss on any marketplace is a real-looking listing far below what the item costs.",
            },
          ]}
        />
      </LegalSection>

      <LegalSection index={3} title="Agreeing the deal" icon={icon(MessageCircle)}>
        <LegalClause title="Settle it in the chat">
          Price, delivery, timing and anything promised about condition —
          agree it in the app. If the sale is later reported or disputed, the
          conversation here is what can be looked at; nothing said on another
          app can be.
        </LegalClause>
        <LegalClause title="Say what you mean about returns">
          Ask what the seller&apos;s terms are before paying, not after. A seller
          who will not say is telling you something.
        </LegalClause>
      </LegalSection>

      <LegalSection index={4} title="Meeting and receiving" icon={icon(Handshake)}>
        <LegalClause title="In person">
          Somewhere public, in daylight where you can manage it, and take
          somebody with you for anything expensive. Inspect the item before
          you hand over money — a seller acting in good faith expects this.
        </LegalClause>
        <LegalClause title="By delivery">
          Check the parcel on arrival while the rider is still there where you
          can. If what arrived is wrong, say so to the seller the same day —
          a fault raised a week later is much harder for anybody to act on.
        </LegalClause>
      </LegalSection>

      <LegalSection index={5} title="Paying safely" icon={icon(Banknote)}>
        <LegalText strong>
          A transfer made is a transfer gone. Treat every payment as final,
          because for this app it is.
        </LegalText>
        <LegalBullets
          items={[
            {
              term: "Pay when you have the item",
              text: "where the deal allows it. Cash on collection is the safest thing this marketplace offers.",
            },
            {
              term: "Be careful with deposits.",
              text: "A deposit for an item nobody has shown you is the most common way money is lost here.",
            },
            {
              term: "Never pay someone who insists on urgency.",
              text: "Another buyer waiting, an offer expiring today, a price only good in the next hour — that pressure is the technique, not the deal.",
            },
            {
              term: "Keep the record.",
              text: "Whatever you pay with, keep the receipt or screenshot. It is what a report can be acted on with.",
            },
          ]}
        />
        <LegalClause title="Nobody here will ever ask you for a password">
          Not a password, not a sign-in code, not your full card details in a
          chat. Anybody asking, whatever they claim to be, is not from
          Namzoed. Report them.
        </LegalClause>
      </LegalSection>

      <LegalSection index={6} title="What is expected of you" icon={icon(Handshake)}>
        <LegalClause title="Turn up">
          If you have agreed to buy, buy it or say promptly that you cannot.
          A seller who held an item for you and was left waiting has lost the
          sale twice.
        </LegalClause>
        <LegalClause title="Negotiate before, not after">
          Haggling is normal; re-opening the price at the handover, when the
          seller has already travelled, is not.
        </LegalClause>
        <LegalClause title="The Guidelines apply to you too">
          Everything in the Community Guidelines about how people are treated
          applies in the chat with a seller exactly as it does in a comment
          thread.
        </LegalClause>
      </LegalSection>

      <LegalSection index={7} title="When it goes wrong" icon={icon(RefreshCw)}>
        <LegalClause title="The seller first">
          Most of it is a misunderstanding and ends there. Say what is wrong,
          say what you want done, and give them a chance to do it.
        </LegalClause>
        <LegalClause title="Not as described">
          If the item is not what the listing said, the Seller Policy requires
          the seller to put it right — replace it, take it back, or return the
          money — regardless of whether they otherwise accept returns.
        </LegalClause>
        <LegalClause title="Changed your mind">
          That is the seller&apos;s terms, not a right. Whatever they said before
          the sale is what applies.
        </LegalClause>
        <LegalClause title="Then report it">
          Report the product or the seller from its menu, with what happened.
          This is what removes a bad seller from the marketplace, and it is
          the part that protects everybody after you.
        </LegalClause>
      </LegalSection>

      <LegalSection index={8} title="Leaving a review" icon={icon(Star)}>
        <LegalClause title="Only where you bought">
          Review sellers, products and services you actually dealt with.
          Reviewing a competitor, a seller you never bought from, or one a
          friend asked you to rate is removed under the Guidelines.
        </LegalClause>
        <LegalClause title="Say what happened">
          A negative review that describes the transaction is worth more than
          a star rating and is the most useful thing you can leave behind. It
          stays up: a seller cannot have it removed for being unflattering.
        </LegalClause>
        <LegalClause title="Not for sale">
          If a seller offers you anything for a rating, refuse it and report
          them — that offer is what makes every other rating worthless.
        </LegalClause>
      </LegalSection>

      <LegalSection index={9} title="Your safety and your data" icon={icon(ShieldAlert)}>
        <LegalClause title="Share as little as you need to">
          A seller needs somewhere to meet or send to. They do not need your
          CID, your workplace or your movements.
        </LegalClause>
        <LegalClause title="Blocking">
          Immediate, needs no reason, and is the right tool for somebody you
          simply do not want to hear from. Reporting is for somebody who broke
          a rule.
        </LegalClause>
        <LegalClause title="Something urgent">
          If you are threatened or in danger, contact the police first.
          Reporting it here does not reach anyone faster than they do.
        </LegalClause>
      </LegalSection>

      <LegalSection index={10} title="Reporting, and what follows" icon={icon(Flag)}>
        <LegalClause title="How">
          Every product, profile, post and comment has a report option in its
          menu. The person you report is not told who reported them.
        </LegalClause>
        <LegalClause title="What we can do">
          Remove the listing, pause or withdraw the seller&apos;s ability to list,
          and close the account. What we cannot do is recover your money —
          see section 1, and section 5 for how not to be in that position.
        </LegalClause>
        <LegalClause title="Reporting in bad faith">
          Reporting a seller because a negotiation went badly, or to damage a
          competitor, is itself a breach (§ Guidelines).
        </LegalClause>
      </LegalSection>

      <LegalSection index={11} title="Enforcement, for buyers" icon={icon(Gavel)}>
        <LegalText>
          Buying accounts are held to the same ladder as selling ones.
        </LegalText>
        <LegalBullets
          items={[
            { term: "A warning,", text: "naming the rule — where most first breaches end." },
            { term: "Messaging or reviewing is paused", text: "for a period." },
            { term: "The account is suspended", text: "while something serious is looked at." },
            { term: "The account is closed", text: "for harassment, fraud, or repeated breaches." },
          ]}
        />
      </LegalSection>
    </LegalScreen>
  );
}
