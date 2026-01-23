import { supabase } from './supabase';

// Unified search result interface
export interface SearchResult {
  type: 'user' | 'service' | 'product' | 'post' | 'marketplace';
  id: string;
  title: string;          // name for all types
  subtitle?: string;      // dzongkhag for users, category for others
  imageUrl?: string;      // avatar/product/post image
  metadata?: any;         // additional type-specific data
}

export interface SearchResults {
  users: SearchResult[];
  services: SearchResult[];
  products: SearchResult[];
  posts: SearchResult[];
  marketplace: SearchResult[];
}

// Helper to check if query is a category name
const isCategoryQuery = (query: string, keywords: string[]): boolean => {
  const normalizedQuery = query.toLowerCase().trim();
  return keywords.some(keyword => normalizedQuery === keyword);
};

// Search users by name, phone, or location (dzongkhag)
const searchUsers = async (query: string, currentUserId?: string): Promise<SearchResult[]> => {
  try {
    // Check if query is the category name itself
    if (isCategoryQuery(query, ['user', 'users'])) {
      let queryBuilder = supabase
        .from('profiles')
        .select('id, name, phone, avatar_url, dzongkhag, follower_count')
        .order('follower_count', { ascending: false })
        .limit(50);

      if (currentUserId) {
        queryBuilder = queryBuilder.not('id', 'eq', currentUserId);
      }

      const { data, error } = await queryBuilder;

      if (error || !data) return [];

      const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 10);

      return shuffled.map(user => ({
        type: 'user' as const,
        id: user.id,
        title: user.name || 'Unknown User',
        subtitle: user.dzongkhag || 'Location not set',
        imageUrl: user.avatar_url || undefined,
        metadata: {
          phone: user.phone,
          follower_count: user.follower_count
        }
      }));
    }

    const searchPattern = `%${query}%`;

    // First try exact/partial matches
    let queryBuilder = supabase
      .from('profiles')
      .select('id, name, phone, avatar_url, dzongkhag, follower_count')
      .or(`name.ilike.${searchPattern},phone.ilike.${searchPattern},dzongkhag.ilike.${searchPattern}`)
      .order('follower_count', { ascending: false })
      .limit(5);

    if (currentUserId) {
      queryBuilder = queryBuilder.not('id', 'eq', currentUserId);
    }

    const { data, error } = await queryBuilder;

    // If no exact matches and query is long enough, try fuzzy search
    if ((!data || data.length === 0) && query.length >= 3) {
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .rpc('search_profiles_fuzzy', {
          search_query: query,
          excluded_user_id: currentUserId || null
        });

      if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
        return fuzzyData.slice(0, 5).map((user: any) => ({
          type: 'user' as const,
          id: user.id,
          title: user.name || 'Unknown User',
          subtitle: user.dzongkhag || 'Location not set',
          imageUrl: user.avatar_url || undefined,
          metadata: {
            phone: user.phone,
            follower_count: user.follower_count
          }
        }));
      }
    }

    if (error) {
      console.error('Error searching users:', error);
      return [];
    }

    return (data || []).map(user => ({
      type: 'user' as const,
      id: user.id,
      title: user.name || 'Unknown User',
      subtitle: user.dzongkhag || 'Location not set',
      imageUrl: user.avatar_url || undefined,
      metadata: {
        phone: user.phone,
        follower_count: user.follower_count
      }
    }));
  } catch (error) {
    console.error('Error in searchUsers:', error);
    return [];
  }
};

