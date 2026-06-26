# Content Moderation System Implementation Guide

## Overview
A user-friendly content moderation system that **auto-detects and tags sensitive content while letting users have full control**. Posts are published immediately with appropriate warnings — no approval bottleneck for legal content.

### How It Works
1. **Auto-detect** — System scans post content for keywords (condoms, alcohol, weapons, etc.)
2. **Suggest tag** — Shows user a "This looks like sensitive content" suggestion with detected keywords
3. **User confirms or overrides** — User can accept, change, or ignore the suggestion
4. **Publish immediately** — Post goes live with the tag (no approval wait)
5. **Show warning in feed** — Feed shows content warnings/badges so viewers know what they're about to see

## Changes Made

### 1. **Database Schema** (`add_moderation_to_posts.sql`)
Run this migration to add moderation fields to your Supabase database:

```sql
-- Fields added to `posts` table:
- content_rating: 'general' | 'sensitive' | '18_plus' | 'review_required'
- moderation_status: 'approved' (default) | 'pending_review' | 'rejected'
- moderation_notes: text
- moderation_reviewed_at: timestamp
- is_flagged_for_review: boolean

-- Fields added to `profiles` table:
- birth_date: date
- age_verified: boolean
- age_verification_date: timestamp
```

**To apply migration:**
```bash
# Copy the SQL from add_moderation_to_posts.sql
# Run it in Supabase SQL Editor
```

**Note:** `moderation_status` defaults to `'approved'` — all legal posts publish immediately.

### 2. **Core Types** (`types/post.ts`)
Added moderation types:
```typescript
- ContentRating: 'general' | 'sensitive' | '18_plus' | 'review_required'
- ModerationStatus: 'approved' | 'pending_review' | 'rejected'
```

PostData interface now includes:
```typescript
contentRating?: ContentRating
moderationStatus?: ModerationStatus
moderationNotes?: string
```

### 3. **Content Classifier** (`lib/contentClassifier.ts`)
Automatically detects and suggests content ratings:
- **Sensitive keywords**: condoms, contraceptives, alcohol, tobacco, weapons
- **18+ markers**: explicit, xxx, nsfw, adult only
- **New `suggestContentRating()` function**: Returns suggestion with confidence level
  - `confidence: 'high' | 'medium' | 'low'`
  - `detectedKeywords`: Shows user what was found
  - **User can override** — the suggestion is just a starting point
- **Helper functions**:
  - `classifyPostContent()`: Auto-classify without user interaction
  - `canViewContent()`: Check if user can view based on age + rating
  - `getContentWarningMessage()`: Get user-facing warning text
  - `getContentRatingLabel()`: Get rating label for UI

### 4. **Updated Post Service** (`lib/postsService.ts`)
Enhanced functions:
- `createPost()`: Auto-classifies content but **publishes immediately** with the tag
  - Posts rated 'sensitive' or '18_plus' → Published with warning badge
  - Posts rated 'general' → Published as normal
  - Posts rated 'review_required' → Pending review (policy violations only)
  - User can override the suggested rating before posting
- `updatePostModerationStatus()`: Update status + notes (for admin use)
- `flagPostForReview()`: Manual flag for moderation (user reports)
- `fetchModerationQueue()`: Get posts pending review (policy violations)
- `getUserAge()`: Get user age from birth_date
- `filterPostsByUserAge()`: Filter posts based on user age

### 6. **Content Rating Selector Component** (`components/ContentRatingSuggestion.tsx`)
Shows the auto-detected rating suggestion during post creation:
- **Prominent mode**: Shows full suggestion with detected keywords and warning
- **Compact mode**: Quick rating selector for already-identified content
- **User can override**: Accept suggestion, change it, or ignore it
- **Feedback**: Shows what was detected and why

```typescript
// Usage in post creation form:
import { suggestContentRating } from '@/lib/contentClassifier';
import ContentRatingSuggestion from '@/components/ContentRatingSuggestion';

const suggestion = suggestContentRating(postText, tags);
const [rating, setRating] = useState<ContentRating>(suggestion.suggested);

<ContentRatingSuggestion
  suggestion={suggestion}
  selectedRating={rating}
  onRatingChange={setRating}
  showProminent={suggestion.confidence === 'high'}
/>
```

### 6. **Feed Updates** (`app/(users)/(tabs)/feed.tsx`)
Enhanced filtering:
- Imports content classifier
- Filters out non-approved posts
- Filters by content rating (hides 18+ for unverified users)
- Only shows posts user can view

