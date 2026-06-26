# Chat Multi-Media Picker - Feature Guide

## Overview
The messaging system now features a **multi-select image and video picker** that works like popular social media apps (Instagram, WhatsApp, Telegram, etc.).

Users can now:
- ✅ Select **multiple images and videos** at once
- ✅ Preview selected media before sending
- ✅ Easily add or remove items from selection
- ✅ Send all media with a single "Send" button
- ✅ Add more media without closing the selection screen

## What Changed

### Before (Old UX)
- 📸 User taps image picker icon
- 🖼️ Picks ONE image
- ⏳ Image uploads immediately
- 📤 User has to repeat for each photo/video

### After (New UX)
- 📸 User taps image picker icon
- 🖼️ Selects MULTIPLE images/videos
- 👁️ Previews all selected media in a grid
- ➕ Can add or remove items before sending
- 📤 Taps "Send All" to upload everything at once

## Key Features

### Multi-Select Gallery
```
Gallery opens with:
✓ Multiple selection enabled by default
✓ Allows both images AND videos
✓ Select as many as you want
✓ No limit on file count
```

### Preview Modal
```
After selection, shows:
✓ Grid view of all selected items
✓ Thumbnails (80px each)
✓ Play icon overlay for videos
✓ Delete button on each thumbnail
✓ "Add More" button to add additional media
✓ "Clear All" button to start over
```

### Send Button
```
✓ Shows count of items: "Send All (5)"
✓ Disabled if no items selected
✓ Shows upload progress
✓ Uploads all items in parallel
```

## Usage

### For Users
1. **Open chat** → Tap the gallery icon 📷
2. **Select media** → Tap to select multiple images/videos (checkmarks appear)
3. **Preview** → Modal shows grid of selected items
4. **Adjust selection**:
   - Tap "x" to remove an item
   - Tap "+" to add more
   - Tap "Clear" to start over
5. **Send** → Tap "Send All" button
6. **Monitor** → Watch as all items upload

### For Developers

#### Component Location
```
/components/chat/ChatMultiMediaPicker.tsx
```

#### Integration
The chat screen (`app/(users)/chat/[id].tsx`) already uses it:
```typescript
<ChatMultiMediaPicker
  currentUserUUID={effectiveCurrentUserUUID || ""}
  chatPartnerId={chatPartnerId as string}
  onOptimisticImage={handleOptimisticImage}
  onUploadSuccess={handleImageUploadSuccess}
  onUploadError={handleImageUploadError}
/>
```

#### Props
```typescript
interface ChatMultiMediaPickerProps {
  currentUserUUID: string;           // Current user's UUID
  chatPartnerId: string;             // Recipient's UUID
  onOptimisticImage: (msg: any) => void;     // Called when preview added
  onUploadSuccess: (msg: any, id: string) => void;  // Called when uploaded
  onUploadError: (id: string) => void;       // Called on error
  mode?: 'gallery' | 'camera';       // Default: 'gallery'
}
```

#### Callback Patterns
```typescript
// When user selects and modal appears
onOptimisticImage({ 
  id: string,
  sender_id: string,
  receiver_id: string,
  message_type: 'image' | 'video',
  image_url: string,     // Local URI for preview
  video_url?: string,
  isOptimistic: true     // Flag indicating it's pending upload
})

// After successful upload to Supabase
onUploadSuccess({
  id: string,            // DB id
  image_url: string,     // Public URL from Supabase
  video_url?: string,    // Public URL from Supabase
  message_type: 'image' | 'video',
  ...otherFields
}, optimisticId)

// On upload error
onUploadError(optimisticId)
```

## Technical Details

### File Structure
- Component: `ChatMultiMediaPicker.tsx`
- Stores selected media in state: `selectedMedia: SelectedMedia[]`
- Media type interface:
```typescript
interface SelectedMedia {
  id: string;           // Unique identifier
  uri: string;          // Local file URI
  type: 'image' | 'video';
  duration?: number;    // Video duration in ms
}
```

