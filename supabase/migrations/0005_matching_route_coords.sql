-- expose pickup/dropoff as plain lng/lat instead of opaque PostGIS geography,
-- so the client can use them directly for map markers and (later) Kakao Navi
drop function if exists public.items_matching_route(
  double precision, double precision, double precision, double precision,
  integer, integer, integer, timestamptz
);

create function public.items_matching_route(
  seeker_origin_lng double precision,
  seeker_origin_lat double precision,
  seeker_dest_lng double precision,
  seeker_dest_lat double precision,
  origin_radius_meters integer,
  dest_radius_meters integer,
  max_price integer default null,
  before_time timestamptz default null
) returns table (
  id uuid,
  uploader_id uuid,
  title text,
  description text,
  price integer,
  photo_url text,
  pickup_address text,
  pickup_district text,
  pickup_lng double precision,
  pickup_lat double precision,
  dropoff_address text,
  dropoff_district text,
  dropoff_lng double precision,
  dropoff_lat double precision,
  valid_until timestamptz,
  status item_status,
  selected_by uuid,
  selected_at timestamptz,
  paid_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz
)
language sql stable
set search_path = public, extensions
as $$
  select
    i.id, i.uploader_id, i.title, i.description, i.price, i.photo_url,
    i.pickup_address, i.pickup_district,
    extensions.ST_X(i.pickup_location::extensions.geometry),
    extensions.ST_Y(i.pickup_location::extensions.geometry),
    i.dropoff_address, i.dropoff_district,
    extensions.ST_X(i.dropoff_location::extensions.geometry),
    extensions.ST_Y(i.dropoff_location::extensions.geometry),
    i.valid_until, i.status, i.selected_by, i.selected_at, i.paid_at, i.expired_at, i.created_at
  from public.items i
  where i.status = 'available'
    and extensions.ST_DWithin(
          i.pickup_location,
          extensions.ST_MakePoint(seeker_origin_lng, seeker_origin_lat)::extensions.geography,
          origin_radius_meters
        )
    and extensions.ST_DWithin(
          i.dropoff_location,
          extensions.ST_MakePoint(seeker_dest_lng, seeker_dest_lat)::extensions.geography,
          dest_radius_meters
        )
    and (max_price is null or i.price <= max_price)
    and (before_time is null or i.valid_until <= before_time)
  order by i.pickup_location <-> extensions.ST_MakePoint(seeker_origin_lng, seeker_origin_lat)::extensions.geography;
$$;

revoke execute on function public.items_matching_route from public, anon;
grant execute on function public.items_matching_route to authenticated;
