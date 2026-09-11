/**
 * Terms of Service.
 *
 * The wording is unchanged — this is a legal document and rewriting the
 * clauses is not a UI change. What changed is that it now reads like one:
 * see `components/settings/LegalDocument.tsx` for what it replaced and why.
 *
 * Two pieces of copy did go. The amber "alert" at the top said the same
 * thing as the first clause, so it became the lede. The navy footer thanked
 * the reader and asked them to click an "I Agree" button that does not exist
 * on this screen — it is opened read-only from Settings and from a link on
 * the sign-up form, and neither presents an accept control here.
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
  AlertCircle,
  BadgeCheck,
  CreditCard,
  FileText,
  Gavel,
  Users as GroupIcon,
  RefreshCw,
  Shield,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react-native";
import React from "react";

interface TermsOfServiceProps {
  onClose?: () => void;
}

const icon = (Icon: typeof Shield) => (
  <Icon size={20} color={LEGAL_ICON} strokeWidth={1.8} />
);

export default function TermsOfService({ onClose }: TermsOfServiceProps) {
  return (
    <LegalScreen
      title="Terms of Service"
      onClose={onClose}
      updated="January 2025"
      version="1.0"
      lede="By registering for an account, accessing, or using NamZoed, you agree to be bound by these Terms. If you do not agree to them, you may not use the app. Please read them carefully."
    >
      <LegalSection index={1} title="Acceptance of Terms" icon={icon(Shield)}>
        <LegalText>
          By clicking &ldquo;I Agree&rdquo; or &ldquo;Sign Up,&rdquo; you affirm
          that you have read, understood, and agreed to be legally bound by
          these Terms and the associated Privacy Policy.
        </LegalText>
      </LegalSection>

      <LegalSection index={2} title="The NamZoed Service" icon={icon(Store)}>
        <LegalText strong>
          NamZoed operates as a digital marketplace and directory service.
        </LegalText>
        <LegalClause title="What we do">
          NamZoed&apos;s primary function is to provide a platform that connects
          Buyers (seeking products or services) and Sellers/Service Providers
          (listing products or services) within Bhutan. We facilitate
          connection, communication, and listing.
        </LegalClause>
        <LegalClause title="What we do not do">
          NamZoed is not a traditional retailer, auctioneer, or service
          provider. We do not hold inventory, set prices, execute final
          payments, or guarantee the quality or legality of items or services
          listed. NamZoed is not a party to the actual transaction between
          Buyers and Sellers.
        </LegalClause>
      </LegalSection>

      <LegalSection index={3} title="Account & Security" icon={icon(GroupIcon)}>
        <LegalClause number="3.1" title="Eligibility">
          You must provide accurate, complete, and current information during
          registration.
        </LegalClause>
        <LegalClause number="3.2" title="Security">
          You are responsible for safeguarding your password and any activities
          or actions under your account. You agree to notify NamZoed immediately
          if you suspect any unauthorized use of your account.
        </LegalClause>
        <LegalClause number="3.3" title="Single Account">
          Users may maintain only one active account. Sellers may operate a
          business account alongside a personal buyer account, provided all
          information is transparent and accurate.
        </LegalClause>
      </LegalSection>

      <LegalSection index={4} title="Rules for All Users" icon={icon(BadgeCheck)}>
        <LegalClause number="4.1" title="Lawful Use">
          You agree to use the app only for lawful purposes. You must not list,
          purchase, or exchange any item or service that violates any law of the
          Kingdom of Bhutan or your relevant jurisdiction.
        </LegalClause>
        <LegalClause number="4.2" title="Respectful Conduct">
          All communications on the app (including chat and live streams) must
          be respectful, honest, and professional. Harassment, abuse,
          discriminatory, or offensive language is strictly prohibited.
        </LegalClause>
        <LegalClause number="4.3" title="No Fraud">
          You shall not manipulate the platform, pricing, listing descriptions,
          or reviews, or engage in any fraudulent activity.
        </LegalClause>
      </LegalSection>

      <LegalSection
        index={5}
        title="Rules for Sellers"
        note="Tshongpas"
        icon={icon(ShieldCheck)}
      >
        <LegalClause number="5.1" title="Accurate Listings">
          Listings must accurately and clearly describe the item or service,
          including its condition, price, and location. Photos must be of the
          actual product or represent the service offered.
        </LegalClause>
        <LegalClause number="5.2" title="Legality of Goods">
          Sellers are solely responsible for ensuring that all listed products
          are legal, not counterfeit, and safe for sale and use. Prohibited
          items include (but are not limited to) illegal drugs, stolen goods,
          weapons, pornography, and items infringing on intellectual property
          rights.
        </LegalClause>
        <LegalClause number="5.3" title="Transaction Obligation">
          If a transaction is agreed upon, the Seller must fulfill the order or
          service as described in the listing and within the agreed timeline.
        </LegalClause>
        <LegalClause number="5.4" title="Taxes and Fees">
          Sellers are solely responsible for all taxes, fees, and regulatory
          requirements associated with the sale of their goods and services in
          Bhutan. NamZoed is not responsible for filing or calculating these
          liabilities.
        </LegalClause>
      </LegalSection>

      <LegalSection index={6} title="Payments & Exchange" icon={icon(CreditCard)}>
        <LegalClause number="6.1" title="Payment">
          NamZoed does not process the final payment for goods or services.
          Buyers and Sellers agree on the payment method directly (e.g. cash on
          delivery, bank transfer, local payment apps). NamZoed assumes no
          responsibility for payment disputes, failure to pay, or fraud related
          to payment.
        </LegalClause>
        <LegalClause number="6.2" title="Safe Exchange Points">
          NamZoed encourages the use of designated Office of NamZoed locations
          for safe, verifiable exchange of goods. Use of this service does not
          make NamZoed responsible for the item&apos;s condition or quality,
          only for providing a supervised meeting space.
        </LegalClause>
        <LegalClause number="6.3" title="Disputes">
          In the event of a dispute between a Buyer and Seller, both parties
          agree to first attempt to resolve the issue amicably. NamZoed may, but
          is not obligated to, assist in mediation at its sole discretion.
        </LegalClause>
      </LegalSection>

      <LegalSection index={7} title="Intellectual Property" icon={icon(FileText)}>
        <LegalClause number="7.1" title="Your Content">
          You retain all ownership rights to the content you submit to the app
          (photos, listings, messages). By submitting content, you grant NamZoed
          a worldwide, royalty-free license to use, reproduce, modify, and
          display your content in connection with the operation and promotion of
          the app.
        </LegalClause>
        <LegalClause number="7.2" title="NamZoed IP">
          All rights, title, and interest in and to the app (excluding
          user-provided content), including its design, logo, functionality, and
          software, are the exclusive property of NamZoed.
        </LegalClause>
      </LegalSection>

      <LegalSection
        index={8}
        title="Limitation of Liability"
        icon={icon(AlertCircle)}
      >
        <LegalText>
          NamZoed is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis. NamZoed shall not be liable for any direct,
          indirect, incidental, special, consequential, or punitive damages,
          including loss of profits, data, goodwill, or other intangible losses,
          resulting from:
        </LegalText>
        <LegalClause>
          <LegalBullets
            items={[
              { term: "(a)", text: "your access to or use of the app;" },
              {
                term: "(b)",
                text: "the conduct or content of any third party on the app; or",
              },
              {
                term: "(c)",
                text: "any items purchased or services obtained through the app.",
              },
            ]}
          />
        </LegalClause>
      </LegalSection>

      <LegalSection index={9} title="Termination" icon={icon(XCircle)}>
        <LegalText>
          NamZoed may terminate or suspend your account immediately, without
          prior notice or liability, for any offence, including without
          limitation if you breach the Terms. Upon termination, your right to use
          the app will immediately cease.
        </LegalText>
      </LegalSection>

      <LegalSection index={10} title="Governing Law" icon={icon(Gavel)}>
        <LegalText>
          These Terms shall be governed by and construed in accordance with the
          laws of the Kingdom of Bhutan and your relevant jurisdiction, without
          regard to its conflict of law provisions.
        </LegalText>
      </LegalSection>

      <LegalSection index={11} title="Changes to Terms" icon={icon(RefreshCw)}>
        <LegalText>
          NamZoed reserves the right, at its sole discretion, to modify or
          replace these Terms at any time. If a revision is material, we will
          provide at least 30 days&apos; notice before any new terms take
          effect. By continuing to access or use the app after those revisions
          become effective, you agree to be bound by the revised terms.
        </LegalText>
      </LegalSection>
    </LegalScreen>
  );
}
