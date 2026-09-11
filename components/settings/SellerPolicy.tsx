/**
 * Seller Policy.
 *
 * Reached from Settings › About Namzoed › Legal. It was a placeholder — an
 * icon over "Seller policy guidelines will be displayed here" — under the
 * pre-standard hand-rolled header, and it was the last screen in the app
 * still in that shape.
 *
 * Built on `components/settings/LegalDocument.tsx` like the Terms, the
 * Privacy Policy and the Community Guidelines, because it is read in the
 * same list as all three.
 *
 * Scope, and where it stops: the Terms say NamZoed is not a party to the
 * transaction and does not hold anybody's money, so this document cannot
 * promise a refund, an escrow or an arbitration it has no mechanism for.
 * What it can do is say what a seller commits to by listing, and what
 * happens when they don't. Where a rule is really a community rule applied
 * to selling, it points at the Guidelines rather than restating it in
 * different words — two documents disagreeing about the same rule is worse
 * than one of them being shorter. `BuyerPolicy.tsx` is the other side of the
 * same transaction and the two are written to match clause for clause.
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
  BadgeCheck,
  Ban,
  Bike,
  Gavel,
  MessageCircle,
  Package,
  RefreshCw,
  Star,
  Store,
  Tag,
  UserCheck,
} from "lucide-react-native";
import React from "react";

interface SellerPolicyProps {
  onClose?: () => void;
}

const icon = (Icon: typeof Store) => (
  <Icon size={20} color={LEGAL_ICON} strokeWidth={1.8} />
);

export default function SellerPolicy({ onClose }: SellerPolicyProps) {
  return (
    <LegalScreen
      title="Seller Policy"
      onClose={onClose}
      updated="September 2026"
      version="1.0"
      lede="This is what you agree to when you list something on Namzoed, whether that is one item from your house or a shop you run full time. It sits alongside the Terms of Service and the Community Guidelines; where they say something about selling, they say it once and this points at them."
    >
      <LegalSection index={1} title="Who may sell" icon={icon(UserCheck)}>
        <LegalClause title="An account that is really yours">
          Sell under your own account, with accurate details. An account
          selling on behalf of a business must be run by somebody who is part
          of that business.
        </LegalClause>
        <LegalClause title="Your own legal position">
          You are responsible for whatever licences, permits or registrations
          your trade requires, and for any tax that arises from it. Namzoed
          does not check these for you and listing something here is not
          evidence that you are permitted to sell it.
        </LegalClause>
        <LegalClause title="One seller, one account">
          Running several accounts to occupy more of a category, to escape a
          rating, or to come back after an account was closed is a breach of
          this policy and of the Guidelines.
        </LegalClause>
      </LegalSection>

      <LegalSection index={2} title="What a listing must say" icon={icon(Tag)}>
        <LegalText strong>
          A listing has to be the thing that turns up.
        </LegalText>
        <LegalClause title="The item">
          <LegalBullets
            items={[
              {
                term: "Your own photographs,",
                text: "of the actual item, in the condition it is in now. A catalogue or supplier photograph of a different unit is a misleading listing even when the model is identical.",
              },
              {
                term: "Condition, stated plainly.",
                text: "Wear, faults, repairs, missing parts and anything that stops it working as new belong in the description, not in the chat after a buyer has committed.",
              },
              {
                term: "Quantity you actually hold.",
                text: "Take a listing down once it is gone rather than leaving it up to draw messages.",
              },
              {
                term: "The right category,",
                text: "so people looking for it find it and people who are not looking for it do not.",
              },
            ]}
          />
        </LegalClause>
        <LegalClause title="The price">
          The figure on the listing is the figure you will sell at. If delivery
          is charged on top, say so and say how much; a price that only holds
          under conditions the listing does not mention is not the price.
          Raising it once somebody has agreed to buy is a breach.
        </LegalClause>
        <LegalClause title="Discounts that are real">
          A struck-through price must be a price you were genuinely charging
          before. An invented &ldquo;original&rdquo; price is a false claim about the
          transaction, not a presentation choice.
        </LegalClause>
      </LegalSection>

      <LegalSection index={3} title="What may not be listed" icon={icon(Ban)}>
        <LegalText>
          The prohibited list is in the Community Guidelines and applies in
          full: illegal drugs, weapons and ammunition, wildlife and protected
          species, stolen goods, counterfeits and pirated media, prescription
          medicine, identity and official documents, restricted antiques and
          religious artefacts, tobacco and alcohol sold outside the law, and
          accounts or services for this app.
        </LegalText>
        <LegalClause title="If you are not sure">
          Do not list it and ask first. A listing removed under this section
          counts against the account whether or not the sale went through.
        </LegalClause>
      </LegalSection>

      <LegalSection index={4} title="Talking to buyers" icon={icon(MessageCircle)}>
        <LegalClause title="Answer, or close the listing">
          A live listing is a promise that somebody will reply. If you have
          stopped selling, take it down — an unanswered listing costs the
          buyer more than a missing one.
        </LegalClause>
        <LegalClause title="Keep the deal where it can be seen">
          Agree the terms in the app&apos;s chat. Moving straight to another
          channel is not banned, but nothing agreed there can be looked at
          afterwards if the sale is disputed or reported.
        </LegalClause>
        <LegalClause title="No pressure, no harvesting">
          Do not message people who have not contacted you about your listing,
          and do not use a listing to collect phone numbers for something
          else. Both are spam under the Guidelines.
        </LegalClause>
      </LegalSection>

      <LegalSection index={5} title="Payment" icon={icon(Package)}>
        <LegalText strong>
          Namzoed does not hold your money and cannot move it.
        </LegalText>
        <LegalClause title="You are paid directly">
          Payment is arranged between you and the buyer. There is no escrow
          here, no platform-held balance, and nobody who can reverse a
          transfer for either of you.
        </LegalClause>
        <LegalClause title="What you may not ask for">
          A payment method chosen because it leaves no record, a deposit for
          an item you do not have, or full payment before the buyer has been
          told where and when they will receive it.
        </LegalClause>
      </LegalSection>

      <LegalSection index={6} title="Handing it over" icon={icon(Bike)}>
        <LegalClause title="When you said you would">
          Meet at the time and place you agreed, or send it within the window
          you gave. If something changes, say so before the deadline rather
          than after it.
        </LegalClause>
        <LegalClause title="Through Mongoose">
          If you send it with a rider, describe the parcel honestly — nothing
          from the prohibited list goes in a delivery, and a rider may refuse
          anything they were not told about. The handover is still your
          responsibility until the buyer has it.
        </LegalClause>
        <LegalClause title="Meeting in person">
          Somewhere public, in daylight where you can manage it. A buyer who
          wants to see the item before paying is doing the sensible thing, not
          insulting you.
        </LegalClause>
      </LegalSection>

      <LegalSection index={7} title="When it goes wrong" icon={icon(RefreshCw)}>
        <LegalClause title="Say your terms before the sale">
          Whether you accept returns, for how long, and who pays to send it
          back. A seller who says nothing and refuses everything afterwards is
          treated as having misled the buyer.
        </LegalClause>
        <LegalClause title="Not as described is yours to fix">
          If what arrived is not what the listing said — a fault not
          mentioned, a different model, fewer items — put it right by
          replacing it, taking it back, or returning the money. This is the
          one case where &ldquo;no returns&rdquo; does not apply, because the listing was
          the problem.
        </LegalClause>
        <LegalClause title="Cancelling">
          Cancelling a sale you have already agreed, to take a better offer,
          is a breach. Cancelling because you cannot fulfil it is not — tell
          the buyer as soon as you know.
        </LegalClause>
      </LegalSection>

      <LegalSection index={8} title="Ratings and reviews" icon={icon(Star)}>
        <LegalClause title="You may ask; you may not buy">
          Asking a happy buyer to leave a review is fine. Offering a discount,
          a refund or a free item for one is not, and neither is holding
          delivery or communication over a rating.
        </LegalClause>
        <LegalClause title="Nobody reviews their own shop">
          Reviews from your own accounts, from friends who did not buy, or
          traded with another seller are removed, and repeated attempts cost
          the account its listing privileges.
        </LegalClause>
        <LegalClause title="A bad review is not a rule breach">
          An honest negative review stays up. Reporting it because it is
          negative is reporting in bad faith; report it only if it breaks a
          rule — false claims, somebody&apos;s private details, abuse.
        </LegalClause>
      </LegalSection>

      <LegalSection index={9} title="Business profiles" icon={icon(BadgeCheck)}>
        <LegalClause title="What the badge means">
          A verified badge says the business was checked, not that Namzoed
          stands behind any particular sale. Verification is reviewed by a
          person and is not something a seller can set.
        </LegalClause>
        <LegalClause title="Keeping it accurate">
          Hours, location, contact details and the services listed are yours
          to keep current. A profile that sends people to a shop that closed
          is a worse outcome than no profile.
        </LegalClause>
      </LegalSection>

      <LegalSection index={10} title="Enforcement" icon={icon(Gavel)}>
        <LegalText>
          The same ladder as the Community Guidelines, applied to selling.
          Most first breaches end at the first step.
        </LegalText>
        <LegalBullets
          items={[
            { term: "The listing comes down,", text: "and you are told which rule it was." },
            { term: "Listing is paused", text: "for a period, while existing conversations stay open." },
            { term: "The account is suspended", text: "while something serious is looked at." },
            { term: "Selling is withdrawn permanently", text: "for fraud, for prohibited items, or after repeated breaches." },
          ]}
        />
        <LegalClause title="What weighs heaviest">
          Taking money without delivering, listing prohibited items, and
          manipulating ratings. These are treated as deliberate rather than
          careless, and they do not need a pattern to reach the last step.
        </LegalClause>
        <LegalClause title="Appealing">
          Every enforcement notice can be replied to and a person reads the
          reply. Settings › Help Center › Send feedback reaches the same place
          if the notice is no longer in front of you.
        </LegalClause>
      </LegalSection>
    </LegalScreen>
  );
}
