import { ImageSourcePropType } from "react-native";

export type BannerType = "live" | "product";

export type BannerItem = {
  id: string;
  type: BannerType;
  header: string;
  body: string;
  link: string;
  image: ImageSourcePropType;
  cta: string;
};

export const bannerData: BannerItem[] = [
  {
    id: "1",
    type: "product",
    header: "50-40% OFF",
    body: "Now in (product)\nAll colours",
    link: "/shop",
    image: { uri: "https://picsum.photos/400/200?random=101" },
    cta: "Shop Now",
  },
  {
    id: "2",
    type: "live",
    header: "Live Cooking Show",
    body: "Chef Kinley is Live\nWatch now!",
    link: "/live",
    image: { uri: "https://picsum.photos/400/200?random=102" },
    cta: "Watch Now",},
  {
    id: "3",
    type: "product",
    header: "New Flavour Drop",
    body: "Introducing Peach Blast\nTry today",
    link: "/peach",
    image: { uri: "https://picsum.photos/400/200?random=103" },
    cta: "Shop Now"
  },
  {
    id: "4",
    type: "live",
    header: "Event Streaming",
    body: "Farmers' Day - Live\nAll Bhutan Organic",
    link: "/events",
    image: { uri: "https://picsum.photos/400/200?random=104" },
    cta: "Watch Now"
  },
  {
    id: "5",
    type: "product",
    header: "Limited Time Only",
    body: "Exclusive Pack Offer\nWhile stocks last",
    link: "/offers",
    image: { uri: "https://picsum.photos/400/200?random=105" },
    cta: "Shop Now"
  },
];
