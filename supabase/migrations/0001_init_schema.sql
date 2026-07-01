create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create type item_status as enum ('available', 'selected', 'paid', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  expo_push_token text,
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  price integer not null check (price >= 0),
  photo_url text,
  address text not null,
  district text,
  location extensions.geography(Point, 4326) not null,
  valid_until timestamptz not null,
  status item_status not null default 'available',
  selected_by uuid references public.profiles(id),
  selected_at timestamptz,
  paid_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now()
);

create index items_location_gix on public.items using gist (location);
create index items_status_idx on public.items (status);
create index items_district_idx on public.items (district);
create index items_valid_until_idx on public.items (valid_until);

-- auto-create a profile row whenever a new auth user signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.items enable row level security;

create policy "profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

create policy "items are viewable by anyone involved or when available"
  on public.items for select
  using (
    status = 'available'
    or uploader_id = auth.uid()
    or selected_by = auth.uid()
  );

create policy "items are insertable by their uploader"
  on public.items for insert
  with check (uploader_id = auth.uid());

create policy "items are deletable by their uploader"
  on public.items for delete
  using (uploader_id = auth.uid());