---

## Quick Start

### **1. Run the Database Migration**
Copy-paste the SQL from `add_moderation_to_posts.sql` into Supabase → SQL Editor → Execute

### **2. Test It in Post Creation**
1. Create a post with sensitive keyword: "Check out condoms on sale"
2. See the suggestion: "This looks like sensitive content"
3. Confirm or override the rating with 1 tap
4. Post publishes **immediately** ✓
5. In feed, shows yellow badge + warning overlay

### **3. Enable in Your Post Form**
Add the ContentRatingSuggestion component to your post creation form:
```typescript
import { suggestContentRating } from '@/lib/contentClassifier';
import ContentRatingSuggestion from '@/components/ContentRatingSuggestion';

// In your post component:
const [postText, setPostText] = useState('');
const [contentRating, setContentRating] = useState<ContentRating>('general');

const suggestion = suggestContentRating(postText, tags);

return (
  <View>
    {/* Post text input */}
    <TextInput value={postText} onChangeText={setPostText} />
    
    {/* Content rating suggestion */}
    {suggestion.suggested !== 'general' && (
      <ContentRatingSuggestion
        suggestion={suggestion}
        selectedRating={contentRating}
        onRatingChange={setContentRating}
        showProminent={true}
      />
    )}
    
    {/* Publish with user's chosen rating */}
    <Button
      onPress={() => createPost({
        content: postText,
        images,
        userId,
        contentRating  // User's selection
      })}
    >
      Post
    </Button>
  </View>
);
```

### **4. (Optional) Add Admin Dashboard**
See the `ModerationDashboard.tsx` component to review flagged posts.

---

## Content Classification Examples

### ✅ Auto-classified as SENSITIVE:
- "Check out these new condoms on sale"
- "Premium wine collection available"
- "Cigarettes and tobacco products"

### ✅ Auto-classified as 18_PLUS:
- "18+ only explicit content"
- "XXX premium service"
- "NSFW adult entertainment"

### ✅ Auto-classified as GENERAL:
- "New shoes collection"
- "Fresh groceries daily"
- "Looking for a roommate"

## Implementation Checklist

### Step 1: Run Database Migration
- [ ] Go to Supabase → SQL Editor
- [ ] Copy-paste content from `add_moderation_to_posts.sql`
- [ ] Execute the migration
- [ ] Verify new columns exist in posts table

### Step 2: Update App Code
- [x] Types updated (`types/post.ts`) with `ContentRatingSuggestion`
- [x] Content classifier created (`lib/contentClassifier.ts`) with `suggestContentRating()`
- [x] Post service updated (`lib/postsService.ts`) to auto-publish
- [x] ContentWarning component created (`components/ContentWarning.tsx`)
- [x] ContentRatingSuggestion component created (`components/ContentRatingSuggestion.tsx`) — NEW!
- [x] Feed updated (`app/(users)/(tabs)/feed.tsx`)

### Step 3: Integrate Into Post Creation Form
- [ ] Add `suggestContentRating()` call in your create post component
- [ ] Import and display `<ContentRatingSuggestion />` 
- [ ] Pass `contentRating` to `createPost()` based on user's selection
- [ ] Show confirmation that post was published with its rating

### Step 4: Test the System

#### Test Content Creation:
1. Open create post modal
2. Type content with sensitive keyword (e.g., "condoms on sale")
3. See suggestion appear: "Contains Sensitive Content"
4. Can accept (1 tap) or override to 'general' or '18_plus'
5. Post publishes immediately with the chosen rating
6. Post appears in feed with warning badge

#### Test Feed Display:
1. Feed shows posts from all ratings
2. Sensitive/18+ posts show colored badge + warning overlay
3. User can still see the content after acknowledging warning

#### Test Moderation (if implemented):
1. Posts with 'review_required' go to admin queue only
2. Approved posts never need manual review

### Step 4: Add Admin Dashboard (Optional)
Create an admin screen to:
- View moderation queue
- Approve/reject posts with notes
- See moderation history

Example endpoint:
```typescript
import { fetchModerationQueue, updatePostModerationStatus } from '@/lib/postsService';

// Get pending posts
const queue = await fetchModerationQueue(50);

// Approve a post
await updatePostModerationStatus(postId, 'approved', 'OK to display');

// Reject a post
await updatePostModerationStatus(postId, 'rejected', 'Violates policy');
```

