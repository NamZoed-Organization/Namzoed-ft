import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type BannerType = "live" | "product";

export type BannerItem = {
  id: string;
  type: BannerType;
  header: string;
  body: string;
  link: string;
  image_url: string;
  cta: string;
};

export function useBanners() {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchBanners = async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("id, type, header, body, link, image_url, cta")
        .eq("is_active", true)
        .or("starts_at.is.null,starts_at.lte.now()")
        .or("expires_at.is.null,expires_at.gt.now()")
        .order("sort_order", { ascending: true });

      if (!cancelled && !error && data) {
        setBanners(data as BannerItem[]);
      }
      if (!cancelled) setLoading(false);
    };

    fetchBanners();
    return () => { cancelled = true; };
  }, []);

  return { banners, loading };
}
