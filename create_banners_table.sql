-- =============================================================
--  Banners table — admin-managed promotional banners
--  Run this in your Supabase SQL editor.
-- =============================================================

-- 1. Create the table
create table if not exists public.banners (
  id          uuid primary key default gen_random_uuid(),
  type        text not null default 'product' check (type in ('live', 'product')),
  header      text not null,
  body        text not null,
  link        text not null default '',
  image_url   text not null,
  cta         text not null default 'Learn More',
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  starts_at   timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Index for fast active-banner queries
create index if not exists idx_banners_active
  on public.banners (is_active, sort_order)
  where is_active = true;

-- 3. Auto-update `updated_at` on row change
create or replace function public.handle_banners_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_banners_updated on public.banners;
create trigger on_banners_updated
  before update on public.banners
  for each row execute function public.handle_banners_updated_at();

-- 4. RLS — everyone can read active banners, only service_role can mutate
alter table public.banners enable row level security;

-- Public read: only active banners within their schedule window
create policy "Anyone can read active banners"
  on public.banners for select
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at > now())
  );

-- Admin writes via service_role key (from your admin dashboard backend)
-- No insert/update/delete policies for anon/authenticated — mutations
-- must go through a server-side admin endpoint using the service_role key.

-- 5. Seed a sample row (optional — remove or adjust for production)
-- insert into public.banners (type, header, body, link, image_url, cta, sort_order)
-- values
--   ('product', 'Grand Opening Sale', 'Up to 50% off\nAll categories', 'https://namzoed.com', 'https://your-cdn.com/banner1.jpg', 'Shop Now', 1);