### Step 5: Add Age Verification (Optional)
Enhance `profiles` table integration:
```typescript
import { getUserAge } from '@/lib/postsService';

const userAge = await getUserAge(userId);
const canView18Plus = userAge >= 18 || isAgeVerified;
```

## Special Cases

### Condoms/Sexual Wellness (Legal Content)
**Problem:** These are legal products but age-inappropriate for some users  
**Solution:** Auto-tag as 'sensitive' with user override option

**User Flow:**
1. ✅ Creates post: "Premium condoms, 50% off"
2. 🤖 System detects keyword "condoms"
3. 💬 Shows suggestion: "This looks like sensitive content. OK?"
4. ✅ User taps "Confirm" (or changes to general/18+ if they disagree)
5. 📤 Post publishes **immediately** with the tag
6. 👁️ In feed, shows yellow badge "Sensitive Content"
7. ⚠️ Viewers see warning before viewing
8. ✅ Adults confirm warning and see post
9. 🚫 Unverified users see warning but can still view (with alert)

**Key Difference from Old System:**
- ❌ Old: Auto-classify → pending review → wait for admin → finally publish
- ✅ New: Auto-detect → suggest → user confirms → publish immediately

### Products in Marketplace
For selling products (condoms, alcohol, weapons):
- Tag automatically detected from product title/description
- User can override if incorrect
- Badge shows on product cards in search results
- Filters available so users can hide/show by rating

### User Preferences
Consider adding user settings:
- Hide sensitive content option
- Block 18+ entirely
- Notifications for followed users' sensitive posts

## API Reference

### For Content Classification:
```typescript
import { 
  classifyPostContent,
  suggestContentRating,
  getContentWarningMessage 
} from '@/lib/contentClassifier';

// Auto-classify (returns rating without user interaction)
const rating = classifyPostContent(postText, tags);
// Returns: 'general' | 'sensitive' | '18_plus' | 'review_required'

// Get suggestion with confidence (for UI)
const suggestion = suggestContentRating(postText, tags);
// Returns: { suggested: ContentRating, confidence: 'high'|'medium'|'low', detectedKeywords?: string[] }

// Get warning message
const message = getContentWarningMessage(rating);
// Returns: user-facing warning text or null
```

### For Post Creation (with user rating control):
```typescript
import { createPost } from '@/lib/postsService';
import { suggestContentRating } from '@/lib/contentClassifier';

// 1. Suggest a rating based on content
const suggestion = suggestContentRating(postText, tags);

// 2. Let user confirm or override
const [selectedRating, setSelectedRating] = useState(suggestion.suggested);

// 3. User can change it via UI
// setSelectedRating('general') or setSelectedRating('18_plus')

// 4. Post with user's chosen rating
const post = await createPost({
  content: postText,
  images: [...],
  userId: currentUser.id,
  contentRating: selectedRating  // User's choice (overrides auto-classify)
});

// Post is immediately published with the rating!
// No approval needed for legal content
```

### For Manual Moderation (policy violations):
```typescript
import { 
  fetchModerationQueue, 
  updatePostModerationStatus 
} from '@/lib/postsService';

// Get posts flagged for review (policy violations, not legal content)
const queue = await fetchModerationQueue(50);

// Update status
await updatePostModerationStatus(postId, 'approved', 'OK to show');
await updatePostModerationStatus(postId, 'rejected', 'Violates policy X');
```

## Future Enhancements

1. **AI-powered classification**: Use ML model for more accurate classification
2. **Image analysis**: Detect sensitive/explicit images automatically
3. **Community reporting**: Let users flag content for review
4. **Appeal system**: Allow creators to appeal rejections
5. **Blocklist**: Share blocked content across network
6. **Age verification**: Integrate SMS/ID verification service
7. **Parental controls**: Family account settings
8. **Content timeline**: Show different content based on user age

## Troubleshooting

### Posts not showing in feed?
- Check `moderation_status` in database (should be 'approved')
- Check `content_rating` (might be filtering incorrectly)
- Check user age verification status

### Content warning not appearing?
- Verify `contentRating` is not 'general'
- Check ContentWarning component is imported in FeedPost
- Verify post data includes `contentRating` field

### Migration fails?
- Check syntax in SQL file
- Ensure columns don't already exist (use IF NOT EXISTS)
- Check Supabase RLS policies allow table modifications

## Questions?

For more information on content moderation best practices, see:
- https://en.wikipedia.org/wiki/Content_moderation
- https://www.eff.org/issues/content-moderation
