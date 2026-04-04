const trim = (value: string, max = 80) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const SHARE_WEB_BASE_URL =
  process.env.EXPO_PUBLIC_SHARE_BASE_URL || "https://namzoed.com";

export interface ShareableProduct {
  id: string;
  name: string;
  price?: string | number;
  imageUrl?: string;
}

export interface ShareablePost {
  id: string;
  author?: string;
  content?: string;
  imageUrl?: string;
}

export interface ShareableProfile {
  id: string;
  name?: string;
  username?: string;
}

export const buildProductDeepLink = (product: ShareableProduct) =>
  `namzoed://product/${encodeURIComponent(product.id)}?ref=external`;

export const buildPostDeepLink = (post: ShareablePost) =>
  `namzoed://post/${encodeURIComponent(post.id)}?ref=external`;

export const buildProfileDeepLink = (profile: ShareableProfile) =>
  `namzoed://profile/${encodeURIComponent(profile.id)}?ref=external`;

const buildProductWebShareUrl = (product: ShareableProduct) => {
  const deepLink = buildProductDeepLink(product);
  return `${SHARE_WEB_BASE_URL}/product/${encodeURIComponent(product.id)}?ref=external&deep_link=${encodeURIComponent(deepLink)}`;
};

const buildPostWebShareUrl = (post: ShareablePost) => {
  const deepLink = buildPostDeepLink(post);
  return `${SHARE_WEB_BASE_URL}/post/${encodeURIComponent(post.id)}?ref=external&deep_link=${encodeURIComponent(deepLink)}`;
};

const buildProfileWebShareUrl = (profile: ShareableProfile) => {
  return `${SHARE_WEB_BASE_URL}/profile/${encodeURIComponent(profile.id)}`;
};

export const buildProductExternalSharePayload = (product: ShareableProduct) => {
  const webUrl = buildProductWebShareUrl(product);
  const message = "";

  return {
    title: product.name,
    message,
    url: webUrl,
  };
};

export const buildPostExternalSharePayload = (post: ShareablePost) => {
  const webUrl = buildPostWebShareUrl(post);
  const message = "";

  return {
    title: post.author ? `${post.author}'s post` : "Namzoed post",
    message,
    url: webUrl,
  };
};

export const buildProfileExternalSharePayload = (profile: ShareableProfile) => {
  const webUrl = buildProfileWebShareUrl(profile);
  const title = profile.name || profile.username || "Namzoed profile";

  return {
    title,
    message: "",
    url: webUrl,
  };
};