// Search services by name or description
const searchServices = async (query: string): Promise<SearchResult[]> => {
  try {
    // Check if query is the category name itself
    if (isCategoryQuery(query, ['service', 'services'])) {
      const { data, error } = await supabase
        .from('provider_services')
        .select(`
          id,
          name,
          description,
          images,
          service_categories (
            id,
            name,
            slug
          ),
          service_providers (
            id,
            user_id,
            name,
            profile_url,
            profiles (
              name,
              avatar_url
            )
          )
        `)
        .eq('status', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) return [];

      const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 10);

      return shuffled.map(service => ({
        type: 'service' as const,
        id: service.id,
        title: service.name,
        subtitle: service.service_categories?.name || 'Service',
        imageUrl: service.images?.[0] || undefined,
        metadata: {
          description: service.description,
          categorySlug: service.service_categories?.slug,
          providerName: service.service_providers?.name || service.service_providers?.profiles?.name
        }
      }));
    }

    const searchPattern = `%${query}%`;

    // First try exact/partial matches
    const { data, error } = await supabase
      .from('provider_services')
      .select(`
        id,
        name,
        description,
        images,
        service_categories (
          id,
          name,
          slug
        ),
        service_providers (
          id,
          user_id,
          name,
          profile_url,
          profiles (
            name,
            avatar_url
          )
        )
      `)
      .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
      .eq('status', true)
      .order('created_at', { ascending: false })
      .limit(5);

    // If no exact matches and query is long enough, try fuzzy search
    if ((!data || data.length === 0) && query.length >= 3) {
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .rpc('search_services_fuzzy', {
          search_query: query
        });

      if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
        return fuzzyData.slice(0, 5).map((service: any) => ({
          type: 'service' as const,
          id: service.id,
          title: service.name,
          subtitle: service.category_name || 'Service',
          imageUrl: service.images?.[0] || undefined,
          metadata: {
            description: service.description,
            categorySlug: service.category_slug,
            providerName: service.provider_name
          }
        }));
      }
    }

    if (error) {
      console.error('Error searching services:', error);
      return [];
    }

    return (data || []).map(service => ({
      type: 'service' as const,
      id: service.id,
      title: service.name,
      subtitle: service.service_categories?.name || 'Service',
      imageUrl: service.images?.[0] || undefined,
      metadata: {
        description: service.description,
        categorySlug: service.service_categories?.slug,
        providerName: service.service_providers?.name || service.service_providers?.profiles?.name
      }
    }));
  } catch (error) {
    console.error('Error in searchServices:', error);
    return [];
  }
};

