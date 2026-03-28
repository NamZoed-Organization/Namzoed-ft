import TopNavbar from "@/components/ui/TopNavbar";
import { useAppRouter } from "@/utils/navigation";
import {
  ChevronLeft,
  Dribbble,
  Goal,
  MapPin,
  Plus,
  Users,
  Waves,
} from "lucide-react-native";
import React, { useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

type GroundTab = "grounds" | "providers";
type GroundFilter = "football" | "basketball" | "swimming";

const groundFilters = [
  {
    key: "football" as const,
    label: "Football",
    count: 0,
    Icon: Goal,
  },
  {
    key: "basketball" as const,
    label: "Basketball",
    count: 0,
    Icon: Dribbble,
  },
  {
    key: "swimming" as const,
    label: "Swimming",
    count: 0,
    Icon: Waves,
  },
];

export default function GroundBookingsPage() {
  const router = useAppRouter();
  const [activeTab, setActiveTab] = useState<GroundTab>("grounds");
  const [activeFilter, setActiveFilter] = useState<GroundFilter>("football");
  const [showAddPopup, setShowAddPopup] = useState(false);

  return (
    <View className="flex-1 bg-background">
      <TopNavbar />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="px-4 pt-3">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center"
          >
            <ChevronLeft size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <View className="px-4 pt-4">
          <Text className="text-[28px] font-mbold text-black mb-1">
            Coming Soon
          </Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[24px] font-mbold text-gray-900">
                Ground Bookings
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                Browse grounds and providers by sport
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowAddPopup(true)}
              activeOpacity={0.85}
              className="bg-primary rounded-full px-4 py-2.5 flex-row items-center"
            >
              <Plus size={16} color="white" />
              <Text className="text-white text-sm font-msemibold ml-1.5">
                Add
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-5 bg-[#E4EEF3] rounded-2xl p-1.5 flex-row border border-[#D2E2EA]">
            <TouchableOpacity
              onPress={() => setActiveTab("grounds")}
              activeOpacity={0.85}
              className={`flex-1 rounded-[14px] py-3 items-center ${
                activeTab === "grounds" ? "bg-black" : ""
              }`}
            >
              <Text
                className={`text-sm font-msemibold ${
                  activeTab === "grounds" ? "text-white" : "text-gray-500"
                }`}
              >
                Grounds
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("providers")}
              activeOpacity={0.85}
              className={`flex-1 rounded-[14px] py-3 items-center ${
                activeTab === "providers" ? "bg-black" : ""
              }`}
            >
              <Text
                className={`text-sm font-msemibold ${
                  activeTab === "providers" ? "text-white" : "text-gray-500"
                }`}
              >
                Service Providers
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === "grounds" ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-5"
                contentContainerStyle={{ paddingRight: 8 }}
              >
                {groundFilters.map(({ key, label, count, Icon }) => {
                  const isActive = activeFilter === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setActiveFilter(key)}
                      activeOpacity={0.85}
                      className={`mr-2 rounded-full border px-3 py-2 ${
                        isActive
                          ? "border-primary bg-[#EEF7FC]"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <View className="flex-row items-center">
                        <View
                          className={`w-8 h-8 rounded-full items-center justify-center ${
                            isActive ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          <Icon
                            size={20}
                            color={isActive ? "#094569" : "#6B7280"}
                          />
                        </View>

                        <View
                          className={`px-2 py-0.5 rounded-full ml-2 ${
                            isActive ? "bg-primary" : "bg-gray-100"
                          }`}
                        >
                          <Text
                            className={`text-[11px] font-msemibold ${
                              isActive ? "text-white" : "text-gray-600"
                            }`}
                          >
                            {count}
                          </Text>
                        </View>
                        <Text
                          className={`text-xs font-msemibold ml-2 ${
                            isActive ? "text-primary" : "text-gray-800"
                          }`}
                        >
                          {label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View className="mt-5 bg-white rounded-3xl border border-gray-100 p-4">
                <View className="flex-row items-center mb-3">
                  <View className="w-11 h-11 rounded-2xl bg-[#EEF7FC] items-center justify-center mr-3">
                    {activeFilter === "football" && <Goal size={20} color="#094569" />}
                    {activeFilter === "basketball" && <Dribbble size={20} color="#094569" />}
                    {activeFilter === "swimming" && <Waves size={20} color="#094569" />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-msemibold text-gray-900">
                      {groundFilters.find((item) => item.key === activeFilter)?.label} grounds will show here
                    </Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                      This area is ready for your ground listings.
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center">
                  <MapPin size={14} color="#6B7280" />
                  <Text className="text-xs text-gray-500 ml-2">
                    Placeholder section for the selected sport
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View className="mt-5 gap-3">
              <View className="bg-white rounded-3xl border border-gray-100 p-4">
                <View className="flex-row items-center mb-3">
                  <View className="w-11 h-11 rounded-2xl bg-[#EEF7FC] items-center justify-center mr-3">
                    <Users size={20} color="#094569" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-msemibold text-gray-900">
                      Providers will show here
                    </Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                      This tab will highlight providers offering this booking service.
                    </Text>
                  </View>
                </View>

                <Text className="text-xs text-gray-500">
                  Dummy provider tab for now
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={showAddPopup}
        animationType="fade"
        onRequestClose={() => setShowAddPopup(false)}
      >
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <View className="w-full max-w-sm bg-white rounded-[28px] p-6">
            <Text className="text-xl font-mbold text-gray-900 mb-2">
              Add Ground Booking
            </Text>
            <Text className="text-sm text-gray-500 mb-6">
              Dummy popup for the upcoming add ground booking flow.
            </Text>

            <TouchableOpacity
              onPress={() => setShowAddPopup(false)}
              activeOpacity={0.85}
              className="bg-primary rounded-2xl py-3 items-center"
            >
              <Text className="text-white font-msemibold text-sm">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
