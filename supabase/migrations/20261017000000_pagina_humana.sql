-- Página pública "humana": foto, frase, bio, rasgos y servicios con ícono y precio.
-- bio_en / tagline_en los llena la traducción automática (etapa 3); mientras estén vacíos la
-- página muestra el texto original.

alter table public.profiles
  add column photo_url    text    not null default '' check (char_length(photo_url) <= 500),
  add column tagline      text    not null default '' check (char_length(tagline) <= 60),
  add column tagline_en   text    not null default '' check (char_length(tagline_en) <= 80),
  add column bio          text    not null default '' check (char_length(bio) <= 600),
  add column bio_en       text    not null default '' check (char_length(bio_en) <= 900),
  add column traits       text[]  not null default '{}'
    check (cardinality(traits) <= 3 and traits <@ array['reliable','punctual','quality','friendly','tidy']),
  add column show_prices  boolean not null default true,
  add column service_items jsonb  not null default '[]'
    check (jsonb_typeof(service_items) = 'array' and jsonb_array_length(service_items) <= 12);

-- La función devuelve más columnas: hay que recrearla (Postgres no cambia el tipo de retorno).
drop function if exists public.get_public_profile(text);

create function public.get_public_profile(p_slug text)
returns table (
  slug text, business_name text, first_name text, trade_en text, city text,
  service_area text, services text[], phone text, show_phone boolean,
  photo_url text, tagline text, tagline_en text, bio text, bio_en text,
  traits text[], show_prices boolean, service_items jsonb
)
language sql stable security definer set search_path = public as $$
  select p.slug, p.business_name, p.first_name, p.trade_en, p.city, p.service_area, p.services,
         case when p.show_phone then p.phone else '' end,
         p.show_phone,
         p.photo_url, p.tagline, p.tagline_en, p.bio, p.bio_en, p.traits, p.show_prices,
         case when p.show_prices then p.service_items
              else (select coalesce(jsonb_agg(i - 'from_price'), '[]'::jsonb)
                    from jsonb_array_elements(p.service_items) i) end
  from public.profiles p
  where p.active
    and (p.slug = lower(p_slug)
         or p.id = (select h.profile_id from public.slug_history h where h.slug = lower(p_slug)))
  limit 1;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;

-- ------------------------------------------------------------ fotos (Storage)
-- Bucket público de lectura; cada usuario solo escribe dentro de su carpeta <uid>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy profile_photos_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy profile_photos_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy profile_photos_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy profile_photos_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
