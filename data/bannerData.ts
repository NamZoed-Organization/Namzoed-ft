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
  // TODO: Replace with real banner data and images from your CDN before launch.
  // These are placeholder entries for layout testing.
];
