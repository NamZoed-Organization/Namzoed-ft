-- Table for live stream comments
create table public.stream_comments (
  id uuid primary key default gen_random_uuid(),
  live_stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) <= 500),
  created_at timestamptz default now() not null
);

-- Enable Realtime for this table so viewers see messages instantly
alter publication supabase_realtime add table stream_comments;

-- Indexes for performance
create index stream_comments_live_stream_id_idx on public.stream_comments (live_stream_id);

-- RLS Policies
alter table public.stream_comments enable row level security;

-- Everyone can read comments
create policy "Comments are viewable by everyone"
  on public.stream_comments for select
  using (true);

-- Authenticated users can insert their own comments
create policy "Users can post comments"
  on public.stream_comments for insert
  with check (auth.uid() = user_id);