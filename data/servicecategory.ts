// Path: data/servicecategory.ts

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string | number; // Support both URL strings and require() image sources
  slug: string;
}

export const serviceCategories: ServiceCategory[] = [
  {
    id: '1',
    name: 'Taxi Services',
    description: 'Professional taxi and transportation services',
    icon: 'taxi',
    image: require('@/assets/yam/taxi.png'),
    slug: 'taxi-services'
  },
  {
    id: '2',
    name: 'Restaurants and Fastfoods',
    description: 'Dining, restaurants and fast food services',
    icon: 'briefcase',
    image: require('@/assets/yam/restaurant.png'),
    slug: 'restaurants-fastfoods'
  },
  {
    id: '3',
    name: 'Cafe and Bakeries',
    description: 'Coffee shops, cafes and bakery services',
    icon: 'home',
    image: require('@/assets/yam/bakery.png'),
    slug: 'cafe-bakeries'
  },
  {
    id: '4',
    name: 'Hotel Services',
    description: 'Hotel and hospitality services',
    icon: 'hotel',
    image: require('@/assets/yam/hotel.png'),
    slug: 'hotel-services'
  },
  {
    id: '5',
    name: 'Home Stay, Ecolodge and Camping',
    description: 'Homestays, eco-lodges and camping facilities',
    icon: 'home',
    image: 'https://picsum.photos/300/200?random=305',
    slug: 'homestay-ecolodge-camping'
  },
  {
    id: '6',
    name: 'Groceries and Green Groceries',
    description: 'Grocery stores and fresh produce services',
    icon: 'briefcase',
    image: require('@/assets/yam/grocery.png'),
    slug: 'groceries-green-groceries'
  },
  {
    id: '7',
    name: 'Games, Sports and eSports',
    description: 'Gaming, sports and esports services',
    icon: 'activity',
    image: require('@/assets/yam/sports.png'),
    slug: 'games-sports-esports'
  },
  {
    id: '8',
    name: 'Pets and Animals',
    description: 'Pet care and animal services',
    icon: 'heart',
    image: require('@/assets/yam/vet.png'),
    slug: 'pets-animals'
  },
  {
    id: '9',
    name: 'Home and Real Estate Services',
    description: 'Real estate and property services',
    icon: 'home',
    image: 'https://picsum.photos/300/200?random=309',
    slug: 'home-real-estate-services'
  },
  {
    id: '10',
    name: 'Car Services',
    description: 'Automotive and car maintenance services',
    icon: 'taxi',
    image: require('@/assets/yam/transport.png'),
    slug: 'car-services'
  },
  {
    id: '11',
    name: 'Porter Services',
    description: 'Porter and luggage handling services',
    icon: 'briefcase',
    image: 'https://picsum.photos/300/200?random=311',
    slug: 'porter-services'
  },
  {
    id: '12',
    name: 'Medical, Legal and Financial Services',
    description: 'Healthcare, legal and financial consultation',
    icon: 'shield',
    image: require('@/assets/yam/doctor.png'),
    slug: 'medical-legal-financial-services'
  },
  {
    id: '13',
    name: 'Consultancy and Educational Services',
    description: 'Professional consulting and education',
    icon: 'graduation-cap',
    image: 'https://picsum.photos/300/200?random=313',
    slug: 'consultancy-educational-services'
  },
  {
    id: '14',
    name: 'IT, Creative and Artistic Services',
    description: 'Technology, creative and artistic services',
    icon: 'palette',
    image: 'https://picsum.photos/300/200?random=314',
    slug: 'it-creative-artistic-services'
  },
  {
    id: '15',
    name: 'Beauty, Health and Personal Care Services',
    description: 'Beauty treatments and personal care',
    icon: 'spa',
    image: require('@/assets/yam/parlor.png'),
    slug: 'beauty-health-personal-care-services'
  },
  {
    id: '16',
    name: 'Repair and Maintenance Services',
    description: 'Repair and maintenance solutions',
    icon: 'tools',
    image: require('@/assets/yam/mechanic.png'),
    slug: 'repair-maintenance-services'
  },
  {
    id: '17',
    name: 'Travel and Leisure Services',
    description: 'Travel planning and leisure activities',
    icon: 'plane',
    image: 'https://picsum.photos/300/200?random=317',
    slug: 'travel-leisure-services'
  }
];

// Helper functions
export const getServiceCategoryById = (id: string): ServiceCategory | undefined => {
  return serviceCategories.find(category => category.id === id);
};

export const getServiceCategoryBySlug = (slug: string): ServiceCategory | undefined => {
  return serviceCategories.find(category => category.slug === slug);
};

export const getServiceCategoriesByIds = (ids: string[]): ServiceCategory[] => {
  return serviceCategories.filter(category => ids.includes(category.id));
};