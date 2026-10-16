-- Galería "Nuestro trabajo": hasta 6 fotos por página, en el bucket profile-photos
-- (carpeta del dueño). Aquí solo se guardan las direcciones (https) de las fotos.
alter table public.profiles
  add column gallery text[] not null default '{}'
    check (
      cardinality(gallery) <= 6
      and char_length(array_to_string(gallery, ' ')) <= 3000
      and array_to_string(gallery, ' ') ~ '^(https://[^ ]+)?( https://[^ ]+)*$'
    );

drop function if exists public.get_public_profile(text);

create function public.get_public_profile(p_slug text)
returns table (
  slug text, business_name text, first_name text, trade_en text, city text,
  service_area text, services text[], phone text, show_phone boolean,
  photo_url text, tagline text, tagline_en text, bio text, bio_en text,
  traits text[], show_prices boolean, service_items jsonb, gallery text[]
)
language sql stable security definer set search_path = public as $$
  select p.slug, p.business_name, p.first_name, p.trade_en, p.city, p.service_area, p.services,
         case when p.show_phone then p.phone else '' end,
         p.show_phone,
         p.photo_url, p.tagline, p.tagline_en, p.bio, p.bio_en, p.traits, p.show_prices,
         case when p.show_prices then p.service_items
              else (select coalesce(jsonb_agg(i - 'from_price'), '[]'::jsonb)
                    from jsonb_array_elements(p.service_items) i) end,
         p.gallery
  from public.profiles p
  where p.active
    and (p.slug = lower(p_slug)
         or p.id = (select h.profile_id from public.slug_history h where h.slug = lower(p_slug)))
  limit 1;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;
