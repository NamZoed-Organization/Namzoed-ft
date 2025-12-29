// lib/productsService.ts
import { supabase } from './supabase';

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
}

export interface ProductWithUser extends Product {
  profiles?: {
    name?: string;
    email?: string;
    phone?: string;
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
        phone
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
        phone
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
export const fetchUserProducts = async (userId: string) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

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
        phone
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

// Create a new product
export const createProduct = async (productData: {
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  images: string[];
  userId: string;
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
    const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, fileData, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading product image:', error);
      throw error;
    }

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