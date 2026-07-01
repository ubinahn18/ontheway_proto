insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

create policy "item photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'item-photos');

create policy "users can upload their own item photos"
  on storage.objects for insert
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
