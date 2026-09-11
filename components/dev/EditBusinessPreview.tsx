/**
 * EditBusinessPreview  (dev only)
 *
 * The Edit business hub and every page that slides out of it, driven by
 * fixtures instead of the database.
 *
 * The license page is the reason this exists: its three states are the ones
 * nobody can see on their own account. "Being reviewed" and "Verified" are
 * set by a reviewer, not by the seller, so judging that screen otherwise
 * means uploading a document and then editing `verification_status` by hand
 * in Postgres — which is exactly the cost the previews rule is about.
 *
 * It composes the REAL EditWorkProfile, so the hub, the field pages, the
 * business type page, the license page and the service page are all the
 * shipping components. A preview built from lookalikes only tells you how
 * the lookalikes render.
 *
 * Not reachable outside Settings › Dev Components.
 */

import EditWorkProfile, { type WorkProfileForm } from "@/components/profile/EditWorkProfile";
import { serviceCategories } from "@/data/servicecategory";
import { ChevronLeft } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Status = "verified" | "pending" | "not_verified";

/** A real, reachable image — the license page shows the document rather than
 *  hiding it behind a "View" action, so a placeholder colour would be
 *  previewing the wrong thing. */
const SAMPLE_DOC =
  "https://images.unsplash.com/photo-1568234928966-359c35dd8327?auto=format&fit=crop&w=900&q=60";

const FILLED_FORM: WorkProfileForm = {
  businessName: "Norling Handicrafts",
  bio: "Hand-woven kira and textiles, made in Thimphu since 2016.",
  email: "hello@norling.bt",
  contact: "17 22 44 88",
  emailActive: true,
  contactActive: true,
};

const EMPTY_FORM: WorkProfileForm = {
  businessName: "",
  bio: "",
  email: "",
  contact: "",
  emailActive: false,
  contactActive: false,
};

const SERVICE_FIXTURES = [
  {
    id: "s1",
    name: "Custom kira weaving",
    status: true,
    preview: {
      name: "Custom kira weaving",
      description:
        "Woven to your measurements in your choice of pattern. Four to six weeks, depending on the design.",
      images: [] as string[],
    },
  },
  { id: "s2", name: "Repairs and re-hemming", status: true, preview: { name: "Repairs and re-hemming", description: "", images: [] as string[] } },
  { id: "s3", name: "Weaving workshop", status: false, preview: { name: "Weaving workshop", description: "A half-day introduction for up to six people.", images: [] as string[] } },
];

interface EditBusinessPreviewProps {
  visible: boolean;
  onClose: () => void;
}

export default function EditBusinessPreview({ visible, onClose }: EditBusinessPreviewProps) {
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<Status>("not_verified");
  const [hasDocument, setHasDocument] = useState(false);
  const [filled, setFilled] = useState(true);
  const [serviceCount, setServiceCount] = useState(3);
  const [typeSlug, setTypeSlug] = useState<string | null>("repair-maintenance");
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const typeName = serviceCategories.find((category) => category.slug === typeSlug)?.name ?? null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
        <StatusBar barStyle="dark-content" />

        <View className="flex-row items-center px-3 pb-3 pt-1">
          <TouchableOpacity onPress={onClose} className="p-1 mr-1">
            <ChevronLeft size={26} color="#111827" />
          </TouchableOpacity>
          <Text className="text-[17px] font-semibold text-gray-900">Edit business</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, lineHeight: 18 }}>
            Set the fixture, then open the editor. Everything inside is the real screen — the field
            pages, the business type page, the license page and the service page all slide on the
            same stack.
          </Text>

          <Label>License state</Label>
          <Row>
            <Chip
              label="Not uploaded"
              active={status === "not_verified" && !hasDocument}
              onPress={() => {
                setStatus("not_verified");
                setHasDocument(false);
              }}
            />
            <Chip
              label="Being reviewed"
              active={status === "pending"}
              onPress={() => {
                setStatus("pending");
                setHasDocument(true);
              }}
            />
            <Chip
              label="Verified"
              active={status === "verified"}
              onPress={() => {
                setStatus("verified");
                setHasDocument(true);
              }}
            />
            {/* The fourth state, and the one that is easy to forget: a
                document that was uploaded and then rejected or reset. */}
            <Chip
              label="Rejected (doc, unverified)"
              active={status === "not_verified" && hasDocument}
              onPress={() => {
                setStatus("not_verified");
                setHasDocument(true);
              }}
            />
          </Row>

          <Label>Upload in flight</Label>
          <Row>
            <Chip label="Idle" active={!uploading} onPress={() => setUploading(false)} />
            <Chip label="Uploading" active={uploading} onPress={() => setUploading(true)} />
          </Row>

          <Label>Details</Label>
          <Row>
            <Chip label="Filled in" active={filled} onPress={() => setFilled(true)} />
            <Chip label="Nothing set" active={!filled} onPress={() => setFilled(false)} />
          </Row>

          <Label>Services</Label>
          <Row>
            {[0, 1, 3].map((count) => (
              <Chip
                key={count}
                label={count === 0 ? "None" : `${count}`}
                active={serviceCount === count}
                onPress={() => setServiceCount(count)}
              />
            ))}
          </Row>

          <Label>Type</Label>
          <Row>
            <Chip
              label="Repairs"
              active={typeSlug === "repair-maintenance"}
              onPress={() => setTypeSlug("repair-maintenance")}
            />
            <Chip
              label="Taxi"
              active={typeSlug === "taxi-services"}
              onPress={() => setTypeSlug("taxi-services")}
            />
            <Chip label="Not set" active={typeSlug === null} onPress={() => setTypeSlug(null)} />
          </Row>

          <TouchableOpacity
            onPress={() => setOpen(true)}
            activeOpacity={0.85}
            style={{
              marginTop: 18,
              borderRadius: 12,
              borderCurve: "continuous",
              backgroundColor: "#094569",
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
              Open Edit business
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <EditWorkProfile
          visible={open}
          form={filled ? FILLED_FORM : EMPTY_FORM}
          logoUrl={null}
          verificationStatus={status}
          licenseUrl={hasDocument ? SAMPLE_DOC : null}
          uploadingLicense={uploading}
          onClose={() => setOpen(false)}
          onChangeLogo={() => {}}
          onSaveField={() => {}}
          onViewLicense={() => {}}
          onUploadLicense={() => {}}
          onRemoveLicense={() => {}}
          businessType={typeName}
          businessTypeSlug={typeSlug}
          onSaveBusinessType={(slug) => setTypeSlug(slug)}
          services={SERVICE_FIXTURES.slice(0, serviceCount)}
          onServicesChanged={() => {}}
        />
      </View>
    </Modal>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: "#9ca3af",
        letterSpacing: 0.6,
        marginTop: 12,
        marginBottom: 6,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{children}</View>;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderCurve: "continuous",
        backgroundColor: active ? "#094569" : "#f3f4f6",
        marginRight: 8,
        marginBottom: 6,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#fff" : "#111" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
