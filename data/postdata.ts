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
    profilePic: "@/assets/images/all.png",
    content: "Just had an amazing day exploring the mountains! The view was absolutely breathtaking. Nature never fails to amaze me. 🏔️ #mountains #nature #adventure",
    images: [
      "@/assets/images/all.png",
      "@/assets/images/all.png",
      "@/assets/images/all.png",
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
    profilePic: "@/assets/images/all.png",
    content: "Trying out a new recipe today! Homemade pasta with fresh herbs from the garden. Cooking is my therapy 👩‍🍳✨",
    images: [
      "@/assets/images/all.png",
      "@/assets/images/all.png",
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
    profilePic: "@/assets/images/all.png",
    content: "Beautiful sunset at the beach today. Sometimes you just need to stop and appreciate the simple moments in life. 🌅",
    images: [
      "@/assets/images/all.png",
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
    profilePic: "@/assets/images/all.png", 
    content: "Finally finished my latest painting! It took me weeks but I'm so proud of how it turned out. Art is life! 🎨",
    images: [
      "@/assets/images/all.png",
      "@/assets/images/all.png",
      "@/assets/images/all.png",
      "@/assets/images/all.png",
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
    profilePic: "@/assets/images/all.png",
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
    profilePic: "@/assets/images/all.png",
    content: "Had the most amazing workout session today! Feeling stronger every day. Remember, progress not perfection! 💪",
    images: [
      "@/assets/images/all.png",
      "@/assets/images/all.png",
    ],
    date: new Date(2025, 7, 26), // August 26, 2025
    likes: 56,
    comments: 18,
    shares: 5,
  },
];