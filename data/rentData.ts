// Rent Options Data
export interface RentItem {
  id: string;
  type: 'rent';
  name: string;
  description: string;
  userName: string;
  location: string;
  phone: string;
  category: 'house' | 'apartment' | 'vehicle' | 'equipment';
  duration: 'daily' | 'monthly';
  price: number;
  priceText: string;
  images: string[];
}

export const rentItems: RentItem[] = [
  {
    id: 'rent-1',
    type: 'rent',
    name: 'Cozy 2BHK Apartment in Heart of Thimphu',
    description: 'Fully furnished apartment with modern amenities, close to city center and market areas. Perfect for families or working professionals.',
    userName: 'Karma Wangchuk',
    location: 'Thimphu, Kawangjangsa',
    phone: '+975-17-123-456',
    category: 'apartment',
    duration: 'monthly',
    price: 15000,
    priceText: 'BTN 15,000 per month',
    images: [
      'https://picsum.photos/400/300?random=1',
      'https://picsum.photos/400/300?random=2',
      'https://picsum.photos/400/300?random=3'
    ]
  },
  {
    id: 'rent-2',
    type: 'rent',
    name: 'Traditional Bhutanese House',
    description: 'Beautiful traditional architecture with modern interior, spacious rooms and peaceful environment.',
    userName: 'Pema Lhamo',
    location: 'Paro, Shaba',
    phone: '+975-17-234-567',
    category: 'house',
    duration: 'monthly',
    price: 25000,
    priceText: 'BTN 25,000 per month',
    images: [
      'https://picsum.photos/400/300?random=4',
      'https://picsum.photos/400/300?random=5'
    ]
  },
  {
    id: 'rent-3',
    type: 'rent',
    name: 'Toyota Land Cruiser for Hire',
    description: 'Perfect for mountain trips and tourism. Well-maintained vehicle with experienced driver available.',
    userName: 'Tenzin Norbu',
    location: 'Thimphu, Changkha',
    phone: '+975-17-345-678',
    category: 'vehicle',
    duration: 'daily',
    price: 3500,
    priceText: 'BTN 3,500 per day',
    images: [
      'https://picsum.photos/400/300?random=6'
    ]
  },
  {
    id: 'rent-4',
    type: 'rent',
    name: 'Construction Equipment - Excavator',
    description: 'Heavy duty excavator for construction and excavation work. Operator included in rental.',
    userName: 'Sonam Dorji',
    location: 'Punakha, Khuruthang',
    phone: '+975-17-456-789',
    category: 'equipment',
    duration: 'daily',
    price: 8000,
    priceText: 'BTN 8,000 per day',
    images: [
      'https://picsum.photos/400/300?random=7',
      'https://picsum.photos/400/300?random=8'
    ]
  },
  {
    id: 'rent-5',
    type: 'rent',
    name: 'Modern Studio Apartment',
    description: 'Compact and efficient studio perfect for single professionals. Fully furnished with WiFi.',
    userName: 'Deki Choden',
    location: 'Thimphu, Babesa',
    phone: '+975-17-567-890',
    category: 'apartment',
    duration: 'monthly',
    price: 8000,
    priceText: 'BTN 8,000 per month',
    images: [
      'https://picsum.photos/400/300?random=9'
    ]
  },
  {
    id: 'rent-6',
    type: 'rent',
    name: 'Wedding Photography Equipment Set',
    description: 'Professional camera, lenses, lighting equipment perfect for events and photography.',
    userName: 'Ugyen Tshering',
    location: 'Thimphu, Motithang',
    phone: '+975-17-678-901',
    category: 'equipment',
    duration: 'daily',
    price: 1200,
    priceText: 'BTN 1,200 per day',
    images: [
      'https://picsum.photos/400/300?random=10',
      'https://picsum.photos/400/300?random=11',
      'https://picsum.photos/400/300?random=12'
    ]
  }
];