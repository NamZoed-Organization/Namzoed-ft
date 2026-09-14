// lib/servicesService.ts
import type { RankableItem } from './feedRanking';
import { supabase } from './supabase';
import { uploadFileToSupabase } from './uploadFile';

export interface ProviderService {
  id: string;
  provider_id: string;
  category_id: string;
  name: string;
  description: string;
  images: string[];
  status: boolean;
  created_at: string;
  impressions_shown?: number;
  last_shown_at?: string | null;
  boost_started_at?: string | null;
  boost_expires_at?: string | null;
}

export interface ProviderServiceWithDetails extends ProviderService {
  service_categories?: {
    id: string;
    name: string;
    slug: string;
  };
  service_providers?: {
    id: string;
    user_id: string;
    name?: string;
    master_bio?: string;
    profile_url?: string;
    email?: string;
    contact?: string;
    email_active?: boolean;
    contact_active?: boolean;
    verification_status?: string;
    profiles?: {
      name?: string;
      email?: string;
      phone?: string;
      avatar_url?: string;
    };
  };
}

// Get or create service provider profile for current user
export const ensureServiceProvider = async (userId: string): Promise<string> => {
  const { data: existingProvider, error: fetchError } = await supabase
    .from('service_providers')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existingProvider) {
    return existingProvider.id;
  }

  const { data: newProvider, error: createError } = await supabase
    .from('service_providers')
    .insert({ user_id: userId })
    .select('id')
    .single();

  if (createError) {
    console.error('Error creating service provider:', createError);
    throw createError;
  }

  return newProvider.id;
};

// Get category UUID by slug
export const getCategoryIdBySlug = async (slug: string): Promise<string> => {
  const { data, error } = await supabase
    .from('service_categories')
    .select('id')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching category:', error);
    throw error;
  }

  return data.id;
};

