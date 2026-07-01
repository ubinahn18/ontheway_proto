-- items now represent a delivery task with a pickup point and a dropoff
-- point, instead of a single location. Test data from the single-location
-- schema is disposable.
truncate table public.items;

drop function if exists public.insert_item(
  text, text, integer, text, text, text, double precision, double precision, timestamptz
);
drop function if exists public.items_within_radius(
  double precision, double precision, integer, integer, timestamptz
);

alter table public.items
  drop column location,
  drop column address,
  drop column district;

alter table public.items
  add column pickup_address text not null,
  add column pickup_district text,
  add column pickup_location extensions.geography(Point, 4326) not null,
  add column dropoff_address text not null,
  add column dropoff_district text,
  add column dropoff_location extensions.geography(Point, 4326) not null;

create index items_pickup_location_gix on public.items using gist (pickup_location);
create index items_dropoff_location_gix on public.items using gist (dropoff_location);
create index items_pickup_district_idx on public.items (pickup_district);
create index items_dropoff_district_idx on public.items (dropoff_district);

-- create an item with server-constructed PostGIS points for both pickup and
-- dropoff, so the client never has to build WKT/geography values itself
create function public.insert_item(
  p_title text,
  p_description text,
  p_price integer,
  p_photo_url text,
  p_pickup_address text,
  p_pickup_district text,
  p_pickup_lng double precision,
  p_pickup_lat double precision,
  p_dropoff_address text,
  p_dropoff_district text,
  p_dropoff_lng double precision,
  p_dropoff_lat double precision,
  p_valid_until timestamptz
) returns public.items
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.items;
begin
  insert into public.items (
    uploader_id, title, description, price, photo_url,
    pickup_address, pickup_district, pickup_location,
    dropoff_address, dropoff_district, dropoff_location,
    valid_until
  ) values (
    auth.uid(), p_title, p_description, p_price, p_photo_url,
    p_pickup_address, p_pickup_district,
    extensions.ST_MakePoint(p_pickup_lng, p_pickup_lat)::extensions.geography,
    p_dropoff_address, p_dropoff_district,
    extensions.ST_MakePoint(p_dropoff_lng, p_dropoff_lat)::extensions.geography,
    p_valid_until
  )
  returning * into v_item;

  return v_item;
end;
$$;

-- match items whose pickup is near the seeker's own origin AND whose
-- dropoff is near the seeker's own destination
create function public.items_matching_route(
  seeker_origin_lng double precision,
  seeker_origin_lat double precision,
  seeker_dest_lng double precision,
  seeker_dest_lat double precision,
  origin_radius_meters integer,
  dest_radius_meters integer,
  max_price integer default null,
  before_time timestamptz default null
) returns setof public.items
language sql stable
set search_path = public, extensions
as $$
  select *
  from public.items
  where status = 'available'
    and extensions.ST_DWithin(
          pickup_location,
          extensions.ST_MakePoint(seeker_origin_lng, seeker_origin_lat)::extensions.geography,
          origin_radius_meters
        )
    and extensions.ST_DWithin(
          dropoff_location,
          extensions.ST_MakePoint(seeker_dest_lng, seeker_dest_lat)::extensions.geography,
          dest_radius_meters
        )
    and (max_price is null or price <= max_price)
    and (before_time is null or valid_until <= before_time)
  order by pickup_location <-> extensions.ST_MakePoint(seeker_origin_lng, seeker_origin_lat)::extensions.geography;
$$;

revoke execute on function public.insert_item from public, anon;
revoke execute on function public.items_matching_route from public, anon;
grant execute on function public.insert_item to authenticated;
grant execute on function public.items_matching_route to authenticated;
