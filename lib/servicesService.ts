// lib/servicesService.ts
import { supabase } from './supabase';

export interface ProviderService {
  id: string;
  provider_id: string;
  category_id: string;
  name: string;
  description: string;
  images: string[];
  status: boolean;
  created_at: string;
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

    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('service-images')
      .upload(filePath, fileData, {
        contentType: `image/${fileExt}`,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

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
  const { data, error } = await supabase
    .from('provider_services')
    .select(`
      *,
      service_categories (
        id,
        name,
        slug
      ),
      service_providers!inner (
        id,
        user_id,
        master_bio,
        profile_url,
        name,
        profiles (
          name,
          email,
          phone,
          avatar_url
        )
      )
    `)
    .eq('service_providers.user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user provider services:', error);
    throw error;
  }

  return (data || []) as ProviderServiceWithDetails[];
};

// Fetch provider services by category slug
export const fetchProviderServicesByCategory = async (categorySlug: string): Promise<ProviderServiceWithDetails[]> => {
  const { data, error } = await supabase
    .from('provider_services')
    .select(`
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
        profiles (
          name,
          email,
          phone,
          avatar_url
        )
      )
    `)
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

// Fetch all service providers with their services (only providers who have services)
export const fetchAllServiceProviders = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('service_providers')
    .select(`
      id,
      user_id,
      name,
      master_bio,
      profile_url,
      profiles (
        name,
        email,
        phone,
        avatar_url
      ),
      provider_services (
        id,
        name,
        description,
        images,
        created_at,
        service_categories (
          id,
          name,
          slug
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching service providers:', error);
    throw error;
  }

  // Filter out providers with no services
  const providersWithServices = (data || []).filter(
    provider => provider.provider_services && provider.provider_services.length > 0
  );

  return providersWithServices;
}

// Fetch service provider profile for a user
export const fetchServiceProviderProfile = async (userId: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from('service_providers')
    .select(`
      id,
      user_id,
      identification,
      master_bio,
      profile_url,
      verification_status,
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

    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('service-profile')
      .upload(filePath, fileData, {
        contentType: `image/${fileExt}`,
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Upload error:', error);
      throw error;
    }

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
    master_bio?: string;
    profile_url?: string;
    identification?: any;
    verification_status?: 'verified' | 'not_verified' | 'pending';
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

    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from('service-license')
      .upload(filePath, fileData, {
        contentType: `image/${fileExt}`,
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      throw error;
    }

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