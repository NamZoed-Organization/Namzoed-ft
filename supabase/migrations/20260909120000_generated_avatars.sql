-- Generated avatars for profiles with no photo of their own.
--
-- A profile without a picture used to render as initials on a grey circle,
-- and a Google sign-in without a picture handed over Google's own monogram,
-- which is the same placeholder in someone else's brand. Both are replaced
-- by a DiceBear avatar seeded with the profile's id: stable forever,
-- identical on every device, nothing to upload.
--
-- avatar_url keeps the PNG endpoint, because it is read by every avatar in
-- the app including React Native's own <Image>, which cannot draw an SVG.
-- The recipe lives beside it so the surfaces that can render SVG rebuild the
-- animated version from the same seed. See lib/dicebear.ts — the URL shapes
-- here and there must agree.

alter table public.profiles
  add column if not exists avatar_style text,
  add column if not exists avatar_animation text not null default 'none';

comment on column public.profiles.avatar_style is
  'DiceBear style id when this profile wears a generated avatar; null means avatar_url is a real photo.';
comment on column public.profiles.avatar_animation is
  'DiceBear animationVariant (none/slowest/slow/medium/fast/fastest). Only meaningful for styles that animate.';

-- One place that knows how to build the URL, so the backfill and the
-- new-user trigger below cannot drift apart.
create or replace function public.dicebear_avatar_url(
  p_seed text,
  p_style text default 'notionists-neutral'
)
returns text
language sql
immutable
as $$
  select 'https://api.dicebear.com/10.x/' || p_style || '/png?seed=' ||
         replace(replace(p_seed, '&', '%26'), '?', '%3F') || '&size=256';
$$;

-- Backfill: no picture at all, or a picture that is itself a placeholder.
-- Deliberately conservative — Google returns no flag saying whether a photo
-- URL is a real photo or its own monogram, so anything that is not a known
-- placeholder is left alone rather than risking deleting someone's face.
update public.profiles
set
  avatar_url = public.dicebear_avatar_url(id::text),
  avatar_style = 'notionists-neutral',
  avatar_animation = 'none'
where
  avatar_style is null
  and (
    avatar_url is null
    or btrim(avatar_url) = ''
    or avatar_url ilike '%lh3.googleusercontent.com/a/default-user%'
    or avatar_url ilike '%googleusercontent.com/-%/AAAAAAAAAAA/%'
    or avatar_url ilike '%ui-avatars.com%'
    or avatar_url ilike '%avatars.dicebear.com%'
    or avatar_url ilike '%api.dicebear.com%'
    or avatar_url ~* 'gravatar\.com/avatar/.*[?&]d=(mp|mm|identicon|monsterid|wavatar|retro|robohash|blank)'
  );

-- Rows that already carried a DiceBear URL from an earlier client but no
-- style column: adopt them rather than regenerating, so nobody's avatar
-- changes under them.
update public.profiles
set avatar_style = coalesce(avatar_style, 'notionists-neutral')
where avatar_style is null and avatar_url ilike '%api.dicebear.com%';

-- New accounts get one on the way in, so there is never a first session
-- spent looking at initials. Everything else in this function is unchanged.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_birth_date date := null;
begin
  if nullif(new.raw_user_meta_data->>'birth_date', '') is not null then
    v_birth_date := (new.raw_user_meta_data->>'birth_date')::date;
  end if;

  insert into public.profiles (
    id, name, phone, dzongkhag, email, birth_date, age_verified,
    age_verification_date, avatar_url, avatar_style, avatar_animation,
    created_at, updated_at
  )
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'dzongkhag',
    new.email,
    v_birth_date,
    v_birth_date is not null,
    case when v_birth_date is not null then now() else null end,
    public.dicebear_avatar_url(new.id::text),
    'notionists-neutral',
    'none',
    now(),
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
