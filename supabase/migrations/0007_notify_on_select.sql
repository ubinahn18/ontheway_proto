create function public.notify_on_select()
returns trigger
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if old.status = 'available' and new.status = 'selected' then
    perform net.http_post(
      url := 'https://eitobfgxasdbimiewjhh.supabase.co/functions/v1/notify-on-select',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('itemId', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger on_item_selected
  after update on public.items
  for each row execute function public.notify_on_select();
