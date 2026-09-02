import { useUser } from "@/contexts/UserContext";
import {
  fetchServiceProviderProfile,
  fetchUserProviderServices,
  ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

export const useServiceProvider = (refreshKey: number, viewUserId?: string) => {
  const { currentUser } = useUser();
  const targetUserId = viewUserId ?? currentUser?.id;
  const [serviceProvider, setServiceProvider] = useState<any>(null);
  const [loadingServiceProvider, setLoadingServiceProvider] = useState(false);
  const [providerFormData, setProviderFormData] = useState({
    businessName: "",
    email: "",
    contact: "",
    emailActive: false,
    contactActive: false,
    bio: "",
  });
  const [providerImageUri, setProviderImageUri] = useState<string | null>(null);
  const [licenseImageUrl, setLicenseImageUrl] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    "verified" | "not_verified" | "pending"
  >("not_verified");
  const [providerServices, setProviderServices] = useState<
    ProviderServiceWithDetails[]
  >([]);
  const [loadingProviderServices, setLoadingProviderServices] = useState(false);

  useEffect(() => {
    const loadServiceProvider = async () => {
      if (!targetUserId) return;

      try {
        setLoadingServiceProvider(true);
        const providerData = await fetchServiceProviderProfile(targetUserId);
        setServiceProvider(providerData);

        if (providerData) {
          setProviderFormData({
            businessName: providerData.name || "",
            email: providerData.email || "",
            contact: providerData.contact || "",
            emailActive: providerData.email_active || false,
            contactActive: providerData.contact_active || false,
            bio: providerData.master_bio || "",
          });
          if (providerData.profile_url) {
            setProviderImageUri(providerData.profile_url);
          }
          if (providerData.identification?.licenseUrl) {
            setLicenseImageUrl(providerData.identification.licenseUrl);
          }
          setVerificationStatus(
            providerData.verification_status || "not_verified",
          );
        }
      } catch (error) {
        console.error("Failed to fetch service provider data:", error);
      } finally {
        setLoadingServiceProvider(false);
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      loadServiceProvider();
    });
    return () => task.cancel();
  }, [targetUserId, refreshKey]);

  useEffect(() => {
    const loadProviderServices = async () => {
      if (!targetUserId) return;

      try {
        setLoadingProviderServices(true);
        const services = await fetchUserProviderServices(targetUserId);
        setProviderServices(services);
      } catch (error) {
        console.error("Failed to fetch provider services:", error);
      } finally {
        setLoadingProviderServices(false);
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      loadProviderServices();
    });
    return () => task.cancel();
  }, [targetUserId, refreshKey]);

  return {
    serviceProvider,
    setServiceProvider,
    loadingServiceProvider,
    providerFormData,
    setProviderFormData,
    providerImageUri,
    setProviderImageUri,
    licenseImageUrl,
    setLicenseImageUrl,
    verificationStatus,
    setVerificationStatus,
    providerServices,
    setProviderServices,
    loadingProviderServices,
  };
};
