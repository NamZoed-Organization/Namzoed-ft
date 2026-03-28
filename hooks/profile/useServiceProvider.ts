import { useUser } from "@/contexts/UserContext";
import {
  fetchServiceProviderProfile,
  fetchUserProviderServices,
  ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

export const useServiceProvider = (refreshKey: number) => {
  const { currentUser } = useUser();
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
      if (!currentUser?.id) return;

      try {
        setLoadingServiceProvider(true);
        const providerData = await fetchServiceProviderProfile(currentUser.id);
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
  }, [currentUser?.id, refreshKey]);

  useEffect(() => {
    const loadProviderServices = async () => {
      if (!currentUser?.id) return;

      try {
        setLoadingProviderServices(true);
        const services = await fetchUserProviderServices(currentUser.id);
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
  }, [currentUser?.id, refreshKey]);

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
