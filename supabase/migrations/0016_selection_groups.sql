-- persists the aggregate detour/toll/fuel figures for a set of items
-- selected together in one trip. recomputing these per item after selection
-- no longer reflects the real (multi-stop) route the deliverer committed to,
-- so the figures for the whole group are captured once, at selection time.
create table public.selection_groups (
  id uuid primary key default gen_random_uuid(),
  selector_id uuid not null references public.profiles(id) on delete cascade,
  total_price integer not null,
  total_detour_minutes integer not null,
  total_extra_toll_fare integer not null,
  total_extra_distance_meters integer not null,
  created_at timestamptz not null default now()
);

alter table public.selection_groups enable row level security;

create policy "selection groups are viewable by their selector"
  on public.selection_groups for select
  using (selector_id = auth.uid());

alter table public.items
  add column selected_group_id uuid references public.selection_groups(id);

drop function public.select_items(uuid[], timestamptz[], timestamptz[]);

create function public.select_items(
  p_item_ids uuid[],
  p_pickup_etas timestamptz[],
  p_delivery_etas timestamptz[],
  p_total_detour_minutes integer,
  p_total_extra_toll_fare integer,
  p_total_extra_distance_meters integer
) returns setof public.items
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
  v_group_id uuid;
  v_total_price integer;
begin
  if array_length(p_item_ids, 1) is distinct from array_length(p_pickup_etas, 1)
     or array_length(p_item_ids, 1) is distinct from array_length(p_delivery_etas, 1) then
    raise exception 'item_ids, pickup_etas, and delivery_etas must have the same length';
  end if;

  if exists (
    select 1
    from unnest(p_pickup_etas, p_delivery_etas) as u(pickup_eta, delivery_eta)
    where u.pickup_eta >= u.delivery_eta
  ) then
    raise exception 'pickup time must be before the estimated delivery time';
  end if;

  select coalesce(sum(price), 0) into v_total_price
  from public.items
  where id = any(p_item_ids);

  -- if the items update below fails (one is no longer available), the
  -- exception rolls back this insert too, so no orphaned group is left behind
  insert into public.selection_groups (
    selector_id, total_price, total_detour_minutes, total_extra_toll_fare, total_extra_distance_meters
  ) values (
    auth.uid(), v_total_price, p_total_detour_minutes, p_total_extra_toll_fare, p_total_extra_distance_meters
  ) returning id into v_group_id;

  update public.items i
  set status = 'selected',
      selected_by = auth.uid(),
      selected_at = now(),
      pickup_eta = u.pickup_eta,
      delivery_eta = u.delivery_eta,
      selected_group_id = v_group_id
  from unnest(p_item_ids, p_pickup_etas, p_delivery_etas) as u(item_id, pickup_eta, delivery_eta)
  where i.id = u.item_id
    and i.status = 'available'
    and i.valid_until > now();

  get diagnostics v_count = row_count;
  if v_count is distinct from array_length(p_item_ids, 1) then
    raise exception 'one or more items are no longer available';
  end if;

  return query select * from public.items where id = any(p_item_ids);
end;
$$;

revoke execute on function public.select_items from public, anon;
grant execute on function public.select_items to authenticated;

drop function public.get_item_with_coords(uuid);

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
  selected_group_id uuid,
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
    i.valid_until, i.delivery_deadline, i.status, i.selected_by, i.selected_at, i.selected_group_id,
    i.pickup_eta, i.delivery_eta, i.delivery_photo_url,
    i.paid_at, i.delivered_at, i.completed_at, i.expired_at, i.created_at
  from public.items i
  where i.id = p_item_id;
$$;

revoke execute on function public.get_item_with_coords from public, anon;
grant execute on function public.get_item_with_coords to authenticated;
