// Swap Options Data
export interface SwapItem {
  id: string;
  type: 'swap';
  name: string;
  description: string;
  userName: string;
  location: string;
  phone: string;
  category: 'books' | 'clothes' | 'electronics';
  tags: string[];
  images: string[];
}

export const swapItems: SwapItem[] = [
  {
    id: 'swap-1',
    type: 'swap',
    name: 'Harry Potter Complete Series',
    description: 'Complete set of Harry Potter books in excellent condition. Looking to swap for science fiction novels or educational books.',
    userName: 'Kinley Wangmo',
    location: 'Thimphu, Hejo',
    phone: '+975-17-111-222',
    category: 'books',
    tags: ['fantasy', 'series', 'english', 'hardcover'],
    images: [
      'https://picsum.photos/400/300?random=13',
      'https://picsum.photos/400/300?random=14'
    ]
  },
  {
    id: 'swap-2',
    type: 'swap',
    name: 'Traditional Bhutanese Gho',
    description: 'Authentic traditional gho in excellent condition. Size Medium. Looking to swap for modern casual wear or traditional kira.',
    userName: 'Jamyang Dorji',
    location: 'Paro, Bondey',
    phone: '+975-17-222-333',
    category: 'clothes',
    tags: ['traditional', 'medium', 'formal', 'cultural'],
    images: [
      'https://picsum.photos/400/300?random=15'
    ]
  },
  {
    id: 'swap-3',
    type: 'swap',
    name: 'iPhone 12 - 128GB',
    description: 'Well-maintained iPhone 12 with all accessories. Looking to swap for Android phone or laptop of similar value.',
    userName: 'Tashi Penjor',
    location: 'Thimphu, Zilukha',
    phone: '+975-17-333-444',
    category: 'electronics',
    tags: ['smartphone', '128gb', 'unlocked', 'accessories'],
    images: [
      'https://picsum.photos/400/300?random=16',
      'https://picsum.photos/400/300?random=17',
      'https://picsum.photos/400/300?random=18'
    ]
  },
  {
    id: 'swap-4',
    type: 'swap',
    name: 'University Textbooks - Engineering',
    description: 'Collection of engineering textbooks including Mathematics, Physics, and Computer Science. Great for students.',
    userName: 'Phurba Thinley',
    location: 'Thimphu, Jungzhina',
    phone: '+975-17-444-555',
    category: 'books',
    tags: ['textbooks', 'engineering', 'academic', 'reference'],
    images: [
      'https://picsum.photos/400/300?random=19',
      'https://picsum.photos/400/300?random=20'
    ]
  },
  {
    id: 'swap-5',
    type: 'swap',
    name: 'Winter Jacket Collection',
    description: 'Various winter jackets in different sizes. Brand new and gently used. Perfect for cold weather.',
    userName: 'Sangay Lhamo',
    location: 'Bumthang, Chamkhar',
    phone: '+975-17-555-666',
    category: 'clothes',
    tags: ['winter', 'jackets', 'warm', 'various-sizes'],
    images: [
      'https://picsum.photos/400/300?random=21'
    ]
  },
  {
    id: 'swap-6',
    type: 'swap',
    name: 'Gaming Laptop - ASUS ROG',
    description: 'High-performance gaming laptop perfect for gaming and professional work. Looking for desktop setup or camera equipment.',
    userName: 'Norbu Wangdi',
    location: 'Thimphu, Langjophakha',
    phone: '+975-17-666-777',
    category: 'electronics',
    tags: ['gaming', 'laptop', 'high-performance', 'ASUS'],
    images: [
      'https://picsum.photos/400/300?random=22',
      'https://picsum.photos/400/300?random=23'
    ]
  }
];