// Path: data/servicecategory.ts

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  slug: string;
  designType: "circle" | "rounded"; // New field to differentiate designs
}

export const serviceCategories: ServiceCategory[] = [
  {
    id: "1",
    name: "Taxi Services",
    description: "Professional taxi and transportation services",
    icon: "car",
    slug: "taxi-services",
    designType: "circle",
  },
  {
    id: "2",
    name: "Restaurants and Fastfoods",
    description: "Dining, restaurants and fast food services",
    icon: "utensils",
    slug: "restaurants-fastfoods",
    designType: "circle",
  },
  {
    id: "3",
    name: "Cafe and Bakeries",
    description: "Coffee shops, cafes and bakery services",
    icon: "coffee",
    slug: "cafe-bakery",
    designType: "circle",
  },
  {
    id: "4",
    name: "Hotel services",
    description: "Hotel and hospitality services",
    icon: "building",
    slug: "hotels",
    designType: "circle",
  },
  {
    id: "5",
    name: "Home Stay, Ecolodge and Camping",
    description: "Homestays, eco-lodges and camping facilities",
    icon: "tent",
    slug: "homestays",
    designType: "circle",
  },
  {
    id: "6",
    name: "Groceries and Green Groceries",
    description: "Grocery stores and fresh produce services",
    icon: "shopping-basket",
    slug: "groceries",
    designType: "circle",
  },
  {
    id: "7",
    name: "Games, Sports and eSports",
    description: "Gaming, sports and esports services",
    icon: "gamepad",
    slug: "gaming-sports",
    designType: "circle",
  },
  {
    id: "8",
    name: "Pets and Animals",
    description: "Pet care and animal services",
    icon: "paw-print",
    slug: "pets",
    designType: "circle",
  },
  {
    id: "9",
    name: "Home and Real Estate Services",
    description: "Real estate and property services",
    icon: "home",
    slug: "real-estate",
    designType: "circle",
  },
  {
    id: "10",
    name: "Car Services",
    description: "Automotive and car maintenance services",
    icon: "car",
    slug: "car-services",
    designType: "rounded",
  },
  {
    id: "11",
    name: "Porter Services",
    description: "Porter and luggage handling services",
    icon: "package",
    slug: "porter-services",
    designType: "rounded",
  },
  {
    id: "12",
    name: "Medical, Legal and Financial Services",
    description: "Healthcare, legal and financial consultation",
    icon: "briefcase",
    slug: "professional-services",
    designType: "rounded",
  },
  {
    id: "13",
    name: "Consultancy and Educational Services",
    description: "Professional consulting and education",
    icon: "graduation-cap",
    slug: "consultancy-education",
    designType: "rounded",
  },
  {
    id: "14",
    name: "IT, Creative and Artistic Services",
    description: "Technology, creative and artistic services",
    icon: "palette",
    slug: "it-creative",
    designType: "rounded",
  },
  {
    id: "15",
    name: "Beauty, Health and Personal Care Services",
    description: "Beauty treatments and personal care",
    icon: "sparkles",
    slug: "beauty-health",
    designType: "rounded",
  },
  {
    id: "16",
    name: "Repair and Maintenance Services",
    description: "Repair and maintenance solutions",
    icon: "wrench",
    slug: "repair-maintenance",
    designType: "rounded",
  },
  {
    id: "17",
    name: "Travel and Leisure Services",
    description: "Travel planning and leisure activities",
    icon: "plane",
    slug: "travel-leisure",
    designType: "rounded",
  },
  {
    id: "18",
    name: "All other Services",
    description: "Miscellaneous and other services",
    icon: "grid",
    slug: "other-services",
    designType: "rounded",
  },
  {
    id: "19",
    name: "Government Services",
    description: "Government and public services",
    icon: "landmark",
    slug: "government-services",
    designType: "rounded",
  },
];

// Helper functions
export const getServiceCategoryById = (
  id: string,
): ServiceCategory | undefined => {
  return serviceCategories.find((category) => category.id === id);
};

export const getServiceCategoryBySlug = (
  slug: string,
): ServiceCategory | undefined => {
  return serviceCategories.find((category) => category.slug === slug);
};

export const getServiceCategoriesByIds = (ids: string[]): ServiceCategory[] => {
  return serviceCategories.filter((category) => ids.includes(category.id));
};
