-- delivery request enhancements: pickup/dropoff handoff instructions, a
-- selector-supplied delivery ETA, and a server-enforced price ceiling
-- (theft/damage exposure control) on new listings.

alter table public.items
  add column pickup_instruction text,
  add column dropoff_instruction text,
  add column delivery_eta timestamptz;

drop function if exists public.insert_item(
  text, text, integer, text, text, text, double precision, double precision,
  text, text, double precision, double precision, timestamptz
);

create function public.insert_item(
  p_title text,
  p_description text,
  p_price integer,
  p_photo_url text,
  p_pickup_address text,
  p_pickup_district text,
  p_pickup_lng double precision,
  p_pickup_lat double precision,
  p_pickup_instruction text,
  p_dropoff_address text,
  p_dropoff_district text,
  p_dropoff_lng double precision,
  p_dropoff_lat double precision,
  p_dropoff_instruction text,
  p_valid_until timestamptz
) returns public.items
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.items;
begin
  if p_price > 100000 then
    raise exception 'price exceeds maximum allowed (100,000 won)';
  end if;

  insert into public.items (
    uploader_id, title, description, price, photo_url,
    pickup_address, pickup_district, pickup_location, pickup_instruction,
    dropoff_address, dropoff_district, dropoff_location, dropoff_instruction,
    valid_until
  ) values (
    auth.uid(), p_title, p_description, p_price, p_photo_url,
    p_pickup_address, p_pickup_district,
    extensions.ST_MakePoint(p_pickup_lng, p_pickup_lat)::extensions.geography,
    p_pickup_instruction,
    p_dropoff_address, p_dropoff_district,
    extensions.ST_MakePoint(p_dropoff_lng, p_dropoff_lat)::extensions.geography,
    p_dropoff_instruction,
    p_valid_until
  )
  returning * into v_item;

  return v_item;
end;
$$;

revoke execute on function public.insert_item from public, anon;
grant execute on function public.insert_item to authenticated;

-- select_item now also records the selector's estimated delivery time, so
-- the uploader's notification can show it
drop function if exists public.select_item(uuid);

create function public.select_item(p_item_id uuid, p_delivery_eta timestamptz)
returns public.items
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.items;
begin
  update public.items
  set status = 'selected',
      selected_by = auth.uid(),
      selected_at = now(),
      delivery_eta = p_delivery_eta
  where id = p_item_id
    and status = 'available'
    and valid_until > now()
  returning * into v_item;

  if not found then
    raise exception 'item is no longer available';
  end if;

  return v_item;
end;
$$;

revoke execute on function public.select_item from public, anon;
grant execute on function public.select_item to authenticated;

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

drop function if exists public.get_item_with_coords(uuid);

create function public.get_item_with_coords(p_item_id uuid)
returns table (
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
  delivered_at timestamptz,
  completed_at timestamptz,
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
    i.paid_at, i.delivered_at, i.completed_at, i.expired_at, i.created_at
  from public.items i
  where i.id = p_item_id;
$$;

revoke execute on function public.get_item_with_coords from public, anon;
grant execute on function public.get_item_with_coords to authenticated;