// Search products by name, description, or tags
const searchProducts = async (query: string): Promise<SearchResult[]> => {
  try {
    // Check if query is the category name itself
    if (isCategoryQuery(query, ['product', 'products'])) {
      const { data, error } = await supabase
        .from('products_with_discounts')
        .select(`
          id,
          name,
          description,
          price,
          category,
          tags,
          images,
          current_price,
          is_currently_active,
          discount_percent,
          profiles:user_id (
            id,
            name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) return [];

      const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 10);

      return shuffled.map(product => ({
        type: 'product' as const,
        id: product.id,
        title: product.name,
        subtitle: `Nu. ${product.current_price || product.price} • ${product.category}`,
        imageUrl: product.images?.[0] || undefined,
        metadata: {
          category: product.category,
          price: product.price,
          current_price: product.current_price,
          is_discount_active: product.is_currently_active,
          discount_percent: product.discount_percent,
          sellerName: product.profiles?.name
        }
      }));
    }

    const searchPattern = `%${query}%`;

    // First try exact/partial matches
    const { data, error } = await supabase
      .from('products_with_discounts')
      .select(`
        id,
        name,
        description,
        price,
        category,
        tags,
        images,
        current_price,
        is_currently_active,
        discount_percent,
        profiles:user_id (
          id,
          name,
          avatar_url
        )
      `)
      .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
      .order('created_at', { ascending: false })
      .limit(5);

    // If no exact matches and query is long enough, try fuzzy search
    if ((!data || data.length === 0) && query.length >= 3) {
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .rpc('search_products_fuzzy', {
          search_query: query
        });

      if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
        return fuzzyData.slice(0, 5).map((product: any) => ({
          type: 'product' as const,
          id: product.id,
          title: product.name,
          subtitle: `Nu. ${product.current_price || product.price} • ${product.category}`,
          imageUrl: product.images?.[0] || undefined,
          metadata: {
            category: product.category,
            price: product.price,
            current_price: product.current_price,
            is_discount_active: product.is_currently_active,
            discount_percent: product.discount_percent,
            sellerName: product.user_name
          }
        }));
      }
    }

    if (error) {
      console.error('Error searching products:', error);
      return [];
    }

    return (data || []).map(product => ({
      type: 'product' as const,
      id: product.id,
      title: product.name,
      subtitle: `Nu. ${product.current_price || product.price} • ${product.category}`,
      imageUrl: product.images?.[0] || undefined,
      metadata: {
        category: product.category,
        price: product.price,
        current_price: product.current_price,
        is_discount_active: product.is_currently_active,
        discount_percent: product.discount_percent,
        sellerName: product.profiles?.name
      }
    }));
  } catch (error) {
    console.error('Error in searchProducts:', error);
    return [];
  }
};

// Search posts by content or username
const searchPosts = async (query: string): Promise<SearchResult[]> => {
  try {
    // Check if query is the category name itself
    if (isCategoryQuery(query, ['post', 'posts'])) {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          content,
          images,
          created_at,
          likes,
          comments,
          shares,
          profiles:user_id (
            id,
            name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) return [];

      const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 10);

      return shuffled.map(post => ({
        type: 'post' as const,
        id: post.id,
        title: post.profiles?.name || 'Unknown User',
        subtitle: post.content.substring(0, 60) + (post.content.length > 60 ? '...' : ''),
        imageUrl: post.images?.[0] || post.profiles?.avatar_url || undefined,
        metadata: {
          userId: post.user_id,
          content: post.content,
          userName: post.profiles?.name,
          images: post.images,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          avatarUrl: post.profiles?.avatar_url
        }
      }));
    }

    const searchPattern = `%${query}%`;

    // Search for posts by content
    const { data: postsByContent, error: contentError } = await supabase
      .from('posts')
      .select(`
        id,
        user_id,
        content,
        images,
        created_at,
        likes,
        comments,
        shares,
        profiles:user_id (
          id,
          name,
          avatar_url
        )
      `)
      .ilike('content', searchPattern)
      .order('created_at', { ascending: false })
      .limit(10);

    // Search for users first, then get their posts
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .ilike('name', searchPattern)
      .limit(5);

    let postsByUser: any[] = [];
    if (users && users.length > 0) {
      const userIds = users.map(u => u.id);
      const { data: userPosts, error: userPostsError } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          content,
          images,
          created_at,
          likes,
          comments,
          shares,
          profiles:user_id (
            id,
            name,
            avatar_url
          )
        `)
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!userPostsError) {
        postsByUser = userPosts || [];
      }
    }

    // Combine results and remove duplicates
    let allPosts = [...(postsByContent || []), ...postsByUser];
    let uniquePosts = Array.from(
      new Map(allPosts.map(post => [post.id, post])).values()
    ).slice(0, 10);

    // If no exact matches and query is long enough, try fuzzy search
    if (uniquePosts.length === 0 && query.length >= 3) {
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .rpc('search_posts_fuzzy', {
          search_query: query
        });

      if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
        return fuzzyData.slice(0, 10).map((post: any) => ({
          type: 'post' as const,
          id: post.id,
          title: post.user_name || 'Unknown User',
          subtitle: post.content.substring(0, 60) + (post.content.length > 60 ? '...' : ''),
          imageUrl: post.images?.[0] || post.user_avatar_url || undefined,
          metadata: {
            userId: post.user_id,
            content: post.content,
            userName: post.user_name,
            images: post.images,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            avatarUrl: post.user_avatar_url
          }
        }));
      }
    }

    if (contentError && usersError) {
      console.error('Error searching posts:', contentError || usersError);
      return [];
    }

    return uniquePosts.map(post => ({
      type: 'post' as const,
      id: post.id,
      title: post.profiles?.name || 'Unknown User',
      subtitle: post.content.substring(0, 60) + (post.content.length > 60 ? '...' : ''),
      imageUrl: post.images?.[0] || post.profiles?.avatar_url || undefined,
      metadata: {
        userId: post.user_id,
        content: post.content,
        userName: post.profiles?.name,
        images: post.images,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        avatarUrl: post.profiles?.avatar_url
      }
    }));
  } catch (error) {
    console.error('Error in searchPosts:', error);
    return [];
  }
};

