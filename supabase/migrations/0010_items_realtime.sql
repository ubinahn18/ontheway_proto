-- full row images on UPDATE (not just the primary key) so subscribers can
-- compare old.status vs new.status client-side
alter table public.items replica identity full;

alter publication supabase_realtime add table public.items;
