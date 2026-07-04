alter table public.items
  add column delivery_deadline timestamptz,
  add column pickup_eta timestamptz,
  add column delivery_photo_url text;

alter table public.items
  add constraint delivery_deadline_after_pickup_deadline
  check (delivery_deadline is null or valid_until is null or delivery_deadline > valid_until);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.items(id) on delete cascade,
  rater_id uuid not null references public.profiles(id),
  ratee_id uuid not null references public.profiles(id),
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now()
);

create index ratings_ratee_id_idx on public.ratings (ratee_id);

alter table public.ratings enable row level security;

create policy "ratings are viewable by rater or ratee"
  on public.ratings for select
  using (ratee_id = auth.uid() or rater_id = auth.uid());

-- insert_item now also takes the delivery-completion deadline (must be
-- later than the pickup deadline, enforced by the table check above)
drop function if exists public.insert_item(
  text, text, integer, text, text, text, double precision, double precision,
  text, text, text, double precision, double precision, text, timestamptz
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
  p_valid_until timestamptz,
  p_delivery_deadline timestamptz
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
  if p_delivery_deadline <= p_valid_until then
    raise exception 'delivery deadline must be after the pickup deadline';
  end if;

  insert into public.items (
    uploader_id, title, description, price, photo_url,
    pickup_address, pickup_district, pickup_location, pickup_instruction,
    dropoff_address, dropoff_district, dropoff_location, dropoff_instruction,
    valid_until, delivery_deadline
  ) values (
    auth.uid(), p_title, p_description, p_price, p_photo_url,
    p_pickup_address, p_pickup_district,
    extensions.ST_MakePoint(p_pickup_lng, p_pickup_lat)::extensions.geography,
    p_pickup_instruction,
    p_dropoff_address, p_dropoff_district,
    extensions.ST_MakePoint(p_dropoff_lng, p_dropoff_lat)::extensions.geography,
    p_dropoff_instruction,
    p_valid_until, p_delivery_deadline
  )
  returning * into v_item;

  return v_item;
end;
$$;

revoke execute on function public.insert_item from public, anon;
grant execute on function public.insert_item to authenticated;

-- select_item now also records the selector's own planned pickup time,
-- alongside their estimated delivery time
drop function if exists public.select_item(uuid, timestamptz);

create function public.select_item(p_item_id uuid, p_pickup_eta timestamptz, p_delivery_eta timestamptz)
returns public.items
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.items;
begin
  if p_pickup_eta >= p_delivery_eta then
    raise exception 'pickup time must be before the estimated delivery time';
  end if;

  update public.items
  set status = 'selected',
      selected_by = auth.uid(),
      selected_at = now(),
      pickup_eta = p_pickup_eta,
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

-- mark_delivered now requires proof-of-delivery photo
drop function if exists public.mark_delivered(uuid);

create function public.mark_delivered(p_item_id uuid, p_delivery_photo_url text)
returns public.items
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.items;
begin
  update public.items
  set status = 'delivered',
      delivered_at = now(),
      delivery_photo_url = p_delivery_photo_url
  where id = p_item_id
    and selected_by = auth.uid()
    and status = 'selected'
  returning * into v_item;

  if not found then
    raise exception 'item is not in a deliverable state';
  end if;

  return v_item;
end;
$$;

revoke execute on function public.mark_delivered from public, anon;
grant execute on function public.mark_delivered to authenticated;

-- confirm_delivery now also records the uploader's rating of the deliverer,
-- in the same transaction as completing the item
drop function if exists public.confirm_delivery(uuid);

create function public.confirm_delivery(p_item_id uuid, p_rating smallint)
returns public.items
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.items;
begin
  if p_rating not between 1 and 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  update public.items
  set status = 'completed',
      completed_at = now()
  where id = p_item_id
    and uploader_id = auth.uid()
    and status = 'delivered'
  returning * into v_item;

  if not found then
    raise exception 'item is not awaiting delivery confirmation';
  end if;

  insert into public.ratings (item_id, rater_id, ratee_id, score)
  values (v_item.id, auth.uid(), v_item.selected_by, p_rating);

  return v_item;
end;
$$;

revoke execute on function public.confirm_delivery from public, anon;
grant execute on function public.confirm_delivery to authenticated;

create function public.get_my_rating()
returns table (average numeric, rating_count bigint)
language sql stable
security definer set search_path = public
as $$
  select avg(score)::numeric, count(*)
  from public.ratings
  where ratee_id = auth.uid();
$$;

revoke execute on function public.get_my_rating from public, anon;
grant execute on function public.get_my_rating to authenticated;

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
  delivery_deadline timestamptz,
  status item_status,
  selected_by uuid,
  selected_at timestamptz,
  pickup_eta timestamptz,
  delivery_eta timestamptz,
  delivery_photo_url text,
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
    i.valid_until, i.delivery_deadline, i.status, i.selected_by, i.selected_at,
    i.pickup_eta, i.delivery_eta, i.delivery_photo_url,
    i.paid_at, i.delivered_at, i.completed_at, i.expired_at, i.created_at
  from public.items i
  where i.id = p_item_id;
$$;

revoke execute on function public.get_item_with_coords from public, anon;
grant execute on function public.get_item_with_coords to authenticated;
