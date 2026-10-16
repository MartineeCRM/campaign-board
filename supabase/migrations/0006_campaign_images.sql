alter table campaigns
  add column images jsonb not null default '[]'::jsonb
  check (jsonb_typeof(images) = 'array');

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('campaign-images', 'campaign-images', false, array['image/*'])
on conflict (id) do update
set public = false,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "authenticated can access campaign images"
on storage.objects
for all
to authenticated
using (bucket_id = 'campaign-images')
with check (bucket_id = 'campaign-images');
