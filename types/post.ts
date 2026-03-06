// Tagged product reference stored on a post
export interface TaggedProduct {
  id: string;
  name: string;
  price: number;
  image?: string;
  current_price?: number;
  is_currently_active?: boolean;
  discount_percent?: number;
}

// Tagged account reference stored on a post
export interface TaggedAccount {
  id: string;
  name: string;
  avatar_url?: string | null;
}

// Post data interface for displaying posts in the feed
export interface PostData {
  id: string;
  userId: string;
  username?: string;
  profilePic?: string;
  content: string;
  images: string[];
  date: Date;
  likes: number;
  comments: number;
  shares: number;
  tagged_products?: TaggedProduct[];
  tagged_accounts?: TaggedAccount[];
}