// Search marketplace items by title, description, dzongkhag, type, or tags
const searchMarketplace = async (query: string): Promise<SearchResult[]> => {
  try {
    // Check if query is the category name itself
    if (isCategoryQuery(query, ['marketplace', 'market'])) {
      const { data, error } = await supabase
        .from('marketplace')
        .select(`
          id,
          type,
          title,
          description,
          price,
          images,
          dzongkhag,
          tags,
          created_at,
          profiles:user_id (
            id,
            name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) return [];

      const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 10);

      return shuffled.map(item => ({
        type: 'marketplace' as const,
        id: item.id,
        title: item.title,
        subtitle: item.dzongkhag
          ? `${item.type} • ${item.dzongkhag}${item.price > 0 ? ` • Nu. ${item.price}` : ''}`
          : `${item.type}${item.price > 0 ? ` • Nu. ${item.price}` : ''}`,
        imageUrl: item.images?.[0] || undefined,
        metadata: {
          type: item.type,
          price: item.price,
          dzongkhag: item.dzongkhag,
          tags: item.tags,
          sellerName: item.profiles?.name
        }
      }));
    }

    const searchPattern = `%${query}%`;

    // First try exact/partial matches
    const { data, error } = await supabase
      .from('marketplace')
      .select(`
        id,
        type,
        title,
        description,
        price,
        images,
        dzongkhag,
        tags,
        created_at,
        profiles:user_id (
          id,
          name,
          avatar_url
        )
      `)
      .or(`title.ilike.${searchPattern},dzongkhag.ilike.${searchPattern},type.ilike.${searchPattern}`)
      .order('created_at', { ascending: false })
      .limit(20);

    // Client-side filter for description (JSONB field)
    const lowerQuery = query.toLowerCase();
    const filteredData = (data || []).filter(item => {
      if (
        item.title?.toLowerCase().includes(lowerQuery) ||
        item.dzongkhag?.toLowerCase().includes(lowerQuery) ||
        item.type?.toLowerCase().includes(lowerQuery)
      ) {
        return true;
      }

      if (item.description) {
        if (typeof item.description === 'string') {
          return item.description.toLowerCase().includes(lowerQuery);
        } else if (typeof item.description === 'object') {
          const descText = JSON.stringify(item.description).toLowerCase();
          return descText.includes(lowerQuery);
        }
      }

      return false;
    }).slice(0, 5);

    // If no exact matches and query is long enough, try fuzzy search
    if (filteredData.length === 0 && query.length >= 3) {
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .rpc('search_marketplace_fuzzy', {
          search_query: query
        });

      if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
        return fuzzyData.slice(0, 5).map((item: any) => ({
          type: 'marketplace' as const,
          id: item.id,
          title: item.title,
          subtitle: item.dzongkhag
            ? `${item.type} • ${item.dzongkhag}${item.price > 0 ? ` • Nu. ${item.price}` : ''}`
            : `${item.type}${item.price > 0 ? ` • Nu. ${item.price}` : ''}`,
          imageUrl: item.images?.[0] || undefined,
          metadata: {
            type: item.type,
            price: item.price,
            dzongkhag: item.dzongkhag,
            tags: item.tags,
            sellerName: item.user_name
          }
        }));
      }
    }

    if (error) {
      console.error('Error searching marketplace:', error);
      return [];
    }

    return filteredData.map(item => ({
      type: 'marketplace' as const,
      id: item.id,
      title: item.title,
      subtitle: item.dzongkhag
        ? `${item.type} • ${item.dzongkhag}${item.price > 0 ? ` • Nu. ${item.price}` : ''}`
        : `${item.type}${item.price > 0 ? ` • Nu. ${item.price}` : ''}`,
      imageUrl: item.images?.[0] || undefined,
      metadata: {
        type: item.type,
        price: item.price,
        dzongkhag: item.dzongkhag,
        tags: item.tags,
        sellerName: item.profiles?.name
      }
    }));
  } catch (error) {
    console.error('Error in searchMarketplace:', error);
    return [];
  }
};

// Main unified search function
export const searchAll = async (
  query: string,
  currentUserId?: string
): Promise<SearchResults> => {
  // Return empty results if query is too short
  if (!query || query.trim().length < 2) {
    return {
      users: [],
      services: [],
      products: [],
      posts: [],
      marketplace: []
    };
  }

  try {
    // Execute all searches in parallel for better performance
    const [users, services, products, posts, marketplace] = await Promise.all([
      searchUsers(query.trim(), currentUserId),
      searchServices(query.trim()),
      searchProducts(query.trim()),
      searchPosts(query.trim()),
      searchMarketplace(query.trim())
    ]);

    return {
      users,
      services,
      products,
      posts,
      marketplace
    };
  } catch (error) {
    console.error('Error in searchAll:', error);
    return {
      users: [],
      services: [],
      products: [],
      posts: [],
      marketplace: []
    };
  }
};
