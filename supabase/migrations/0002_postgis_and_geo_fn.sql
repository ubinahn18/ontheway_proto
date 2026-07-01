-- radius search: nearby available items, optionally filtered by max price / deadline
create function public.items_within_radius(
  seeker_lng double precision,
  seeker_lat double precision,
  radius_meters integer,
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
          location,
          extensions.ST_MakePoint(seeker_lng, seeker_lat)::extensions.geography,
          radius_meters
        )
    and (max_price is null or price <= max_price)
    and (before_time is null or valid_until <= before_time)
  order by location <-> extensions.ST_MakePoint(seeker_lng, seeker_lat)::extensions.geography;
$$;

-- create an item with a server-constructed PostGIS point, so the client never
-- has to build WKT/geography values itself
create function public.insert_item(
  p_title text,
  p_description text,
  p_price integer,
  p_photo_url text,
  p_address text,
  p_district text,
  p_lng double precision,
  p_lat double precision,
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
    address, district, location, valid_until
  ) values (
    auth.uid(), p_title, p_description, p_price, p_photo_url,
    p_address, p_district,
    extensions.ST_MakePoint(p_lng, p_lat)::extensions.geography,
    p_valid_until
  )
  returning * into v_item;

  return v_item;
end;
$$;

-- atomically claim an available, non-expired item; raises if it was already
-- taken or expired, which resolves the race between two seekers selecting
-- the same item at once
create function public.select_item(p_item_id uuid)
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
      selected_at = now()
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

revoke execute on function public.insert_item from public, anon;
revoke execute on function public.select_item from public, anon;
grant execute on function public.insert_item to authenticated;
grant execute on function public.select_item to authenticated;
