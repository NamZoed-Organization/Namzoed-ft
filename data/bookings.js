export const bookingCategories = [
  {
    name: "Ground Booking",
    slug: "ground-booking",
    subcategories: [
      {
        name: "Football Booking",
        slug: "football-booking",
      },
      {
        name: "Basket Booking",
        slug: "basket-booking",
      },
      {
        name: "Tennis Booking",
        slug: "tennis-booking",
      },
      {
        name: "Swimming Booking",
        slug: "swimming-booking",
      },
    ],
  },
  {
    name: "Room Booking",
    slug: "room-booking",
    subcategories: [
      {
        name: "Single Room",
        slug: "single-room",
      },
      {
        name: "Double Room",
        slug: "double-room",
      },
      {
        name: "Twin Room",
        slug: "twin-room",
      },
      {
        name: "Deluxe Room",
        slug: "deluxe-room",
      },
      {
        name: "Suite Room",
        slug: "suite-room",
      },
      {
        name: "Family Room",
        slug: "family-room",
      },
      {
        name: "Homestay Room",
        slug: "homestay-room",
      },
      {
        name: "Other Room Type",
        slug: "other-room-type",
      },
    ],
  },
];

export const getBookingCategoryBySlug = (slug) =>
  bookingCategories.find((category) => category.slug === slug);

export const getBookingSubcategoryBySlug = (categorySlug, subcategorySlug) =>
  bookingCategories
    .find((category) => category.slug === categorySlug)
    ?.subcategories.find((subcategory) => subcategory.slug === subcategorySlug);
