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
    image: require("@/assets/images/all.png"),
    cta: "Shop Now",
  },
  {
    id: "2",
    type: "live",
    header: "Live Cooking Show",
    body: "Chef Kinley is Live\nWatch now!",
    link: "/live",
    image: require("@/assets/images/all.png"),
    cta: "Watch Now",},
  {
    id: "3",
    type: "product",
    header: "New Flavour Drop",
    body: "Introducing Peach Blast\nTry today",
    link: "/peach",
    image: require("@/assets/images/all.png"),
    cta: "Shop Now"
  },
  {
    id: "4",
    type: "live",
    header: "Event Streaming",
    body: "Farmers' Day - Live\nAll Bhutan Organic",
    link: "/events",
    image: require("@/assets/images/all.png"),
    cta: "Watch Now"
  },
  {
    id: "5",
    type: "product",
    header: "Limited Time Only",
    body: "Exclusive Pack Offer\nWhile stocks last",
    link: "/offers",
    image: require("@/assets/images/all.png"),
    cta: "Shop Now"
  },
];
