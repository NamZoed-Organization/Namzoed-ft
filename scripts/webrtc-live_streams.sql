-- live_streams WebRTC update

alter table public.live_streams
  add column if not exists stream_provider_id text,
  add column if not exists external_metadata jsonb,
  add column if not exists call_id text,
  add column if not exists call_cid text,
  add column if not exists call_type text,
  alter column viewer_count set default 0,
  alter column likes set default 0,
  alter column is_active set default false,
  alter column recording_enabled set default false;

comment on column public.live_streams.stream_provider_id
  is 'Provider-specific ID (Stream call id).';
comment on column public.live_streams.external_metadata
  is 'Provider metadata such as call_id, call_cid, playback mode, etc.';
comment on column public.live_streams.call_id
  is 'Stream call identifier (plain text for quick lookups).';
comment on column public.live_streams.call_cid
  is 'Stream call CID (type:id).';
comment on column public.live_streams.call_type
  is 'Stream call type (e.g. livestream).';

create index if not exists live_streams_call_id_idx
  on public.live_streams (call_id);

create index if not exists live_streams_is_active_idx
  on public.live_streams (is_active)
  where is_active = true;

create index if not exists live_streams_user_id_idx
  on public.live_streams (user_id);

-- Optional: keep call_id unique to prevent duplicate sessions.
alter table public.live_streams
  add constraint if not exists live_streams_call_id_unique
  unique (call_id);

-- RLS tweaks: allow creators to manage their own rows, viewers to bump counts.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where polname = 'live_streams_insert_self'
      and tablename = 'live_streams'
  ) then
    create policy "live_streams_insert_self"
      on public.live_streams
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where polname = 'live_streams_update_self'
      and tablename = 'live_streams'
  ) then
    create policy "live_streams_update_self"
      on public.live_streams
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where polname = 'live_streams_viewer_counts'
      and tablename = 'live_streams'
  ) then
    create policy "live_streams_viewer_counts"
      on public.live_streams
      for update
      using (true)
      with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1
    from pg_policies
    where polname = 'live_streams_select'
      and tablename = 'live_streams'
  ) then
    create policy "live_streams_select"
      on public.live_streams
      for select
      using (true);
  end if;
end
$$ language plpgsql;