// Upload single service image
export const uploadServiceImage = async (imageUri: string, providerId: string): Promise<string> => {
  try {
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const fileName = `${providerId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `services/${fileName}`;

    await uploadFileToSupabase(imageUri, 'service-images', filePath, `image/${fileExt}`);

    const { data: { publicUrl } } = supabase.storage
      .from('service-images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

// Upload multiple service images
export const uploadServiceImages = async (imageUris: string[], providerId: string): Promise<string[]> => {
  const uploadPromises = imageUris.map(uri => uploadServiceImage(uri, providerId));
  return await Promise.all(uploadPromises);
};

// Create a new provider service
export const createProviderService = async (
  userId: string,
  categorySlug: string,
  name: string,
  description: string,
  imageUris: string[]
): Promise<ProviderService> => {
  const providerId = await ensureServiceProvider(userId);
  const categoryId = await getCategoryIdBySlug(categorySlug);
  const imageUrls = imageUris.length > 0 ? await uploadServiceImages(imageUris, providerId) : [];

  const { data, error } = await supabase
    .from('provider_services')
    .insert({
      provider_id: providerId,
      category_id: categoryId,
      name,
      description,
      images: imageUrls,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating provider service:', error);
    throw error;
  }

  return data as ProviderService;
};

// Fetch all provider services by user ID
export const fetchUserProviderServices = async (userId: string): Promise<ProviderServiceWithDetails[]> => {
  // Step 1: get the service_provider row for this user
  const { data: sp } = await supabase
    .from('service_providers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!sp?.id) return [];

  // Step 2: filter provider_services by provider_id directly
  const { data, error } = await supabase
    .from('provider_services')
    .select(`
      *,
      service_categories (
        id,
        name,
        slug
      ),
      service_providers (
        id,
        user_id,
        master_bio,
        profile_url,
        name,
        email,
        contact,
        email_active,
        contact_active,
        verification_status,
        profiles (
          name,
          email,
          phone,
          avatar_url
        )
      )
    `)
    .eq('provider_id', sp.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user provider services:', error);
    throw error;
  }

  return (data || []) as ProviderServiceWithDetails[];
};

const SERVICE_WITH_DETAILS_SELECT = `
  *,
  service_categories!inner (
    id,
    name,
    slug
  ),
  service_providers (
    id,
    user_id,
    master_bio,
    profile_url,
    name,
    email,
    contact,
    email_active,
    contact_active,
    verification_status,
    profiles (
      name,
      email,
      phone,
      avatar_url
    )
  )`;

// ─── Ranked list (service category screen) ──────────────────────────────
// The order comes from feed_order_provider_services (lib/feedSession.ts);
// these fetch its rows by id, and the services newer than it.
export const fetchProviderServicesByIds = async (ids: string[]): Promise<ProviderServiceWithDetails[]> => {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('provider_services')
    .select(SERVICE_WITH_DETAILS_SELECT)
    .in('id', ids);
  if (error) throw error;
  return (data || []) as ProviderServiceWithDetails[];
};

/** Services in a category created after `asOf`, newest first — what a refresh adds. */
export const fetchProviderServicesCreatedSince = async (
  asOf: string,
  categorySlug: string,
  limit = 30,
): Promise<ProviderServiceWithDetails[]> => {
  const { data, error } = await supabase
    .from('provider_services')
    .select(SERVICE_WITH_DETAILS_SELECT)
    .eq('service_categories.slug', categorySlug)
    .gt('created_at', asOf)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as ProviderServiceWithDetails[];
};

/** Id-only candidates, ranked on the device when feed_order_provider_services isn't deployed. */
export const fetchProviderServiceRankingPool = async (categorySlug: string): Promise<RankableItem[]> => {
  const { data, error } = await supabase
    .from('provider_services')
    .select('id, impressions_shown, boost_expires_at, service_categories!inner ( slug )')
    .eq('service_categories.slug', categorySlug);
  if (error) throw error;
  return (data || []) as RankableItem[];
};

// Fetch provider services by category slug
export const fetchProviderServicesByCategory = async (categorySlug: string): Promise<ProviderServiceWithDetails[]> => {
  const { data, error } = await supabase
    .from('provider_services')
    .select(SERVICE_WITH_DETAILS_SELECT)
    .eq('service_categories.slug', categorySlug)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching provider services by category:', error);
    throw error;
  }

  return (data || []) as ProviderServiceWithDetails[];
};

// Fetch single provider service by ID
export const fetchProviderServiceById = async (serviceId: string): Promise<ProviderServiceWithDetails | null> => {
  const { data, error } = await supabase
    .from('provider_services')
    .select(`
      *,
      service_categories (
        id,
        name,
        slug
      ),
      service_providers (
        id,
        user_id,
        master_bio,
        profile_url,
        name,
        email,
        contact,
        email_active,
        contact_active,
        verification_status,
        profiles (
          name,
          email,
          phone,
          avatar_url
        )
      )
    `)
    .eq('id', serviceId)
    .single();

  if (error) {
    console.error('Error fetching provider service by ID:', error);
    throw error;
  }

  return data as ProviderServiceWithDetails;
};

// Update a provider service
export const updateProviderService = async (
  serviceId: string,
  updates: {
    name?: string;
    description?: string;
    images?: string[];
  }
): Promise<void> => {
  const { error } = await supabase
    .from('provider_services')
    .update(updates)
    .eq('id', serviceId);

  if (error) {
    console.error('Error updating provider service:', error);
    throw error;
  }
};

// Delete images from storage
export const deleteServiceImages = async (imageUrls: string[]): Promise<void> => {
  try {
    const filePaths = imageUrls.map(url => {
      // Extract the file path from the public URL
      const urlParts = url.split('/service-images/');
      return urlParts[1] || url;
    });

    const { error } = await supabase.storage
      .from('service-images')
      .remove(filePaths);

    if (error) {
      console.error('Error deleting service images:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting service images:', error);
    throw error;
  }
};

// Delete a provider service (including images)
export const deleteProviderService = async (serviceId: string): Promise<void> => {
  // First fetch the service to get image URLs
  const { data: service, error: fetchError } = await supabase
    .from('provider_services')
    .select('images')
    .eq('id', serviceId)
    .single();

  if (fetchError) {
    console.error('Error fetching service for deletion:', fetchError);
    throw fetchError;
  }

  // Delete images from storage if they exist
  if (service?.images && service.images.length > 0) {
    try {
      await deleteServiceImages(service.images);
    } catch (error) {
      console.error('Failed to delete service images, continuing with service deletion:', error);
    }
  }

  // Delete the service from database
  const { error } = await supabase
    .from('provider_services')
    .delete()
    .eq('id', serviceId);

  if (error) {
    console.error('Error deleting provider service:', error);
    throw error;
  }
};

// Toggle service active/inactive status
export const toggleServiceStatus = async (
  serviceId: string,
  newStatus: boolean
): Promise<ProviderService> => {
  const { data, error } = await supabase
    .from('provider_services')
    .update({ status: newStatus })
    .eq('id', serviceId)
    .select()
    .single();

  if (error) {
    console.error('Error toggling service status:', error);
    throw error;
  }

  return data as ProviderService;
};

// Fetch all provider services with pagination
export const fetchAllProviderServices = async (page: number = 0, pageSize: number = 10): Promise<ProviderServiceWithDetails[]> => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from('provider_services')
    .select(`
      *,
      service_categories (
        id,
        name,
        slug
      ),
      service_providers (
        id,
        user_id,
        master_bio,
        profile_url,
        name,
        email,
        contact,
        email_active,
        contact_active,
        verification_status,
        profiles (
          name,
          email,
          phone,
          avatar_url
        )
      )
    `)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching all provider services:', error);
    throw error;
  }

  return (data || []) as ProviderServiceWithDetails[];
};

// Fetch service provider profile for a user
export const fetchServiceProviderProfile = async (userId: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from('service_providers')
    .select(`
      id,
      user_id,
      name,
      identification,
      master_bio,
      profile_url,
      email,
      contact,
      email_active,
      contact_active,
      verification_status,
      category_id,
      service_categories (
        id,
        name,
        slug
      ),
      profiles (
        name,
        email,
        phone,
        avatar_url
      )
    `)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching service provider profile:', error);
    return null;
  }

  return data;
}

// Upload provider avatar image
export const uploadProviderAvatar = async (imageUri: string, userId: string): Promise<string> => {
  try {
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const fileName = `provider_${userId}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    await uploadFileToSupabase(imageUri, 'service-profile', filePath, `image/${fileExt}`, true, { image: 'avatar' });

    const { data: { publicUrl } } = supabase.storage
      .from('service-profile')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading provider avatar:', error);
    throw error;
  }
};

