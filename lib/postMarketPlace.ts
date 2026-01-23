import { supabase } from './supabase';

export interface MarketplaceItem {
  id: string;
  user_id: string;
  type: 'rent' | 'swap' | 'second_hand' | 'free' | 'job_vacancy';
  title: string;
  description: string | { text: string } | { description: string; requirements?: string; responsibilities?: string };
  price: number;
  images: string[];
  dzongkhag?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface MarketplaceItemWithUser extends MarketplaceItem {
  profiles?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

// Fetch marketplace items with pagination
export const fetchMarketplaceItems = async (page: number = 0, pageSize: number = 10) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('marketplace')
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        phone
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching marketplace items:', error);
    throw error;
  }

  return { items: (data || []) as MarketplaceItemWithUser[], totalCount: count || 0 };
};

// Fetch marketplace items by type
export const fetchMarketplaceByType = async (type: 'rent' | 'swap' | 'second_hand' | 'free' | 'job_vacancy', page: number = 0, pageSize: number = 10) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('marketplace')
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        phone
      )
    `, { count: 'exact' })
    .eq('type', type)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching marketplace items by type:', error);
    throw error;
  }

  return { items: (data || []) as MarketplaceItemWithUser[], totalCount: count || 0 };
};

// Fetch marketplace items by user ID
export const fetchUserMarketplaceItems = async (userId: string) => {
  const { data, error } = await supabase
    .from('marketplace')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user marketplace items:', error);
    throw error;
  }

  return data || [];
};

// Fetch single marketplace item by ID
export const fetchMarketplaceItemById = async (itemId: string) => {
  const { data, error } = await supabase
    .from('marketplace')
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        phone
      )
    `)
    .eq('id', itemId)
    .single();

  if (error) {
    console.error('Error fetching marketplace item:', error);
    throw error;
  }

  return data as MarketplaceItemWithUser;
};

// Create a new marketplace item
export const createMarketplaceItem = async (itemData: {
  type: 'rent' | 'swap' | 'second_hand' | 'free' | 'job_vacancy';
  title: string;
  description: string | { text: string } | { description: string; requirements?: string; responsibilities?: string };
  price: number;
  images: string[];
  dzongkhag?: string;
  tags: string[];
  userId: string;
}) => {
  const { data, error } = await supabase
    .from('marketplace')
    .insert([{
      user_id: itemData.userId,
      type: itemData.type,
      title: itemData.title,
      description: itemData.description,
      price: itemData.price,
      images: itemData.images,
      dzongkhag: itemData.dzongkhag,
      tags: itemData.tags,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating marketplace item:', error);
    throw error;
  }

  return data;
};

// Update marketplace item
export const updateMarketplaceItem = async (
  itemId: string,
  updates: Partial<Omit<MarketplaceItem, 'id' | 'user_id' | 'created_at'>>
) => {
  const { data, error } = await supabase
    .from('marketplace')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    console.error('Error updating marketplace item:', error);
    throw error;
  }

  return data;
};

// Delete marketplace item
export const deleteMarketplaceItem = async (itemId: string) => {
  const { error } = await supabase
    .from('marketplace')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error deleting marketplace item:', error);
    throw error;
  }
};

// Upload marketplace image
export const uploadMarketplaceImage = async (imageUri: string): Promise<string> => {
  try {
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = fileName;

    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('market')
      .upload(filePath, fileData, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading marketplace image:', error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('market')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadMarketplaceImage:', error);
    throw error;
  }
};

// Upload multiple marketplace images
export const uploadMarketplaceImages = async (imageUris: string[]): Promise<string[]> => {
  const uploadPromises = imageUris.map(uri => uploadMarketplaceImage(uri));
  return await Promise.all(uploadPromises);
};