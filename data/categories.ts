// data/categories.ts

export interface SubCategory {
  name: string
  count: number
}

export const categories: Record<string, SubCategory[]> = {
  fashion: [
    { name: "kids", count: 120 },
    { name: "mens", count: 340 },
    { name: "womens", count: 275 },
    { name: "unisex", count: 89 },
    { name: "shoes", count: 450 },
    { name: "slippers", count: 98 },
    { name: "traditional wear", count: 65 },
    { name: "jewelry", count: 230 },
    { name: "accessories", count: 310 },
  ],

  food: [
    { name: "groceries", count: 580 },
    { name: "snacks", count: 220 },
    { name: "local produce", count: 75 },
    { name: "organic", count: 150 },
    { name: "packaged food", count: 360 },
    { name: "spices", count: 130 },
    { name: "beverages", count: 200 },
  ],

  beauty: [
    { name: "skincare", count: 180 },
    { name: "haircare", count: 140 },
    { name: "makeup", count: 95 },
    { name: "fragrance", count: 60 },
    { name: "tools", count: 45 },
    { name: "wellness", count: 80 },
  ],

  "kids-and-toys": [
    { name: "toys", count: 210 },
    { name: "games", count: 170 },
    { name: "clothes", count: 90 },
    { name: "educational", count: 55 },
    { name: "baby essentials", count: 40 },
  ],

  electronics: [
    { name: "mobiles", count: 320 },
    { name: "laptops", count: 85 },
    { name: "audio", count: 150 },
    { name: "cameras", count: 70 },
    { name: "accessories", count: 200 },
    { name: "smart devices", count: 110 },
  ],

  "home-and-living": [
    { name: "furniture", count: 95 },
    { name: "kitchenware", count: 140 },
    { name: "home decor", count: 160 },
    { name: "bedding", count: 120 },
    { name: "storage", count: 85 },
    { name: "lighting", count: 60 },
    { name: "cleaning supplies", count: 45 },
  ],
}
