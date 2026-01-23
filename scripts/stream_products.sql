-- Table to link products to a specific live stream
create table public.stream_products (
  id uuid primary key default gen_random_uuid(),
  live_stream_id uuid not null references public.live_streams(id) on delete cascade,
  product_id uuid not null, -- Assumes you have a 'products' table, or just use an ID
  display_order int default 0,
  is_featured boolean default false, -- Set to true when host is currently talking about it
  created_at timestamptz default now() not null
);

-- Enable Realtime so when host "features" a product, viewers' UI updates
alter publication supabase_realtime add table stream_products;

-- RLS Policies
alter table public.stream_products enable row level security;

-- Everyone can see which products are in the stream
create policy "Stream products are viewable by everyone"
  on public.stream_products for select
  using (true);

-- Only the host (creator of the stream) can add/update products in the stream
create policy "Hosts can manage stream products"
  on public.stream_products for all
  using (
    exists (
      select 1 from public.live_streams
      where id = stream_products.live_stream_id
      and user_id = auth.uid()
    )
  );