/**
 * Privacy Policy.
 *
 * Same treatment as the Terms, for the same reasons — see
 * `components/settings/LegalDocument.tsx`. The wording is unchanged; the navy
 * hero, the seven coloured section tiles, the amber/blue/green/red/grey
 * callout boxes and the navy footer card are not.
 *
 * The amber alert at the top ("By using NamZoed Services, you are consenting
 * to the practices described in this Privacy Notice") became the lede, where
 * it is read first instead of being a decorated aside above the first clause.
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
  Database,
  Eye,
  FileText,
  Lock,
  Settings,
  Share2,
  Users,
} from "lucide-react-native";
import React from "react";

interface PrivacyPolicyProps {
  onClose?: () => void;
}

const icon = (Icon: typeof Users) => (
  <Icon size={20} color={LEGAL_ICON} strokeWidth={1.8} />
);

export default function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
  return (
    <LegalScreen
      title="Privacy Policy"
      onClose={onClose}
      updated="March 2026"
      version="1.0"
      lede="NamZoed knows that you care how information about you is used and shared, and we appreciate your trust that we will do so carefully and sensibly. By using NamZoed, you consent to the practices described here."
    >
      <LegalSection index={1} title="Applicability & Scope" icon={icon(Users)}>
        <LegalText>
          This policy applies to all users of NamZoed, including individual
          buyers, sellers (Tshongpas), and service providers across the 20
          Dzongkhags, the Gelephu Mindfulness City (GMC) and the world.
        </LegalText>
        <LegalClause title="Permissible age">
          Our services are intended for users aged 18 and older. If you are
          under 18, you may use NamZoed only with the involvement of a parent or
          guardian.
        </LegalClause>
        <LegalClause title="Consent">
          Your continued use of the platform signifies acceptance of this
          policy.
        </LegalClause>
      </LegalSection>

      <LegalSection
        index={2}
        title="Information We Collect"
        icon={icon(Database)}
      >
        <LegalText>
          We collect your personal information in order to provide and
          continually improve our products and services.
        </LegalText>
        <LegalClause number="A." title="Information you give us">
          <LegalBullets
            items={[
              {
                term: "Identity & verification (KYC):",
                text: "full name, CID details, and business licenses.",
              },
              {
                term: "Contact information:",
                text: "mobile numbers, email addresses, and delivery addresses.",
              },
              {
                term: "Content:",
                text: "product reviews, photographs, videos and voice recordings.",
              },
              {
                term: "Corporate/financial:",
                text: "bank account information for seller identity verification and payment settlement.",
              },
            ]}
          />
        </LegalClause>
        <LegalClause number="B." title="Automatic information">
          <LegalBullets
            items={[
              {
                term: "Usage metrics:",
                text: "products viewed, search queries, and page response times.",
              },
              {
                term: "Device details:",
                text: "IP address, device log files, and Wi-Fi credentials (if synchronized).",
              },
              {
                term: "Location:",
                text: "real-time GPS coordinates to facilitate local trade and exchange point logistics.",
              },
            ]}
          />
        </LegalClause>
        <LegalClause number="C." title="Information from other sources">
          We might receive updated delivery information from our carriers or
          verification data from the authorities to ensure the authenticity of
          regional products.
        </LegalClause>
      </LegalSection>

      <LegalSection index={3} title="How We Use Your Information" icon={icon(Eye)}>
        <LegalText>
          We use your personal information to operate, provide, and improve the
          NamZoed experience.
        </LegalText>
        <LegalClause title="Purchase & delivery">
          Handling orders, processing payments, and facilitating Safe Exchange
          Point drop-offs.
        </LegalClause>
        <LegalClause title="Recommendations & personalization">
          Identifying your preferences to suggest local Tshongpas or services
          that might interest you.
        </LegalClause>
        <LegalClause title="Fraud prevention & credit risk">
          We use personal information to prevent and detect fraud, to protect
          the security of our customers and the NamZoed community.
        </LegalClause>
        <LegalClause title="Comply with legal obligations">
          Verifying seller identities to comply with Bhutanese trade and tax
          laws.
        </LegalClause>
      </LegalSection>

      <LegalSection
        index={4}
        title="How We Share Your Information"
        icon={icon(Share2)}
      >
        <LegalText strong>
          Information about our customers is a vital part of our business, and
          we are not in the business of selling your personal information to
          others.
        </LegalText>
        <LegalClause title="Third-party transactions">
          When you buy from a third-party seller or hire a service provider, we
          share the necessary information to complete that transaction.
        </LegalClause>
        <LegalClause title="Service providers">
          We employ other companies to perform functions like package delivery,
          data analysis, and payment processing. They have access to information
          needed to perform their functions but may not use it for other
          purposes.
        </LegalClause>
        <LegalClause title="Protection of NamZoed & others">
          We release account information when appropriate to comply with
          Bhutanese law and the laws of relevant jurisdictions, or to protect
          the safety of our users.
        </LegalClause>
      </LegalSection>

      <LegalSection
        index={5}
        title="Security: The Trust Fortress"
        icon={icon(Lock)}
      >
        <LegalText>
          We design our systems with your security and privacy in mind.
        </LegalText>
        <LegalClause title="Transmission security">
          We use encryption protocols (SSL/TLS) to protect your data during
          transmission.
        </LegalClause>
        <LegalClause title="Payment standards">
          We follow the Payment Card Industry Data Security Standard (PCI DSS)
          when handling card data.
        </LegalClause>
        <LegalClause title="Identity verification">
          Our procedures mean that we may ask to verify your identity before we
          disclose personal information to you.
        </LegalClause>
        <LegalClause title="User responsibility">
          It is important for you to protect against unauthorized access to your
          password. We recommend signing off when finished using a shared
          device.
        </LegalClause>
      </LegalSection>

      <LegalSection
        index={6}
        title="Your Choices & Access"
        icon={icon(Settings)}
      >
        <LegalText>
          NamZoed provides you with significant control over your data.
        </LegalText>
        <LegalClause title="Access to data">
          You can access your products, services, order history, name, address,
          and payment options in the &ldquo;My Account&rdquo; section.
        </LegalClause>
        <LegalClause title="Updating information">
          When you update data, we usually keep a copy of the prior version for
          our records.
        </LegalClause>
        <LegalClause title="Communication preferences">
          You can choose not to receive emails or in-app notifications by
          adjusting your notification settings.
        </LegalClause>
        <LegalClause title="Deletion">
          To the extent required by law, you may request the deletion of your
          personal information.
        </LegalClause>
      </LegalSection>

      <LegalSection
        index={7}
        title="Conditions of Use & Revisions"
        icon={icon(FileText)}
      >
        <LegalText>
          If you choose to use NamZoed, any dispute over privacy is subject to
          this Notice and our Conditions of Use. Our business changes
          constantly, and our Privacy Notice will change also. Unless stated
          otherwise, our current Privacy Notice applies to all information that
          we have about you and your account.
        </LegalText>
      </LegalSection>
    </LegalScreen>
  );
}
