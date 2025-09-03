export interface PostData {
  id: string;
  userId: string;
  username: string;
  profilePic?: string;
  content: string;
  images: string[];
  date: Date;
  likes: number;
  comments: number;
  shares: number;
}

export const posts: PostData[] = [
  {
    id: "1",
    userId: "user1",
    username: "Tenzin Wangchuk",
    profilePic: "https://picsum.photos/100/100?random=401",
    content: "Just had an amazing day exploring the mountains! The view was absolutely breathtaking. Nature never fails to amaze me. 🏔️ #mountains #nature #adventure",
    images: [
      "https://picsum.photos/400/300?random=501",
      "https://picsum.photos/400/300?random=502",
      "https://picsum.photos/400/300?random=503",
    ],
    date: new Date(),
    likes: 24,
    comments: 8,
    shares: 3,
  },
  {
    id: "2", 
    userId: "user2",
    username: "Pema Choden",
    profilePic: "https://picsum.photos/100/100?random=402",
    content: "Trying out a new recipe today! Homemade pasta with fresh herbs from the garden. Cooking is my therapy 👩‍🍳✨",
    images: [
      "https://picsum.photos/400/300?random=504",
      "https://picsum.photos/400/300?random=505",
    ],
    date: new Date(2025, 7, 30), // August 30, 2025
    likes: 45,
    comments: 12,
    shares: 7,
  },
  {
    id: "3",
    userId: "user3", 
    username: "Karma Dorji",
    profilePic: "https://picsum.photos/100/100?random=403",
    content: "Beautiful sunset at the beach today. Sometimes you just need to stop and appreciate the simple moments in life. 🌅",
    images: [
      "https://picsum.photos/400/300?random=506",
    ],
    date: new Date(2025, 7, 29), // August 29, 2025
    likes: 67,
    comments: 15,
    shares: 9,
  },
  {
    id: "4",
    userId: "user4",
    username: "Dechen Lhamo",
    profilePic: "https://picsum.photos/100/100?random=404", 
    content: "Finally finished my latest painting! It took me weeks but I'm so proud of how it turned out. Art is life! 🎨",
    images: [
      "https://picsum.photos/400/300?random=507",
      "https://picsum.photos/400/300?random=508",
      "https://picsum.photos/400/300?random=509",
      "https://picsum.photos/400/300?random=510",
    ],
    date: new Date(2025, 7, 28), // August 28, 2025
    likes: 89,
    comments: 23,
    shares: 14,
  },
  {
    id: "5",
    userId: "user5",
    username: "Sonam Tshering",
    profilePic: "https://picsum.photos/100/100?random=405",
    content: "Coffee and coding session this morning. Working on something exciting! Can't wait to share it with everyone soon. ☕💻",
    images: [],
    date: new Date(2025, 7, 27), // August 27, 2025
    likes: 32,
    comments: 6,
    shares: 2,
  },
  {
    id: "6",
    userId: "user6",
    username: "Yeshey Penjor", 
    profilePic: "https://picsum.photos/100/100?random=406",
    content: "Had the most amazing workout session today! Feeling stronger every day. Remember, progress not perfection! 💪",
    images: [
      "https://picsum.photos/400/300?random=511",
      "https://picsum.photos/400/300?random=512",
    ],
    date: new Date(2025, 7, 26), // August 26, 2025
    likes: 56,
    comments: 18,
    shares: 5,
  },
];