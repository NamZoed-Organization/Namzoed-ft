// Free Options Data
export interface FreeItem {
  id: string;
  type: 'free';
  name: string;
  description: string;
  userName: string;
  location: string;
  phone: string;
  images: string[];
}

export const freeItems: FreeItem[] = [
  {
    id: 'free-1',
    type: 'free',
    name: 'Old Newspapers and Magazines',
    description: 'Collection of newspapers and magazines from past months. Perfect for students, crafts, or recycling purposes.',
    userName: 'Ashi Pelden',
    location: 'Thimphu, Olakha',
    phone: '+975-17-123-000',
    images: [
      'https://picsum.photos/400/300?random=36'
    ]
  },
  {
    id: 'free-2',
    type: 'free',
    name: 'Children\'s Clothes - Size 5-8 Years',
    description: 'Good condition children\'s clothes that my kids have outgrown. Various items including shirts, pants, and jackets.',
    userName: 'Tandin Wangmo',
    location: 'Paro, Drugyel',
    phone: '+975-17-234-111',
    images: [
      'https://picsum.photos/400/300?random=37',
      'https://picsum.photos/400/300?random=38'
    ]
  },
  {
    id: 'free-3',
    type: 'free',
    name: 'Plant Cuttings and Seeds',
    description: 'Various plant cuttings and flower seeds for gardening enthusiasts. Perfect for starting your own garden.',
    userName: 'Dorji Wangchuk',
    location: 'Thimphu, Dechencholing',
    phone: '+975-17-345-222',
    images: [
      'https://picsum.photos/400/300?random=39',
      'https://picsum.photos/400/300?random=40',
      'https://picsum.photos/400/300?random=41'
    ]
  },
  {
    id: 'free-4',
    type: 'free',
    name: 'Old Computer Parts for Students',
    description: 'Non-working computer parts that can be used for educational purposes or spare parts. Good for IT students.',
    userName: 'Pema Tshering',
    location: 'Thimphu, Kawangjangsa',
    phone: '+975-17-456-333',
    images: [
      'https://picsum.photos/400/300?random=42'
    ]
  },
  {
    id: 'free-5',
    type: 'free',
    name: 'Recipe Books and Cooking Magazines',
    description: 'Collection of recipe books and cooking magazines. Great for cooking enthusiasts and homemakers.',
    userName: 'Choki Dema',
    location: 'Punakha, Wangduephodrang',
    phone: '+975-17-567-444',
    images: [
      'https://picsum.photos/400/300?random=43',
      'https://picsum.photos/400/300?random=44'
    ]
  },
  {
    id: 'free-6',
    type: 'free',
    name: 'Cardboard Boxes - Various Sizes',
    description: 'Clean cardboard boxes from recent online purchases. Perfect for moving, storage, or craft projects.',
    userName: 'Lobzang Tenzin',
    location: 'Thimphu, Changkha',
    phone: '+975-17-678-555',
    images: [
      'https://picsum.photos/400/300?random=45'
    ]
  },
  {
    id: 'free-7',
    type: 'free',
    name: 'Wooden Pallets for DIY Projects',
    description: 'Clean wooden pallets perfect for furniture making, garden projects, or creative DIY work.',
    userName: 'Kinzang Lhamo',
    location: 'Thimphu, Motithang',
    phone: '+975-17-789-666',
    images: [
      'https://picsum.photos/400/300?random=46',
      'https://picsum.photos/400/300?random=47'
    ]
  }
];