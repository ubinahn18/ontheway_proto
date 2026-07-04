-- match items that lie along the seeker's actual route (a buffered corridor
-- around the route polyline) instead of two independent radius circles.
-- this is a cheap geometric pre-filter — the caller still needs to run the
-- real detour-time calculation (kakao navi) only on the candidates this
-- returns, not on every available item.
create function public.items_within_corridor(
  p_route_wkt text,
  p_buffer_meters integer,
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
  pickup_instruction text,
  dropoff_address text,
  dropoff_district text,
  dropoff_lng double precision,
  dropoff_lat double precision,
  dropoff_instruction text,
  valid_until timestamptz,
  status item_status,
  selected_by uuid,
  selected_at timestamptz,
  delivery_eta timestamptz,
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
    i.pickup_instruction,
    i.dropoff_address, i.dropoff_district,
    extensions.ST_X(i.dropoff_location::extensions.geometry),
    extensions.ST_Y(i.dropoff_location::extensions.geometry),
    i.dropoff_instruction,
    i.valid_until, i.status, i.selected_by, i.selected_at, i.delivery_eta,
    i.paid_at, i.expired_at, i.created_at
  from public.items i,
       lateral (
         select extensions.ST_Buffer(
           extensions.ST_GeomFromText(p_route_wkt, 4326)::extensions.geography,
           p_buffer_meters
         ) as corridor
       ) c
  where i.status = 'available'
    and extensions.ST_Intersects(i.pickup_location, c.corridor)
    and extensions.ST_Intersects(i.dropoff_location, c.corridor)
    and (max_price is null or i.price <= max_price)
    and (before_time is null or i.valid_until <= before_time)
  order by i.pickup_location <-> extensions.ST_GeomFromText(p_route_wkt, 4326)::extensions.geography;
$$;

revoke execute on function public.items_within_corridor from public, anon;
grant execute on function public.items_within_corridor to authenticated;