// Update service provider profile
export const updateServiceProviderProfile = async (
  userId: string,
  updates: {
    name?: string;
    master_bio?: string;
    profile_url?: string;
    email?: string | null;
    contact?: string | null;
    email_active?: boolean;
    contact_active?: boolean;
    identification?: any;
    verification_status?: 'verified' | 'not_verified' | 'pending';
    /** The business's own type — decides which sections its profile
     *  shows (see lib/businessSections.ts). */
    category_id?: string;
  }
): Promise<void> => {
  const { error } = await supabase
    .from('service_providers')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating service provider profile:', error);
    throw error;
  }
};

// Upload license image to service-license bucket
export const uploadLicenseImage = async (imageUri: string, userId: string): Promise<string> => {
  try {
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const fileName = `license_${userId}_${Date.now()}.${fileExt}`;
    const filePath = `licenses/${fileName}`;

    // A licence is read for its small print during verification — kept sharper than a photo.
    await uploadFileToSupabase(imageUri, 'service-license', filePath, `image/${fileExt}`, true, { image: 'document' });

    const { data: { publicUrl } } = supabase.storage
      .from('service-license')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    throw error;
  }
};

// Update service provider license (stores URL in identification jsonb field and sets verification_status to pending)
export const updateServiceProviderLicense = async (
  userId: string,
  licenseUrl: string
): Promise<void> => {
  const identification = {
    licenseUrl,
    uploadedAt: new Date().toISOString()
  };

  await updateServiceProviderProfile(userId, {
    identification,
    verification_status: 'pending'
  });
};

// Delete license image from storage
export const deleteLicenseImage = async (licenseUrl: string): Promise<void> => {
  try {
    // Extract the file path from the public URL
    const urlParts = licenseUrl.split('/service-license/');
    const filePath = urlParts[1] || licenseUrl;

    const { error } = await supabase.storage
      .from('service-license')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting license image:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting license image:', error);
    throw error;
  }
};

// Delete provider avatar from storage
export const deleteProviderAvatar = async (avatarUrl: string): Promise<void> => {
  try {
    // Extract the file path from the public URL
    const urlParts = avatarUrl.split('/service-profile/');
    const filePath = urlParts[1] || avatarUrl;

    const { error } = await supabase.storage
      .from('service-profile')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting provider avatar:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting provider avatar:', error);
    throw error;
  }
};
