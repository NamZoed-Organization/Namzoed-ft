// lib/productsService.ts
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import { uploadFileToSupabase } from './uploadFile';

export interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  images: string[];
  created_at: string;
  // Discount fields (stored in database)
  is_discount_active?: boolean;
  discount_percent?: number;
  discount_started_at?: string;
  discount_duration_hrs?: number;
  // Calculated discount fields (from products_with_discounts view)
  is_expired?: boolean;              // True if discount period has passed
  is_currently_active?: boolean;     // True if discount is active RIGHT NOW
  current_price?: number;            // Auto-calculated price with discount applied
  discount_ends_at?: string;         // Timestamp when discount expires
  isVerified?: boolean;
  // false/omitted (default) = shows on the seller's main profile Products
  // tab; true = shows on their Work profile's product list instead. See
  // supabase/migrations/20260902120000_add_work_profile_product_flag.sql.
  is_work_listing?: boolean;
  impressions_shown?: number;
  last_shown_at?: string | null;
  boost_started_at?: string | null;
  boost_expires_at?: string | null;
  // Denormalized rating summary, maintained by a trigger on product_reviews
  // (see supabase/migrations/20260826120000_create_product_reviews.sql).
  average_rating?: number;
  review_count?: number;
}

export interface ProductWithUser extends Product {
  profiles?: {
    name?: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
  };
}

// Fetch products with pagination and user profile data
// Uses products_with_discounts view for real-time discount calculations
export const fetchProducts = async (page: number = 0, pageSize: number = 10) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('products_with_discounts')  // ← Query the view for real-time discount status
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        phone,
        avatar_url
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }

  return { products: (data || []) as ProductWithUser[], totalCount: count || 0 };
};

// Fetch single product by ID
// Uses products_with_discounts view for real-time discount calculations
export const fetchProductById = async (productId: string): Promise<ProductWithUser | null> => {
  const { data, error } = await supabase
    .from('products_with_discounts')  // ← Query the view for real-time discount status
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        phone,
        avatar_url
      )
    `)
    .eq('id', productId)
    .single();

  if (error) {
    console.error('Error fetching product:', error);
    throw error;
  }

  return data as ProductWithUser;
};

// Fetch products by user ID
// Uses products_with_discounts view for real-time discount calculations
// Note: Expired discounts are automatically cleaned up by database cron job every minute
//
// `options.isWorkListing` filters by the main/work-profile split (see
// Product.is_work_listing) — omit it to get everything regardless of where
// it's displayed (e.g. for post/story product-tagging pickers, which aren't
// scoped to either profile).
export const fetchUserProducts = async (
  userId: string,
  options?: { isWorkListing?: boolean },
) => {
  let query = supabase
    .from('products_with_discounts')  // Query the view for discount fields
    .select('*')
    .eq('user_id', userId);

  if (options?.isWorkListing !== undefined) {
    query = query.eq('is_work_listing', options.isWorkListing);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user products:', error);
    throw error;
  }

  return data || [];
};

// Fetch products by category
// Uses products_with_discounts view for real-time discount calculations
export const fetchProductsByCategory = async (
  category: string,
  filter?: string | null,
  page: number = 0,
  pageSize: number = 20
) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('products_with_discounts')  // ← Query the view for real-time discount status
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        phone,
        avatar_url
      )
    `, { count: 'exact' })
    .eq('category', category)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filter) {
    query = query.contains('tags', [filter]);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching products by category:', error);
    throw error;
  }

  return { products: (data || []) as ProductWithUser[], totalCount: count || 0 };
};

// Fetches the full candidate pool for one feed-randomization session (see
// lib/feedRanking.ts) for a given category — no pagination, ranking is done
// client-side over the whole pool, then sliced. Mirrors
// fetchAllPostsForRanking in lib/postsService.ts.
export const fetchProductsForRanking = async (
  /** Pass null to fetch across every category (e.g. an "All" browse tab). */
  category: string | null,
  filter?: string | null,
): Promise<ProductWithUser[]> => {
  let query = supabase
    .from('products_with_discounts')
    .select(`
      *,
      profiles:user_id (
        name,
        email,
        phone,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  if (filter) {
    query = query.contains('tags', [filter]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching products for ranking:', error);
    throw error;
  }

  return (data || []) as ProductWithUser[];
};

// Create a new product
export const createProduct = async (productData: {
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  images: string[];
  userId: string;
  // true = list under the seller's Work profile instead of their main one
  // (see Product.is_work_listing). Defaults to false when omitted.
  isWorkListing?: boolean;
}) => {
  const { data, error } = await supabase
    .from('products')
    .insert([{
      user_id: productData.userId,
      name: productData.name,
      description: productData.description,
      price: productData.price,
      category: productData.category,
      tags: productData.tags,
      images: productData.images,
      is_work_listing: productData.isWorkListing ?? false,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating product:', error);
    throw error;
  }

  return data;
};

// Delete a product
export const deleteProduct = async (productId: string) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

// Update a product
export const updateProduct = async (productId: string, updates: Partial<Product>) => {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error);
    throw error;
  }

  return data;
};

// Upload product image
export const uploadProductImage = async (imageUri: string, userId: string): Promise<string> => {
  try {
    // Compress and resize before loading into JS memory to prevent app freeze
    const compressed = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1080 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );

    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    await uploadFileToSupabase(compressed.uri, 'product-images', fileName, 'image/jpeg');

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadProductImage:', error);
    throw error;
  }
};

// Upload multiple product images
export const uploadProductImages = async (imageUris: string[], userId: string): Promise<string[]> => {
  const uploadPromises = imageUris.map(uri => uploadProductImage(uri, userId));
  return await Promise.all(uploadPromises);
};