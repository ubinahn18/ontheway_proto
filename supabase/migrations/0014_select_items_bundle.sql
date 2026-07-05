-- replaces select_item: a searcher can now select 1-3 items in one trip.
-- all items are claimed atomically (all-or-nothing) and each gets its own
-- pickup/delivery eta, since the client already worked out the visiting
-- order and per-stop timing before calling this.
drop function if exists public.select_item(uuid, timestamptz, timestamptz);

create function public.select_items(
  p_item_ids uuid[],
  p_pickup_etas timestamptz[],
  p_delivery_etas timestamptz[]
) returns setof public.items
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
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

  update public.items i
  set status = 'selected',
      selected_by = auth.uid(),
      selected_at = now(),
      pickup_eta = u.pickup_eta,
      delivery_eta = u.delivery_eta
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
