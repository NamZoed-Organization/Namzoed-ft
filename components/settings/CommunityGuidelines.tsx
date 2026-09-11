/**
 * Community Guidelines.
 *
 * Reached from the hamburger drawer and from Settings › About Namzoed. It
 * was a placeholder — an icon and "Community guidelines and rules will be
 * displayed here" — under a hand-rolled header that matched nothing else
 * under Settings.
 *
 * It is written on `components/settings/LegalDocument.tsx`, the same kit the
 * Terms and the Privacy Policy use, because this is the third document of
 * the same kind and a screen people arrive at from the same list should not
 * be a different screen. See that file for what the brochure layout was and
 * why it went.
 *
 * The rules themselves are the ones this app can actually act on: every
 * section maps to something that exists — the report sheets
 * (`components/modals/ReportPostModal.tsx`, `ReportProductModal.tsx`) and
 * their reasons, the content ratings on the composer
 * (`components/ContentRatingSuggestion.tsx`), listings, reviews, live, and
 * Mongoose. A guideline with no mechanism behind it is a wish, and people
 * stop reading the list when half of it is decoration.
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
  Ban,
  Bike,
  EyeOff,
  Flag,
  Gavel,
  Heart,
  Radio,
  ShieldAlert,
  ShoppingBag,
  Star,
  UserCheck,
} from "lucide-react-native";
import React from "react";

interface CommunityGuidelinesProps {
  onClose?: () => void;
}

const icon = (Icon: typeof Heart) => (
  <Icon size={20} color={LEGAL_ICON} strokeWidth={1.8} />
);

export default function CommunityGuidelines({ onClose }: CommunityGuidelinesProps) {
  return (
    <LegalScreen
      title="Community Guidelines"
      onClose={onClose}
      updated="September 2026"
      version="1.0"
      lede="Namzoed is a small country's marketplace and feed in one app, which means the person you are selling to is somebody you are likely to meet. These are the rules that keep that worth doing. They apply everywhere in the app — posts, products, services, live, comments, reviews, chat and deliveries."
    >
      <LegalSection index={1} title="Be a real person" icon={icon(UserCheck)}>
        <LegalText strong>
          One account, your own name and face, and a NamZoed ID that belongs to
          you.
        </LegalText>
        <LegalClause title="Who you say you are">
          Do not impersonate another person, a business you do not run, or an
          agency of the government. A business profile must be run by somebody
          who is actually part of that business.
        </LegalClause>
        <LegalClause title="Accounts that exist to deceive">
          Networks of accounts used to inflate follows, likes, ratings or
          reviews are removed together, along with whatever they were pointed
          at. Buying or selling accounts, followers or reviews is the same
          offence.
        </LegalClause>
      </LegalSection>

      <LegalSection index={2} title="Treat people well" icon={icon(Heart)}>
        <LegalText>
          Disagreement is fine. Going after a person is not. This is the rule
          behind the Harassment or Hate Speech report reason, and it is the one
          most often used.
        </LegalText>
        <LegalClause title="Not allowed">
          <LegalBullets
            items={[
              {
                term: "Harassment.",
                text: "Repeated unwanted contact, pile-ons, or comments aimed at making somebody leave.",
              },
              {
                term: "Hate speech.",
                text: "Attacks on people for their religion, ethnicity, nationality, region, caste, gender, disability, or sexuality.",
              },
              {
                term: "Threats.",
                text: "Any threat of violence, including ones framed as jokes, and any call for others to carry one out.",
              },
              {
                term: "Sexual harassment.",
                text: "Unsolicited sexual messages or images, in comments or in chat.",
              },
            ]}
          />
        </LegalClause>
        <LegalClause title="Somebody younger than you">
          Nothing sexualising a minor, ever — it is removed, the account is
          closed, and it is reported to the authorities. There is no warning
          step for this one.
        </LegalClause>
      </LegalSection>

      <LegalSection index={3} title="Sell honestly" icon={icon(ShoppingBag)}>
        <LegalText strong>
          A listing has to be the thing that turns up.
        </LegalText>
        <LegalClause title="What a listing owes the buyer">
          <LegalBullets
            items={[
              {
                term: "Your own photos.",
                text: "Of the actual item, in the condition it is in. A catalogue photo of a different unit is a misleading listing.",
              },
              {
                term: "The real price.",
                text: "Including what a buyer must pay to receive it. A price that only holds under conditions not in the listing is not the price.",
              },
              {
                term: "Second-hand said plainly.",
                text: "Wear, faults and missing parts belong in the description, not in the chat after somebody has committed.",
              },
              {
                term: "Stock you have.",
                text: "Take a listing down once it is gone rather than leaving it up to draw messages.",
              },
            ]}
          />
        </LegalClause>
        <LegalClause title="Things that may not be listed">
          Illegal drugs and the equipment for them, tobacco and alcohol sold
          outside the law, weapons and ammunition, wildlife and anything made
          from a protected species, human remains, stolen goods, counterfeits
          and pirated media, prescription medicine, official documents and
          identity papers, live animals sold as goods, currency schemes, and
          accounts or services for this app itself.
        </LegalClause>
        <LegalClause title="Antiques, religious items and cultural property">
          Anything whose export or sale is restricted under Bhutanese law —
          including religious artefacts and antiques — may only be listed if
          you are permitted to sell it, and that is your responsibility to
          establish before you post it.
        </LegalClause>
        <LegalClause title="Payment stays between you">
          Namzoed does not hold your money and cannot reverse a transfer. Do
          not ask a buyer to pay through a channel that leaves no record, and
          do not send money to somebody who will not meet or ship first if that
          is what you agreed.
        </LegalClause>
      </LegalSection>

      <LegalSection index={4} title="Reviews are for people who were there" icon={icon(Star)}>
        <LegalClause title="Your own experience, nobody else's">
          Review a seller, product or service you actually dealt with. Do not
          review your own listing, a competitor&apos;s, or one a friend asked
          you to rate.
        </LegalClause>
        <LegalClause title="Never a condition of the sale">
          Offering a discount, a refund or a free item in exchange for a rating
          removes the only thing a rating is worth. Sellers may ask for a
          review; they may not pay for one, and they may not hold delivery over
          one.
        </LegalClause>
        <LegalClause title="What a review may say">
          Whatever is true about the transaction — including that it went
          badly. What it may not carry is another person&apos;s phone number,
          address, or an accusation you know to be false.
        </LegalClause>
      </LegalSection>

      <LegalSection index={5} title="Rate what you post" icon={icon(EyeOff)}>
        <LegalText>
          The composer suggests a rating — General, Sensitive or 18+ — and you
          can change it. Setting it honestly is a guideline, not a formality:
          it is what lets somebody scroll past something they did not want to
          see.
        </LegalText>
        <LegalClause title="Sensitive">
          Injury, blood, medical procedures, animal slaughter, and distressing
          scenes. These stay up behind a cover; the cover is the point.
        </LegalClause>
        <LegalClause title="18+">
          Content for adults only. Nudity for shock, pornography, and anything
          sexually explicit is not allowed at any rating — 18+ is not a label
          that admits it.
        </LegalClause>
        <LegalClause title="Rating around the filter">
          Marking explicit or graphic content General to reach more people is
          treated as the more serious offence of the two, because it is aimed
          at the people who set the filter deliberately.
        </LegalClause>
      </LegalSection>

      <LegalSection index={6} title="Going live" icon={icon(Radio)}>
        <LegalText>
          A live stream is the hardest thing on here to take back, so the line
          sits earlier.
        </LegalText>
        <LegalClause title="While you are live">
          Everything above applies in real time, and it applies to what is
          behind you as much as to you. Do not stream somebody who has not
          agreed to be on camera, do not stream while driving, and do not
          stream a place where people are expecting privacy.
        </LegalClause>
        <LegalClause title="Your chat is yours to run">
          A host is responsible for the room. Moderate it, or the stream is
          treated as carrying what is in it.
        </LegalClause>
      </LegalSection>

      <LegalSection index={7} title="Other people's privacy" icon={icon(ShieldAlert)}>
        <LegalClause title="Do not post what is not yours to post">
          Somebody else&apos;s phone number, address, CID or workplace, their
          medical or financial details, screenshots of a private chat, or
          photographs of them taken to embarrass. Their being wrong in the
          argument does not change this.
        </LegalClause>
        <LegalClause title="Location">
          Sharing your own location is a choice you make per post and per
          delivery. Sharing somebody else&apos;s is never yours to make.
        </LegalClause>
      </LegalSection>

      <LegalSection index={8} title="Deliveries" icon={icon(Bike)}>
        <LegalClause title="Both ends of a Mongoose run">
          Say where it is going and what is in it. Nothing from the prohibited
          list above goes in a delivery, and a rider may refuse anything they
          were not told about.
        </LegalClause>
        <LegalClause title="Riders are people using this app too">
          Everything in section 2 applies to the person who turns up at your
          door, and to the person who opens it.
        </LegalClause>
      </LegalSection>

      <LegalSection index={9} title="Spam" icon={icon(Ban)}>
        <LegalBullets
          items={[
            {
              term: "Repetition.",
              text: "The same listing posted many times, or across categories it does not belong to, to sit at the top of the feed.",
            },
            {
              term: "Unsolicited selling in chat.",
              text: "Messaging people who never contacted you about your listing.",
            },
            {
              term: "Off-platform funnels.",
              text: "Posts whose only content is a link somewhere else, and listings that exist to collect contact details.",
            },
            {
              term: "Engagement bait.",
              text: "Fake giveaways, and asking for follows or shares in exchange for something that does not exist.",
            },
          ]}
        />
      </LegalSection>

      <LegalSection index={10} title="Reporting something" icon={icon(Flag)}>
        <LegalText strong>
          Report it rather than arguing with it in the comments.
        </LegalText>
        <LegalClause title="How">
          Every post, product, profile and comment has a report option in its
          menu, with a reason to pick and room to explain. Reports are not
          shown to the person you reported.
        </LegalClause>
        <LegalClause title="Blocking">
          Blocking is immediate and does not need a reason. It is the right
          tool for somebody you simply do not want to hear from; reporting is
          for something that breaks a rule here.
        </LegalClause>
        <LegalClause title="Reporting in bad faith">
          Mass-reporting a seller you compete with, or a person you are in a
          dispute with, is itself a violation.
        </LegalClause>
        <LegalClause title="Something urgent">
          If somebody is in danger, contact the police first. Reporting it here
          does not reach anyone faster than they do.
        </LegalClause>
      </LegalSection>

      <LegalSection index={11} title="What happens when a rule is broken" icon={icon(Gavel)}>
        <LegalText>
          Not everything is the same size, so the response is not either. Most
          first breaches end at the first step.
        </LegalText>
        <LegalBullets
          items={[
            { term: "The content comes down,", text: "and you are told which rule it was." },
            { term: "A feature is paused —", text: "listing, commenting, going live or messaging — for a period." },
            { term: "The account is suspended", text: "while something serious is looked at." },
            { term: "The account is closed", text: "for the things section 2 says have no warning step, or after repeated breaches." },
          ]}
        />
        <LegalClause title="Where seriousness comes from">
          What the content was, whether it was aimed at a particular person,
          whether money changed hands, and what has happened on the account
          before. A pattern is weighed more heavily than one bad day.
        </LegalClause>
        <LegalClause title="If we get it wrong">
          Every enforcement notice can be replied to, and a person reads the
          reply. Send it through Settings › Help Center › Send feedback if the
          notice is no longer in front of you.
        </LegalClause>
      </LegalSection>
    </LegalScreen>
  );
}
