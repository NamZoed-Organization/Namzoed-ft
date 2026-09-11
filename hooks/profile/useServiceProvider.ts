import { useUser } from "@/contexts/UserContext";
import {
  fetchServiceProviderProfile,
  fetchUserProviderServices,
  ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { peekCache, readCache, writeCache } from "@/lib/queryCache";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

const providerCacheKey = (userId: string) => `profile:provider:${userId}`;
const providerServicesCacheKey = (userId: string) => `profile:providerServices:${userId}`;

function applyProviderData(
  providerData: any,
  setProviderFormData: (v: any) => void,
  setProviderImageUri: (v: string | null) => void,
  setLicenseImageUrl: (v: string | null) => void,
  setVerificationStatus: (v: "verified" | "not_verified" | "pending") => void,
) {
  if (!providerData) return;
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
  setVerificationStatus(providerData.verification_status || "not_verified");
}

export const useServiceProvider = (refreshKey: number, viewUserId?: string) => {
  const { currentUser } = useUser();
  const targetUserId = viewUserId ?? currentUser?.id;
  const cachedProvider = targetUserId
    ? peekCache<any>(providerCacheKey(targetUserId))?.data ?? null
    : null;
  const cachedProviderServices = targetUserId
    ? peekCache<ProviderServiceWithDetails[]>(providerServicesCacheKey(targetUserId))?.data ?? null
    : null;

  const [serviceProvider, setServiceProvider] = useState<any>(cachedProvider);
  const [loadingServiceProvider, setLoadingServiceProvider] = useState(!cachedProvider);
  const [providerFormData, setProviderFormData] = useState({
    businessName: cachedProvider?.name || "",
    email: cachedProvider?.email || "",
    contact: cachedProvider?.contact || "",
    emailActive: cachedProvider?.email_active || false,
    contactActive: cachedProvider?.contact_active || false,
    bio: cachedProvider?.master_bio || "",
  });
  const [providerImageUri, setProviderImageUri] = useState<string | null>(
    cachedProvider?.profile_url ?? null,
  );
  const [licenseImageUrl, setLicenseImageUrl] = useState<string | null>(
    cachedProvider?.identification?.licenseUrl ?? null,
  );
  const [verificationStatus, setVerificationStatus] = useState<
    "verified" | "not_verified" | "pending"
  >(cachedProvider?.verification_status || "not_verified");
  const [providerServices, setProviderServices] = useState<
    ProviderServiceWithDetails[]
  >(cachedProviderServices ?? []);
  const [loadingProviderServices, setLoadingProviderServices] = useState(!cachedProviderServices);

  useEffect(() => {
    const loadServiceProvider = async () => {
      if (!targetUserId) return;
      const key = providerCacheKey(targetUserId);

      try {
        const cached = await readCache<any>(key);
        if (cached) {
          setServiceProvider(cached.data);
          applyProviderData(cached.data, setProviderFormData, setProviderImageUri, setLicenseImageUrl, setVerificationStatus);
          setLoadingServiceProvider(false);
        } else {
          setLoadingServiceProvider(true);
        }

        const providerData = await fetchServiceProviderProfile(targetUserId);
        setServiceProvider(providerData);
        applyProviderData(providerData, setProviderFormData, setProviderImageUri, setLicenseImageUrl, setVerificationStatus);
        await writeCache(key, providerData);
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
      const key = providerServicesCacheKey(targetUserId);

      try {
        const cached = await readCache<ProviderServiceWithDetails[]>(key);
        if (cached) {
          setProviderServices(cached.data);
          setLoadingProviderServices(false);
        } else {
          setLoadingProviderServices(true);
        }

        const services = await fetchUserProviderServices(targetUserId);
        setProviderServices(services);
        await writeCache(key, services);
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
