import { supabase } from './supabase';

export interface RecommendationChip {
  id: string;
  label: string;
  query: string;
  type: 'location' | 'tag' | 'trending' | 'category';
  icon?: string;
}

// Generate random keyword recommendations from database
export const generateRecommendedSearches = async (
  userId?: string,
  userDzongkhag?: string
): Promise<RecommendationChip[]> => {
  const recommendations: RecommendationChip[] = [];

  try {
    // 1. Random tags from marketplace (50% of recommendations)
    const { data: marketplaceTags } = await supabase
      .from('marketplace')
      .select('tags')
      .not('tags', 'is', null)
      .limit(100);

    if (marketplaceTags && marketplaceTags.length > 0) {
      const allTags: string[] = [];
      marketplaceTags.forEach((item: any) => {
        item.tags?.forEach((tag: string) => {
          // Only include simple tags without commas, less than 20 chars
          if (!allTags.includes(tag) && !tag.includes(',') && tag.length < 20) {
            allTags.push(tag);
          }
        });
      });

      // Pick 5 random tags
      const shuffledTags = allTags.sort(() => Math.random() - 0.5).slice(0, 5);
      shuffledTags.forEach((tag, index) => {
        recommendations.push({
          id: `tag-${index}`,
          label: tag,
          query: tag,
          type: 'tag',
          icon: 'pricetag'
        });
      });
    }

    // 2. Random marketplace types (50% of recommendations)
    const { data: marketplaceTypes } = await supabase
      .from('marketplace')
      .select('type')
      .not('type', 'is', null)
      .limit(100);

    if (marketplaceTypes && marketplaceTypes.length > 0) {
      const types = Array.from(new Set(marketplaceTypes.map((m: any) => m.type)));
      const shuffled = types.sort(() => Math.random() - 0.5).slice(0, 5);
      shuffled.forEach((type, index) => {
        const icon =
          type.toLowerCase().includes('rent') ? 'home' :
          type.toLowerCase().includes('free') ? 'gift' :
          type.toLowerCase().includes('swap') ? 'swap-horizontal' :
          'storefront';

        recommendations.push({
          id: `type-${index}`,
          label: type,
          query: type,
          type: 'category',
          icon: icon
        });
      });
    }

    // Shuffle and limit to 10 recommendations
    return recommendations
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return []; // No fallback - return empty array
  }
};
