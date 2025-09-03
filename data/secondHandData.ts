// Second Hand Buy Data
export interface SecondHandItem {
  id: string;
  type: 'secondhand';
  name: string;
  description: string;
  userName: string;
  location: string;
  phone: string;
  price: number;
  priceText: string;
  condition: 'new' | 'good' | 'old';
  monthsUsed?: number;
  images: string[];
}

export const secondHandItems: SecondHandItem[] = [
  {
    id: 'secondhand-1',
    type: 'secondhand',
    name: 'Honda City 2019 Model',
    description: 'Well-maintained Honda City with regular servicing. Single owner, excellent condition with all documents.',
    userName: 'Chencho Gyeltshen',
    location: 'Thimphu, Chang Jiji',
    phone: '+975-17-777-888',
    price: 850000,
    priceText: 'BTN 8,50,000',
    condition: 'good',
    monthsUsed: 48,
    images: [
      'https://picsum.photos/400/300?random=24',
      'https://picsum.photos/400/300?random=25',
      'https://picsum.photos/400/300?random=26'
    ]
  },
  {
    id: 'secondhand-2',
    type: 'secondhand',
    name: 'MacBook Air M1 - 256GB',
    description: 'Barely used MacBook Air with M1 chip. Perfect for students and professionals. Comes with original charger and box.',
    userName: 'Dechen Zangmo',
    location: 'Thimphu, Dechencholing',
    phone: '+975-17-888-999',
    price: 95000,
    priceText: 'BTN 95,000',
    condition: 'new',
    monthsUsed: 6,
    images: [
      'https://picsum.photos/400/300?random=27',
      'https://picsum.photos/400/300?random=28'
    ]
  },
  {
    id: 'secondhand-3',
    type: 'secondhand',
    name: 'Dining Table Set with 6 Chairs',
    description: 'Wooden dining table with comfortable chairs. Some wear and tear but still very functional and sturdy.',
    userName: 'Leki Doma',
    location: 'Phuentsholing, Pasakha',
    phone: '+975-17-999-000',
    price: 25000,
    priceText: 'BTN 25,000',
    condition: 'old',
    monthsUsed: 36,
    images: [
      'https://picsum.photos/400/300?random=29'
    ]
  },
  {
    id: 'secondhand-4',
    type: 'secondhand',
    name: 'Canon DSLR Camera Kit',
    description: 'Professional camera with multiple lenses and accessories. Great for photography enthusiasts and professionals.',
    userName: 'Jigme Singye',
    location: 'Thimphu, Taba',
    phone: '+975-17-000-111',
    price: 75000,
    priceText: 'BTN 75,000',
    condition: 'good',
    monthsUsed: 18,
    images: [
      'https://picsum.photos/400/300?random=30',
      'https://picsum.photos/400/300?random=31',
      'https://picsum.photos/400/300?random=32'
    ]
  },
  {
    id: 'secondhand-5',
    type: 'secondhand',
    name: 'Refrigerator - Double Door',
    description: 'Large capacity refrigerator perfect for families. Energy efficient and well-maintained.',
    userName: 'Karma Yangchen',
    location: 'Punakha, Bajo',
    phone: '+975-17-111-000',
    price: 35000,
    priceText: 'BTN 35,000',
    condition: 'good',
    monthsUsed: 24,
    images: [
      'https://picsum.photos/400/300?random=33',
      'https://picsum.photos/400/300?random=34'
    ]
  },
  {
    id: 'secondhand-6',
    type: 'secondhand',
    name: 'Mountain Bike - Trek',
    description: 'High-quality mountain bike, barely used. Perfect for adventure enthusiasts and daily commuting.',
    userName: 'Passang Dorji',
    location: 'Thimphu, Simtokha',
    phone: '+975-17-222-111',
    price: 45000,
    priceText: 'BTN 45,000',
    condition: 'new',
    monthsUsed: 3,
    images: [
      'https://picsum.photos/400/300?random=35'
    ]
  }
];