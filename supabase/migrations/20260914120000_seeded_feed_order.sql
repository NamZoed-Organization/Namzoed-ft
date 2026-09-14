-- ─── Seeded feed order ──────────────────────────────────────────────────
--
-- WHY THIS FILE EXISTS
--
-- Every ranked grid (Home, Shopping, category pages, Marketplace, service
-- categories) used to download its whole table — every column, and on posts
-- every like row — on each open and each pull-to-refresh, then shuffle it
-- with Math.random() on the phone. Each refresh was a brand-new order, so the
-- top of the grid was new photos the image cache did not have, and nothing
-- already scrolled past was kept. On paid mobile data in Bhutan that is the
-- most expensive thing the app could do.
--
-- WHAT IT DOES
--
-- One function per content type returns the day's order as a list of ids,
-- ranked with the rules lib/feedRanking.ts has always used — fairness weight
-- 1/(impressions_shown + 1), Efraimidis–Spirakis key u^(1/weight), and a
-- couple of boost slots first — except that u comes from a hash of
-- (seed, id) instead of random(). The app passes
-- seed = "<user id>:<Bhutan date>", so one person sees one order all day
-- (reopening the app shows what is already on the phone) and a fresh one
-- tomorrow. Rows are then fetched a page of ids at a time
-- (hooks/useRankedFeed.ts), and pull-to-refresh only adds what was posted
-- after `as_of`.
--
-- Why the whole order in one call rather than offset pages: impressions_shown
-- changes as people scroll, which would reorder an offset-paged list under
-- the reader and skip or repeat items. Ids are ~40 bytes each; 600 of them
-- is less than one grid photo.
--
-- SECURITY INVOKER throughout: row-level security applies exactly as it does
-- to the app's own selects, so nothing becomes visible that was not already.
--
-- Safe to run before or after the app update. Until these functions exist
-- the app ranks on the device from an id-only pool (lib/feedSession.ts).

-- u ∈ (0, 1] from the seed and id, raised to 1/weight = impressions + 1.
create or replace function public.feed_rank_key(
  p_seed text,
  p_id uuid,
  p_impressions integer
)
returns double precision
language sql
immutable
parallel safe
as $$
  select power(
    ((hashtextextended(p_seed || ':' || p_id::text, 0) & 9223372036854775807)::double precision + 1)
      / 9223372036854775808.0,
    coalesce(p_impressions, 0) + 1
  )
$$;

-- ─── posts ──────────────────────────────────────────────────────────────
-- Approved only: the feed has never shown anything else (see
-- hooks/useFilteredFeedPosts.ts), so there is no reason to rank it.
create or replace function public.feed_order_posts(
  p_seed text,
  p_limit integer default 600,
  p_boost_slots integer default 2
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with pool as (
    select id,
           feed_rank_key(p_seed, id, impressions_shown) as k,
           coalesce(boost_expires_at > now(), false) as boosted
    from posts
    where moderation_status = 'approved'
  ),
  ranked as (
    select id, k,
           boosted and row_number() over (partition by boosted order by k desc, id) <= p_boost_slots as slot
    from pool
  ),
  page as (
    select id, row_number() over (order by slot desc, k desc, id) as n
    from ranked
    order by n
    limit greatest(p_limit, 0)
  )
  select jsonb_build_object(
    'ids', coalesce((select jsonb_agg(id order by n) from page), '[]'::jsonb),
    'as_of', now()
  )
$$;

-- ─── products ───────────────────────────────────────────────────────────
-- p_category / p_tag mirror the filters the Shopping tab and category pages
-- pass (category slug, and one tag the product must carry).
create or replace function public.feed_order_products(
  p_seed text,
  p_category text default null,
  p_tag text default null,
  p_limit integer default 600,
  p_boost_slots integer default 2
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with pool as (
    select id,
           feed_rank_key(p_seed, id, impressions_shown) as k,
           coalesce(boost_expires_at > now(), false) as boosted
    from products
    where (p_category is null or category = p_category)
      and (p_tag is null or tags @> array[p_tag])
  ),
  ranked as (
    select id, k,
           boosted and row_number() over (partition by boosted order by k desc, id) <= p_boost_slots as slot
    from pool
  ),
  page as (
    select id, row_number() over (order by slot desc, k desc, id) as n
    from ranked
    order by n
    limit greatest(p_limit, 0)
  )
  select jsonb_build_object(
    'ids', coalesce((select jsonb_agg(id order by n) from page), '[]'::jsonb),
    'as_of', now()
  )
$$;

-- ─── marketplace ────────────────────────────────────────────────────────
-- One order for every type: the Marketplace tabs filter the loaded rows on
-- the phone so swiping between them never waits on the network.
create or replace function public.feed_order_marketplace(
  p_seed text,
  p_limit integer default 600,
  p_boost_slots integer default 2
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with pool as (
    select id,
           feed_rank_key(p_seed, id, impressions_shown) as k,
           coalesce(boost_expires_at > now(), false) as boosted
    from marketplace
  ),
  ranked as (
    select id, k,
           boosted and row_number() over (partition by boosted order by k desc, id) <= p_boost_slots as slot
    from pool
  ),
  page as (
    select id, row_number() over (order by slot desc, k desc, id) as n
    from ranked
    order by n
    limit greatest(p_limit, 0)
  )
  select jsonb_build_object(
    'ids', coalesce((select jsonb_agg(id order by n) from page), '[]'::jsonb),
    'as_of', now()
  )
$$;

-- ─── provider_services ──────────────────────────────────────────────────
create or replace function public.feed_order_provider_services(
  p_seed text,
  p_category_slug text,
  p_limit integer default 600,
  p_boost_slots integer default 2
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with pool as (
    select ps.id,
           feed_rank_key(p_seed, ps.id, ps.impressions_shown) as k,
           coalesce(ps.boost_expires_at > now(), false) as boosted
    from provider_services ps
    join service_categories sc on sc.id = ps.category_id
    where sc.slug = p_category_slug
  ),
  ranked as (
    select id, k,
           boosted and row_number() over (partition by boosted order by k desc, id) <= p_boost_slots as slot
    from pool
  ),
  page as (
    select id, row_number() over (order by slot desc, k desc, id) as n
    from ranked
    order by n
    limit greatest(p_limit, 0)
  )
  select jsonb_build_object(
    'ids', coalesce((select jsonb_agg(id order by n) from page), '[]'::jsonb),
    'as_of', now()
  )
$$;

grant execute on function public.feed_rank_key(text, uuid, integer) to anon, authenticated;
grant execute on function public.feed_order_posts(text, integer, integer) to anon, authenticated;
grant execute on function public.feed_order_products(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.feed_order_marketplace(text, integer, integer) to anon, authenticated;
grant execute on function public.feed_order_provider_services(text, text, integer, integer) to anon, authenticated;
