-- fetch a single item with plain lng/lat, respecting the existing RLS select
-- policy on items (security invoker, so RLS still applies to the caller)
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
  where i.id = p_item_id;
$$;

revoke execute on function public.get_item_with_coords from public, anon;
grant execute on function public.get_item_with_coords to authenticated;
