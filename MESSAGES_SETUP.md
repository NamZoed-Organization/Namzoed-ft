# Messages Feature - Setup Guide

## Current Status

✅ **Messages feature is implemented and ready to use**
❌ **No real messages are showing because the RLS policy is blocking database access**

## What's Happening

1. **Messages Table**: Exists in Supabase ✅
2. **Profiles**: Have 4 users in the database ✅
3. **RLS Policy**: BLOCKING all reads and writes ❌

The messages table has a Row-Level Security (RLS) policy that prevents the app from accessing messages.

## Quick Fix - Enable Real Messages

### Step 1: Open Supabase Dashboard
Go to: https://ixpyigcoimuusmahbsyq.supabase.co

### Step 2: Open SQL Editor
- Click "SQL Editor" in the left sidebar
- Click "New query"

### Step 3: Run This SQL Command

```sql
-- Disable RLS on messages table to allow reads/writes
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
```

Click "Run" (or Ctrl+Enter)

### Step 4: Insert Test Messages

After disabling RLS, run this command in the project:

```bash
node insert-messages-final.js
```

This will insert 7 test messages between different users.

### Step 5: Test in App

Open the Messages tab - you should now see real chat partners from the database!

## Current Demo Data

The app currently shows demo messages from 4 users:
- Anup (77263425)
- Kinley Norbu Thinley (17831049)  
- Kinley D. Namgyel (17585893)
- Sonam dorji (17680846)

Demo conversations include:
- pema_lhamo (traditional jewelry discussion)
- tenzin_dorji (handmade crafts)
- deki_yangchen (organic farming)

## After Fixing RLS

Once RLS is disabled and messages are inserted, the app will show:
- **Real messages from the database**
- **All unique chat partners you've messaged**
- **Last message for each conversation**
- **Sorted by most recent message**

## File Structure

- `app/(users)/messages.tsx` - Main messages screen
- `data/17123456.ts` - Demo message data
- `lib/supabase.ts` - Supabase client configuration
