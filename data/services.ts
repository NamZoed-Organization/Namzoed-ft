// Path: data/services.ts

export interface ServiceOffering {
  id: string;
  name: string;
  price: number;
  description?: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  phone: string;
  images: string[];
  description: string;
  location: string;
  available: boolean;
  services: ServiceOffering[];
  rating?: number;
  reviewCount?: number;
}

export const serviceProviders: ServiceProvider[] = [
  // Taxi Services
  {
    id: '1',
    name: 'Sonam Dorji',
    category: 'Taxi Services',
    categoryId: '1',
    phone: '77737314',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Experienced taxi driver with 8 years of service. Safe and reliable transportation across Bhutan.',
    location: 'Thimphu',
    available: true,
    services: [
      {
        id: 's1_1',
        name: 'Thimphu-Paro',
        price: 800,
        description: 'Per seat'
      },
      {
        id: 's1_2',
        name: 'Reserved Car',
        price: 2500,
        description: 'Full car reservation'
      },
      {
        id: 's1_3',
        name: 'Thimphu-Punakha',
        price: 1200,
        description: 'Per seat'
      }
    ],
    rating: 4.8,
    reviewCount: 156
  },
  {
    id: '2',
    name: 'Karma Wangchuk',
    category: 'Taxi Services',
    categoryId: '1',
    phone: '17542891',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Professional taxi service with modern vehicles. Specializing in airport transfers and long-distance trips.',
    location: 'Paro',
    available: true,
    services: [
      {
        id: 's2_1',
        name: 'Paro-Thimphu',
        price: 750,
        description: 'Per seat'
      },
      {
        id: 's2_2',
        name: 'Airport Transfer',
        price: 500,
        description: 'One way'
      },
      {
        id: 's2_3',
        name: 'Reserved Car',
        price: 3000,
        description: 'Full day rental'
      }
    ],
    rating: 4.6,
    reviewCount: 98
  },
  {
    id: '3',
    name: 'Tenzin Norbu',
    category: 'Taxi Services',
    categoryId: '1',
    phone: '77856342',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Local taxi service with excellent knowledge of mountain routes. Available for both short and long trips.',
    location: 'Punakha',
    available: false,
    services: [
      {
        id: 's3_1',
        name: 'Punakha-Thimphu',
        price: 1000,
        description: 'Per seat'
      },
      {
        id: 's3_2',
        name: 'Punakha-Wangdue',
        price: 400,
        description: 'Per seat'
      },
      {
        id: 's3_3',
        name: 'Reserved Car',
        price: 2800,
        description: 'Full car reservation'
      }
    ],
    rating: 4.7,
    reviewCount: 74
  },
  {
    id: '4',
    name: 'Dorji Tshering',
    category: 'Taxi Services',
    categoryId: '1',
    phone: '17923456',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Reliable taxi service covering eastern routes. Clean vehicles and punctual service guaranteed.',
    location: 'Bumthang',
    available: true,
    services: [
      {
        id: 's4_1',
        name: 'Bumthang-Thimphu',
        price: 2000,
        description: 'Per seat'
      },
      {
        id: 's4_2',
        name: 'Bumthang-Trongsa',
        price: 800,
        description: 'Per seat'
      },
      {
        id: 's4_3',
        name: 'Reserved Car',
        price: 4500,
        description: 'Full day rental'
      }
    ],
    rating: 4.9,
    reviewCount: 43
  },

  // Home Services
  {
    id: '5',
    name: 'Pema Construction',
    category: 'Home Services',
    categoryId: '2',
    phone: '17445789',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Professional home construction and renovation services. Licensed contractors with 15+ years experience.',
    location: 'Thimphu',
    available: true,
    services: [
      {
        id: 's5_1',
        name: 'House Renovation',
        price: 50000,
        description: 'Per room'
      },
      {
        id: 's5_2',
        name: 'Plumbing Service',
        price: 1500,
        description: 'Basic repair'
      },
      {
        id: 's5_3',
        name: 'Electrical Work',
        price: 2000,
        description: 'Installation/repair'
      }
    ],
    rating: 4.5,
    reviewCount: 89
  },
  {
    id: '6',
    name: 'Norbu Cleaning Services',
    category: 'Home Services',
    categoryId: '2',
    phone: '77891234',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Professional home cleaning and maintenance services. Eco-friendly products and trained staff.',
    location: 'Paro',
    available: true,
    services: [
      {
        id: 's6_1',
        name: 'House Cleaning',
        price: 800,
        description: 'Per visit'
      },
      {
        id: 's6_2',
        name: 'Deep Cleaning',
        price: 2500,
        description: 'Full house'
      },
      {
        id: 's6_3',
        name: 'Garden Maintenance',
        price: 1200,
        description: 'Monthly service'
      }
    ],
    rating: 4.7,
    reviewCount: 67
  },

  // Beauty & Wellness
  {
    id: '7',
    name: 'Lotus Beauty Salon',
    category: 'Beauty & Wellness',
    categoryId: '4',
    phone: '17334567',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Full-service beauty salon offering modern treatments and traditional therapies.',
    location: 'Thimphu',
    available: true,
    services: [
      {
        id: 's7_1',
        name: 'Hair Cut & Style',
        price: 500,
        description: 'Basic styling'
      },
      {
        id: 's7_2',
        name: 'Facial Treatment',
        price: 1200,
        description: 'Deep cleansing'
      },
      {
        id: 's7_3',
        name: 'Massage Therapy',
        price: 1500,
        description: '60 minutes'
      }
    ],
    rating: 4.8,
    reviewCount: 142
  },

  // Repair & Maintenance
  {
    id: '8',
    name: 'Tech Fix Solutions',
    category: 'Repair & Maintenance',
    categoryId: '5',
    phone: '77665544',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Expert repair services for electronics, appliances, and technical equipment.',
    location: 'Thimphu',
    available: true,
    services: [
      {
        id: 's8_1',
        name: 'Phone Repair',
        price: 1000,
        description: 'Screen/battery replacement'
      },
      {
        id: 's8_2',
        name: 'Laptop Service',
        price: 2500,
        description: 'Hardware/software issues'
      },
      {
        id: 's8_3',
        name: 'Appliance Repair',
        price: 1800,
        description: 'Home appliances'
      }
    ],
    rating: 4.6,
    reviewCount: 95
  },

  // Education & Coaching
  {
    id: '9',
    name: 'Wisdom Learning Center',
    category: 'Education & Coaching',
    categoryId: '6',
    phone: '17987654',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Professional tutoring and coaching services for all academic levels and competitive exams.',
    location: 'Thimphu',
    available: true,
    services: [
      {
        id: 's9_1',
        name: 'Math Tutoring',
        price: 800,
        description: 'Per hour'
      },
      {
        id: 's9_2',
        name: 'English Classes',
        price: 700,
        description: 'Per hour'
      },
      {
        id: 's9_3',
        name: 'BCSE Coaching',
        price: 5000,
        description: 'Monthly package'
      }
    ],
    rating: 4.9,
    reviewCount: 78
  },

  // Business Services
  {
    id: '10',
    name: 'Dragon Consultancy',
    category: 'Business Services',
    categoryId: '8',
    phone: '17112233',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Professional business consulting, accounting, and legal documentation services.',
    location: 'Thimphu',
    available: true,
    services: [
      {
        id: 's10_1',
        name: 'Business Registration',
        price: 3000,
        description: 'Complete process'
      },
      {
        id: 's10_2',
        name: 'Tax Filing',
        price: 1500,
        description: 'Annual returns'
      },
      {
        id: 's10_3',
        name: 'Legal Documentation',
        price: 2500,
        description: 'Contract drafting'
      }
    ],
    rating: 4.7,
    reviewCount: 54
  },

  // Pet Services
  {
    id: '11',
    name: 'Happy Paws Clinic',
    category: 'Pet Services',
    categoryId: '10',
    phone: '77998877',
    images: ['/images/all.png', '/images/all.png', '/images/all.png'],
    description: 'Complete pet care services including veterinary care, grooming, and boarding.',
    location: 'Thimphu',
    available: true,
    services: [
      {
        id: 's11_1',
        name: 'Pet Checkup',
        price: 500,
        description: 'General examination'
      },
      {
        id: 's11_2',
        name: 'Pet Grooming',
        price: 800,
        description: 'Bath and trim'
      },
      {
        id: 's11_3',
        name: 'Pet Boarding',
        price: 600,
        description: 'Per night'
      }
    ],
    rating: 4.8,
    reviewCount: 91
  }
];

// Helper functions
export const getServiceProviderById = (id: string): ServiceProvider | undefined => {
  return serviceProviders.find(provider => provider.id === id);
};

export const getServiceProvidersByCategory = (categoryId: string): ServiceProvider[] => {
  return serviceProviders.filter(provider => provider.categoryId === categoryId);
};

export const getAvailableServiceProviders = (): ServiceProvider[] => {
  return serviceProviders.filter(provider => provider.available);
};

export const getServiceProvidersByLocation = (location: string): ServiceProvider[] => {
  return serviceProviders.filter(provider => 
    provider.location.toLowerCase().includes(location.toLowerCase())
  );
};

export const searchServiceProviders = (query: string): ServiceProvider[] => {
  const searchTerm = query.toLowerCase();
  return serviceProviders.filter(provider =>
    provider.name.toLowerCase().includes(searchTerm) ||
    provider.category.toLowerCase().includes(searchTerm) ||
    provider.location.toLowerCase().includes(searchTerm) ||
    provider.description.toLowerCase().includes(searchTerm) ||
    provider.services.some(service => 
      service.name.toLowerCase().includes(searchTerm)
    )
  );
};