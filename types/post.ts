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
}