### Upload Strategy
- **Parallel uploads**: All files upload simultaneously using `Promise.all()`
- **Optimistic UI**: Shows preview while uploading
- **Database**: Each file creates separate message entry
- **Storage**: Images go to `chat-images` bucket, videos to `chat-videos`
- **URLs**: Public URLs returned from Supabase for chat display

### Gallery Features
- `allowsMultiple: true` - Enable multi-select in native picker
- `mediaTypes: All` - Accept both images and videos
- Supports both gallery AND camera (camera is single-shot)
- 3-column grid layout in preview
- Dynamic grid sizing: `(screenWidth - 32) / 3` per item

### Styling
- Material Design-inspired
- Uses NativeWind classes where possible
- Follows existing chat UI patterns
- Blue accent color for send button (#007AFF)
- Loading indicators during upload

## User Experience Flow

```
┌─────────────────────────────────────┐
│  Chat Screen                        │
│                                     │
│  [← Gallery Icon] [📷 Camera]      │
└────────┬────────────────────────────┘
         │
         ├─ Tap Gallery →  OS Image Picker
         │
         └─ Select images/videos (multiple!)
         │
         ├─ Modal appears with previews
         │  ┌─────────────────────────┐
         │  │ 5 items selected        │
         │  │  [📷] [🎥] [📷]       │
         │  │  [🎥] [📷]             │
         │  │                         │
         │  │ [x] Remove any          │
         │  │ [+] Add more            │
         │  │ [Clear] Start over      │
         │  │                         │
         │  │ [Send All (5)] ────→   │
         │  └─────────────────────────┘
         │
         └─ Uploads in parallel
            │
            ├─ Shows progress (optional)
            │
            └─ Messages appear in chat!
```

## Comparison: Old vs New

| Feature | Old | New |
|---------|-----|-----|
| Select images | Single | Multiple |
| Select videos | No | Yes |
| Preview before send | No | Yes |
| Batch upload | No | Yes |
| Parallel upload | No | Yes |
| Remove items | N/A | Yes |
| Add more | No | Yes |
| Upload time | Per item | All at once |
| User experience | Repetitive | Streamlined |

## Performance Notes

### Optimizations
- Parallel uploads reduce total time
- Thumbnails are 80px (small memory footprint)
- Grid uses `FlatList` for efficiency
- Images/videos compressed before upload (quality: 0.7)
- Only public URLs sent to chat (not full file data)

### Limitations
- No hard file count limit, but performance degrades with 50+ items
- Modal handles large selections efficiently
- Memory: OK for typical use (1-20 items)
- Bandwidth: Parallel uploads = faster but uses more bandwidth

## Best Practices

### For Users
1. **Select 1-10 items** for best performance
2. **Check previews** before sending to avoid mistakes
3. **Use "Clear" and start over** if you made a mistake
4. **Wait for upload to complete** before closing chat

### For Developers
1. **Always provide callbacks** - don't ignore errors
2. **Handle optimistic failures** - show retry option
3. **Test with various counts** - 1, 5, 10, 20 items
4. **Consider bandwidth** - might be slow on cellular
5. **Add loading indicators** - users appreciate feedback

## Troubleshooting

### Issue: "Media still not sent after upload"
- Check internet connection
- Wait for all uploads to complete
- Check Supabase storage quota

### Issue: "Modal closes unexpectedly"
- Might be iOS permission issue
- Check camera/photo library permissions

### Issue: "Videos not uploading"
- Check `chat-videos` bucket exists in Supabase
- Videos might be too large (test with <5MB)

## Future Enhancements

- [ ] Camera takes multiple photos sequentially
- [ ] Edit captions before sending
- [ ] Drag-to-reorder items
- [ ] Compress videos before upload
- [ ] Show file sizes in preview
- [ ] Add filters/effects
- [ ] Animated upload progress per item
- [ ] Undo send within 5 seconds

## Files Modified

- **Created**: `/components/chat/ChatMultiMediaPicker.tsx` (new)
- **Updated**: `/app/(users)/chat/[id].tsx` (replaced imports & usage)

## Backward Compatibility

Old `ChatImagePicker` component still exists but is no longer used in the chat screen. It can be:
- Kept for reference
- Used in other features
- Removed if not needed elsewhere
