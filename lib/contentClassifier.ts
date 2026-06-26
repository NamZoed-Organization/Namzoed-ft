import { ContentRating } from '@/types/post';

/**
 * Keywords that indicate sensitive content categories
 * Organized by content rating level
 */
const SENSITIVE_KEYWORDS: Record<string, string[]> = {
  sexual_wellness: [
    'condom', 'contraceptive', 'lubricant', 'pregnancy test',
    'feminine hygiene', 'adult toy', 'sexual health',
  ],
  alcohol: [
    'wine', 'beer', 'whiskey', 'vodka', 'liquor', 'alcohol',
    'brewery', 'distillery', 'spirits',
  ],
  tobacco: [
    'cigarette', 'cigar', 'tobacco', 'smoking', 'vape',
  ],
  weapons: [
    'gun', 'knife', 'firearm', 'weapon', 'ammunition',
    'rifle', 'pistol', 'sword', 'blade',
  ],
  adult_services: [
    'escort', 'adult entertainment', 'xxx', 'explicit',
  ],
};

const EXPLICIT_KEYWORDS = [
  'xxx', '18+', 'explicit', 'adult only', 'nsfw',
];

/**
 * Automatically classify post content based on keywords and context
 * Returns the appropriate content rating
 */
export const classifyPostContent = (
  content: string,
  tags?: string[],
  taggedProductNames?: string[]
): ContentRating => {
  const combinedText = [
    content,
    ...(tags || []),
    ...(taggedProductNames || []),
  ]
    .join(' ')
    .toLowerCase();

  // Check for explicit markers
  if (EXPLICIT_KEYWORDS.some((keyword) => combinedText.includes(keyword))) {
    return '18_plus';
  }

  // Check for sensitive categories
  for (const [category, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
    if (keywords.some((keyword) => combinedText.includes(keyword))) {
      // Adult services and sexual-wellness items (condoms, lubricants, etc.) are
      // legal but age-restricted: only verified adults should see them.
      if (category === 'adult_services' || category === 'sexual_wellness') {
        return '18_plus';
      }
      // Other sensitive content (alcohol, tobacco, weapons) marked as sensitive
      return 'sensitive';
    }
  }

  return 'general';
};

/**
 * Determine if a user can view (and be recommended) content based on their age,
 * age-verification status, and their Safe View preference.
 *
 * - general                  → always visible.
 * - sensitive / 18_plus      → visible only to verified adults (18+) who have
 *                              turned Safe View OFF. With Safe View ON (the
 *                              default) or for minors / unverified users, this
 *                              content is hidden from the feed entirely so it is
 *                              never recommended.
 * - review_required          → never shown (blocked / pending moderation).
 *
 * `safeView` defaults to true so callers that don't pass it stay on the safe path.
 */
export const canViewContent = (
  contentRating: ContentRating,
  userAge?: number | null,
  isAgeVerified?: boolean,
  safeView: boolean = true
): boolean => {
  if (contentRating === 'general') return true;

  if (contentRating === 'sensitive' || contentRating === '18_plus') {
    // Safe View hides all mature content (default-on experience).
    if (safeView) return false;
    // Only verified adults may opt out of Safe View for mature content.
    if (!isAgeVerified) return false;
    if (userAge === undefined || userAge === null || userAge < 18) return false;
    return true;
  }

  // review_required posts should only show to moderators/admins
  return false;
};

/**
 * Get a user-facing label for content rating
 */
export const getContentRatingLabel = (rating: ContentRating): string => {
  const labels: Record<ContentRating, string> = {
    general: 'General Audience',
    sensitive: 'Contains Sensitive Content',
    '18_plus': '18+ Only',
    review_required: 'Under Review',
  };
  return labels[rating];
};

/**
 * Get warning message for sensitive content
 */
export const getContentWarningMessage = (rating: ContentRating): string | null => {
  const messages: Record<ContentRating, string | null> = {
    general: null,
    sensitive: 'This post contains content that may not be suitable for all audiences.',
    '18_plus': 'Only users above 18 can view this post.',
    review_required: 'This post is under review and cannot be displayed.',
  };
  return messages[rating];
};

/**
 * Suggest a content rating based on detected keywords
 * Returns the suggestion with confidence level so users can override
 * Useful for post creation forms to auto-suggest tags
 */
export const suggestContentRating = (
  content: string,
  tags?: string[],
  taggedProductNames?: string[]
): { suggested: ContentRating; confidence: 'high' | 'medium' | 'low'; detectedKeywords?: string[] } => {
  const combinedText = [
    content,
    ...(tags || []),
    ...(taggedProductNames || []),
  ]
    .join(' ')
    .toLowerCase();
  
  const foundKeywords: string[] = [];
  
  // Check for explicit markers first
  for (const keyword of EXPLICIT_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }
  
  if (foundKeywords.length > 0) {
    return { suggested: '18_plus', confidence: 'high', detectedKeywords: foundKeywords };
  }
  
  // Check for sensitive categories
  for (const [category, keywords] of Object.entries(SENSITIVE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (combinedText.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }
    
    if (foundKeywords.length > 0) {
      const suggested = category === 'adult_services' ? '18_plus' : 'sensitive';
      return { suggested, confidence: 'medium', detectedKeywords: foundKeywords };
    }
  }
  
  return { suggested: 'general', confidence: 'low' };
};
