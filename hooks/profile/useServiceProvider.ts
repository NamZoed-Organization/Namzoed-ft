import { useUser } from "@/contexts/UserContext";
import {
  fetchServiceProviderProfile,
  fetchUserProviderServices,
  ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { useEffect, useState } from "react";

export const useServiceProvider = (refreshKey: number) => {
  const { currentUser } = useUser();
  const [serviceProvider, setServiceProvider] = useState<any>(null);
  const [loadingServiceProvider, setLoadingServiceProvider] = useState(false);
  const [providerFormData, setProviderFormData] = useState({
    businessName: "",
    email: "",
    phone: "",
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

  // Load service provider profile
  useEffect(() => {
    const loadServiceProvider = async () => {
      if (!currentUser?.id) return;

      try {
        setLoadingServiceProvider(true);
        const providerData = await fetchServiceProviderProfile(currentUser.id);
        setServiceProvider(providerData);

        // Populate form data and avatar
        if (providerData) {
          setProviderFormData({
            businessName: "",
            email: providerData.profiles?.email || "",
            phone: providerData.profiles?.phone || "",
            bio: providerData.master_bio || "",
          });
          // Load provider avatar
          if (providerData.profile_url) {
            setProviderImageUri(providerData.profile_url);
          }
          // Load license URL from identification jsonb
          if (providerData.identification?.licenseUrl) {
            setLicenseImageUrl(providerData.identification.licenseUrl);
          }
          // Load verification status
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

    loadServiceProvider();
  }, [currentUser?.id, refreshKey]);

  // Load user's provider services
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

    loadProviderServices();
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
