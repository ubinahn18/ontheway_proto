alter table public.items
  add column delivered_at timestamptz,
  add column completed_at timestamptz;

-- the selector confirms they handed the item off; only they can do this,
-- and only from 'selected' (mirrors the guard shape in select_item)
create function public.mark_delivered(p_item_id uuid)
returns public.items
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.items;
begin
  update public.items
  set status = 'delivered',
      delivered_at = now()
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

-- the uploader confirms receipt; only they can do this, and only from
-- 'delivered'. this is the terminal step of the flow
create function public.confirm_delivery(p_item_id uuid)
returns public.items
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.items;
begin
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

  return v_item;
end;
$$;

revoke execute on function public.mark_delivered from public, anon;
revoke execute on function public.confirm_delivery from public, anon;
grant execute on function public.mark_delivered to authenticated;
grant execute on function public.confirm_delivery to authenticated;

create function public.notify_on_deliver()
returns trigger
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if old.status = 'selected' and new.status = 'delivered' then
    perform net.http_post(
      url := 'https://eitobfgxasdbimiewjhh.supabase.co/functions/v1/notify-on-deliver',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('itemId', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger on_item_delivered
  after update on public.items
  for each row execute function public.notify_on_deliver();

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
  dropoff_address text,
  dropoff_district text,
  dropoff_lng double precision,
  dropoff_lat double precision,
  valid_until timestamptz,
  status item_status,
  selected_by uuid,
  selected_at timestamptz,
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
    i.dropoff_address, i.dropoff_district,
    extensions.ST_X(i.dropoff_location::extensions.geometry),
    extensions.ST_Y(i.dropoff_location::extensions.geometry),
    i.valid_until, i.status, i.selected_by, i.selected_at, i.paid_at,
    i.delivered_at, i.completed_at, i.expired_at, i.created_at
  from public.items i
  where i.id = p_item_id;
$$;

revoke execute on function public.get_item_with_coords from public, anon;
grant execute on function public.get_item_with_coords to authenticated;
