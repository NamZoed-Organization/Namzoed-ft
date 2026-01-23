-- Table for overlay text shown during a live stream
create table public.stream_texts (
  id uuid primary key default gen_random_uuid(),
  live_stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) <= 500),
  font_family text,
  font_size int default 18,
  color text default '#FFFFFF',
  background_color text default 'rgba(0,0,0,0.55)',
  border_color text default 'rgba(255,255,255,0.35)',
  border_width int default 0,
  border_radius int default 12,
  position text default 'bottom',
  updated_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  constraint stream_texts_live_stream_unique unique (live_stream_id)
);

create index stream_texts_live_stream_id_idx on public.stream_texts (live_stream_id);

-- Enable Realtime for overlay updates
alter publication supabase_realtime add table stream_texts;

-- RLS Policies
alter table public.stream_texts enable row level security;

create policy "Stream text is viewable by everyone"
  on public.stream_texts for select
  using (true);

create policy "Host can manage stream text"
  on public.stream_texts for all
  using (
    exists (
      select 1 from public.live_streams
      where id = stream_texts.live_stream_id
      and user_id = auth.uid()
    )
  );
