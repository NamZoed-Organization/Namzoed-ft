// Path: data/servicecategory.ts

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  slug: string;
}

export const serviceCategories: ServiceCategory[] = [
  {
    id: '1',
    name: 'Taxi Services',
    description: 'Professional taxi and transportation services',
    icon: 'taxi',
    image: '/images/all.png',
    slug: 'taxi-services'
  },
  {
    id: '2',
    name: 'Home Services',
    description: 'Residential maintenance and home improvement services',
    icon: 'home',
    image: '/images/all.png',
    slug: 'home-services'
  },
  {
    id: '3',
    name: 'Hotel Services',
    description: 'Hospitality and accommodation services',
    icon: 'hotel',
    image: '/images/all.png',
    slug: 'hotel-services'
  },
  {
    id: '4',
    name: 'Beauty & Wellness',
    description: 'Beauty treatments and wellness services',
    icon: 'spa',
    image: '/images/all.png',
    slug: 'beauty-wellness'
  },
  {
    id: '5',
    name: 'Repair & Maintenance',
    description: 'Technical repair and maintenance solutions',
    icon: 'tools',
    image: '/images/all.png',
    slug: 'repair-maintenance'
  },
  {
    id: '6',
    name: 'Education & Coaching',
    description: 'Educational services and professional coaching',
    icon: 'graduation-cap',
    image: '/images/all.png',
    slug: 'education-coaching'
  },
  {
    id: '7',
    name: 'Creative & Media',
    description: 'Creative design and media production services',
    icon: 'palette',
    image: '/images/all.png',
    slug: 'creative-media'
  },
  {
    id: '8',
    name: 'Business Services',
    description: 'Professional business and consulting services',
    icon: 'briefcase',
    image: '/images/all.png',
    slug: 'business-services'
  },
  {
    id: '9',
    name: 'Travel & Leisure',
    description: 'Travel planning and leisure activity services',
    icon: 'map-pin',
    image: '/images/all.png',
    slug: 'travel-leisure'
  },
  {
    id: '10',
    name: 'Pet Services',
    description: 'Pet care and veterinary services',
    icon: 'heart',
    image: '/images/all.png',
    slug: 'pet-services'
  },
  {
    id: '11',
    name: 'Health & Medical',
    description: 'Healthcare and medical consultation services',
    icon: 'activity',
    image: '/images/all.png',
    slug: 'health-medical'
  },
  {
    id: '12',
    name: 'Events & Entertainment',
    description: 'Event planning and entertainment services',
    icon: 'calendar',
    image: '/images/all.png',
    slug: 'events-entertainment'
  },
  {
    id: '13',
    name: 'Government Services',
    description: 'Official government and public services',
    icon: 'shield',
    image: '/images/all.png',
    slug: 'government-services'
  },
  {
    id: '14',
    name: 'Travel Services',
    description: 'Comprehensive travel and booking services',
    icon: 'plane',
    image: '/images/all.png',
    slug: 'travel-services'
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